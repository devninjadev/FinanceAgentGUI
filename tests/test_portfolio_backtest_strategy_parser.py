import unittest

import pandas as pd

from scripts import portfolio_backtest_yfinance as bt


class PortfolioBacktestStrategyParserTests(unittest.TestCase):
    def test_strategy_router_only_registers_matrix_dsl_parser(self) -> None:
        parser_names = [parser.__name__ for parser in bt.portfolio_strategy_config_parsers()]

        self.assertEqual(parser_names, ["parse_portfolio_matrix_dsl_strategy_config"])

    def test_legacy_strategy_types_are_rejected(self) -> None:
        legacy_types = [
            "external_signal",
            "periodic_rebalance",
            "threshold_rebalance",
            "supertrend",
            "indicator_signal",
            "universe_rotation",
        ]

        for strategy_type in legacy_types:
            with self.subTest(strategy_type=strategy_type):
                config = bt.parse_portfolio_strategy_config(
                    {
                        "strategy": {
                            "name": f"Legacy {strategy_type}",
                            "type": strategy_type,
                            "functionSpec": {
                                "executionMode": "signal-rules",
                                "program": [{"op": "rule", "when": "close > open"}],
                            },
                        }
                    }
                )

                self.assertEqual(config["type"], "unsupported")
                self.assertIn("portfolio-matrix-dsl", config["reason"])
                self.assertIn("legacy routes have been removed", config["reason"])

    def test_matrix_dsl_program_is_required(self) -> None:
        config = bt.parse_portfolio_strategy_config(
            {
                "strategy": {
                    "name": "10%p 이탈 리밸런싱",
                    "type": "portfolio_matrix_dsl",
                    "functionSpec": {
                        "language": "portfolio-matrix-dsl",
                        "executionMode": "matrix-dsl",
                    },
                }
            }
        )

        self.assertEqual(config["type"], "unsupported")
        self.assertIn("functionSpec.program", config["reason"])

    def test_matrix_dsl_rejects_unsupported_ops(self) -> None:
        config = bt.parse_portfolio_strategy_config(
            {
                "strategy": {
                    "name": "Unsafe code",
                    "type": "portfolio_matrix_dsl",
                    "functionSpec": {
                        "language": "portfolio-matrix-dsl",
                        "program": [{"op": "python", "code": "print('nope')"}],
                    },
                }
            }
        )

        self.assertEqual(config["type"], "unsupported")
        self.assertIn("Unsupported portfolio-matrix-dsl operations", config["reason"])
        self.assertIn("python", config["reason"])

    def test_portfolio_matrix_dsl_rsi_program_controls_exposure(self) -> None:
        config = bt.parse_portfolio_strategy_config(
            {
                "strategy": {
                    "name": "RSI Matrix DSL",
                    "type": "portfolio_matrix_dsl",
                    "functionSpec": {
                        "language": "portfolio-matrix-dsl",
                        "program": [
                            {"op": "indicator", "name": "rsi", "period": 2, "field": "close", "outputField": "rsi"},
                            {"op": "rule", "when": "rsi < 20", "emit": {"field": "target_weight", "value": 1}},
                            {"op": "rule", "when": "rsi > 70", "emit": {"field": "target_weight", "value": 0}},
                        ],
                    },
                }
            }
        )
        result = bt.apply_portfolio_matrix_dsl_strategy(
            ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05", "2026-01-06"],
            [100, 90, 80, 85, 95, 90],
            config,
        )

        self.assertEqual(config["type"], "portfolio_matrix_dsl")
        self.assertEqual([trade["action"] for trade in result["trades"]], ["SELL"])
        self.assertEqual(result["trades"][0]["date"], "2026-01-05")
        self.assertEqual(result["parameters"]["language"], "portfolio-matrix-dsl")

    def test_portfolio_matrix_dsl_macd_program_uses_runtime_price_matrix(self) -> None:
        config = bt.parse_portfolio_strategy_config(
            {
                "strategy": {
                    "name": "MACD Matrix DSL",
                    "type": "portfolio_matrix_dsl",
                    "functionSpec": {
                        "language": "portfolio-matrix-dsl",
                        "program": [
                            {
                                "op": "indicator",
                                "name": "macd",
                                "field": "close",
                                "fastPeriod": 3,
                                "slowPeriod": 6,
                                "signalPeriod": 3,
                                "outputField": "macd",
                            },
                            {"op": "rule", "when": "macd > 0", "emit": {"field": "target_weight", "value": 1}},
                            {"op": "rule", "when": "macd < 0", "emit": {"field": "target_weight", "value": 0}},
                        ],
                    },
                }
            }
        )
        values = [100, 101, 102, 103, 104, 105, 104, 103, 102, 101, 100, 99, 100, 101, 102, 103]
        result = bt.apply_portfolio_matrix_dsl_strategy(
            [f"2026-01-{day:02d}" for day in range(1, len(values) + 1)],
            values,
            config,
        )

        self.assertEqual(config["type"], "portfolio_matrix_dsl")
        self.assertTrue(result["trades"])
        self.assertEqual(result["parameters"]["language"], "portfolio-matrix-dsl")

    def test_portfolio_matrix_dsl_signal_matrix_rows_control_exposure(self) -> None:
        config = bt.parse_portfolio_strategy_config(
            {
                "strategy": {
                    "name": "CAPE HA Matrix DSL",
                    "type": "portfolio_matrix_dsl",
                    "signalMatrix": {
                        "rows": [
                            {"date": "2026-01-03", "asset": "QQQ", "field": "target_weight", "value": 0, "signal": "CAPE_HA_BEARISH_CLOSE"},
                            {"date": "2026-01-05", "asset": "QQQ", "field": "target_weight", "value": 1, "signal": "CAPE_HA_BULLISH_CLOSE"},
                        ]
                    },
                    "functionSpec": {
                        "language": "portfolio-matrix-dsl",
                        "program": [
                            {"op": "rule", "when": "cape_ha_close < cape_ha_open", "emit": {"field": "target_weight", "value": 0}},
                            {"op": "rule", "when": "cape_ha_close > cape_ha_open", "emit": {"field": "target_weight", "value": 1}},
                        ],
                    },
                }
            }
        )
        result = bt.apply_portfolio_matrix_dsl_strategy(
            ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05"],
            [100.0, 110.0, 121.0, 133.1, 146.41],
            config,
        )

        self.assertEqual(config["type"], "portfolio_matrix_dsl")
        self.assertEqual(len(config["signalRows"]), 2)
        self.assertEqual([trade["action"] for trade in result["trades"]], ["SELL", "BUY"])
        self.assertEqual([trade["date"] for trade in result["trades"]], ["2026-01-03", "2026-01-05"])
        self.assertEqual(result["parameters"]["execution"], "signal_matrix target_weight rows")

    def test_portfolio_matrix_dsl_ignores_output_emit_declaration(self) -> None:
        config = bt.parse_portfolio_strategy_config(
            {
                "strategy": {
                    "name": "MACD Matrix DSL",
                    "type": "portfolio_matrix_dsl",
                    "functionSpec": {
                        "language": "portfolio-matrix-dsl",
                        "program": [
                            {
                                "op": "indicator",
                                "name": "macd",
                                "field": "close",
                                "fastPeriod": 3,
                                "slowPeriod": 6,
                                "signalPeriod": 3,
                                "outputField": "macd",
                            },
                            {"op": "rule", "when": "macd > 0", "emit": {"field": "target_weight", "value": 1}},
                            {"op": "rule", "when": "macd < 0", "emit": {"field": "target_weight", "value": 0}},
                            {"op": "emit", "ruleId": "output_signal_matrix"},
                        ],
                    },
                }
            }
        )
        values = [100, 101, 102, 103, 104, 105, 104, 103, 102, 101, 100, 99, 100, 101, 102, 103]
        result = bt.apply_portfolio_matrix_dsl_strategy(
            [f"2026-01-{day:02d}" for day in range(1, len(values) + 1)],
            values,
            config,
        )

        self.assertIsNotNone(result)
        self.assertTrue(result["trades"])

    def test_portfolio_matrix_dsl_accepts_constant_true_rule(self) -> None:
        config = bt.parse_portfolio_strategy_config(
            {
                "strategy": {
                    "name": "Buy Hold DSL",
                    "type": "portfolio_matrix_dsl",
                    "functionSpec": {
                        "language": "portfolio-matrix-dsl",
                        "program": [
                            {"op": "rule", "when": "true", "emit": {"field": "target_weight", "value": 1}},
                            {"op": "emit", "ruleId": "output_signal_matrix"},
                        ],
                    },
                }
            }
        )
        values = [100, 101, 99, 103]
        result = bt.apply_portfolio_matrix_dsl_strategy(
            [f"2026-01-{day:02d}" for day in range(1, len(values) + 1)],
            values,
            config,
        )

        self.assertEqual(result["values"], values)
        self.assertEqual(result["trades"], [])

    def test_portfolio_matrix_dsl_threshold_band_rebalances_when_drift_crosses_band(self) -> None:
        config = bt.parse_portfolio_strategy_config(
            {
                "strategy": {
                    "name": "10%p 이탈 리밸런싱",
                    "type": "portfolio_matrix_dsl",
                    "functionSpec": {
                        "language": "portfolio-matrix-dsl",
                        "program": [
                            {
                                "op": "rebalance",
                                "method": "threshold_band",
                                "threshold": 0.10,
                                "assets": ["QLD", "QQQ"],
                                "target": "target_weights",
                            }
                        ],
                    },
                }
            }
        )
        normalized = pd.DataFrame(
            [
                {"QLD": 1.0, "QQQ": 1.0},
                {"QLD": 1.4, "QQQ": 1.0},
                {"QLD": 1.4, "QQQ": 1.0},
            ]
        )
        result = bt.apply_portfolio_matrix_dsl_strategy(
            ["2026-01-02", "2026-01-03", "2026-01-04"],
            [100.0, 120.0, 120.0],
            config,
            normalized=normalized,
            tickers=["QLD", "QQQ"],
            weights={"QLD": 0.5, "QQQ": 0.5},
            cash_weight=0.0,
        )

        self.assertEqual(config["type"], "portfolio_matrix_dsl")
        self.assertEqual(result["trades"][0]["action"], "REBALANCE")
        self.assertEqual(result["trades"][0]["date"], "2026-01-03")
        self.assertEqual(result["parameters"]["threshold"], 10.0)
        self.assertEqual(result["parameters"]["language"], "portfolio-matrix-dsl")

    def test_backtest_parser_alias_uses_same_dsl_only_router(self) -> None:
        payload = {
            "strategy": {
                "name": "RSI Matrix DSL",
                "type": "portfolio_matrix_dsl",
                "functionSpec": {
                    "language": "portfolio-matrix-dsl",
                    "program": [{"op": "rule", "when": "close > open", "emit": {"field": "target_weight", "value": 1}}],
                },
            }
        }

        self.assertEqual(bt.parse_backtest_strategy_config(payload), bt.parse_portfolio_strategy_config(payload))


if __name__ == "__main__":
    unittest.main()
