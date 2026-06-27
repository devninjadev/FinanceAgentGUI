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

    def test_portfolio_matrix_dsl_periodic_rebalance_runs_monthly(self) -> None:
        config = bt.parse_portfolio_strategy_config(
            {
                "strategy": {
                    "name": "월간 리밸런싱",
                    "type": "portfolio_matrix_dsl",
                    "functionSpec": {
                        "language": "portfolio-matrix-dsl",
                        "program": [
                            {
                                "op": "rebalance",
                                "method": "periodic",
                                "frequency": "monthly",
                                "target": "target_weights",
                            }
                        ],
                    },
                }
            }
        )
        normalized = pd.DataFrame(
            [
                {"AAA": 1.0, "BBB": 1.0},
                {"AAA": 2.0, "BBB": 1.0},
                {"AAA": 2.0, "BBB": 1.0},
                {"AAA": 2.0, "BBB": 2.0},
            ]
        )
        result = bt.apply_portfolio_matrix_dsl_strategy(
            ["2026-01-30", "2026-01-31", "2026-02-02", "2026-02-03"],
            [100.0, 150.0, 150.0, 200.0],
            config,
            normalized=normalized,
            tickers=["AAA", "BBB"],
            weights={"AAA": 0.5, "BBB": 0.5},
            cash_weight=0.0,
        )

        self.assertEqual(config["type"], "portfolio_matrix_dsl")
        self.assertEqual(result["trades"][0]["action"], "REBALANCE")
        self.assertEqual(result["trades"][0]["date"], "2026-01-31")
        self.assertEqual(result["parameters"]["method"], "periodic")
        self.assertEqual(result["parameters"]["language"], "portfolio-matrix-dsl")

    def test_portfolio_matrix_dsl_swap_transfers_position_value_to_new_asset(self) -> None:
        config = bt.parse_portfolio_strategy_config(
            {
                "strategy": {
                    "name": "A를 C로 스왑",
                    "type": "portfolio_matrix_dsl",
                    "functionSpec": {
                        "language": "portfolio-matrix-dsl",
                        "program": [
                            {
                                "op": "swap",
                                "from": "AAA",
                                "to": "CCC",
                                "effective": {"date": "2026-01-03", "snap": "next_trading_day"},
                                "weightPolicy": "preserve_value",
                            }
                        ],
                    },
                }
            }
        )
        normalized = pd.DataFrame(
            [
                {"AAA": 1.0, "BBB": 1.0, "CCC": 1.0},
                {"AAA": 2.0, "BBB": 1.0, "CCC": 1.0},
                {"AAA": 2.0, "BBB": 1.0, "CCC": 2.0},
                {"AAA": 2.0, "BBB": 1.0, "CCC": 4.0},
            ]
        )
        result = bt.apply_portfolio_matrix_dsl_strategy(
            ["2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05"],
            [100.0, 150.0, 150.0, 150.0],
            config,
            normalized=normalized,
            tickers=["AAA", "BBB", "CCC"],
            weights={"AAA": 0.5, "BBB": 0.5, "CCC": 0.0},
            cash_weight=0.0,
        )

        self.assertEqual(config["type"], "portfolio_matrix_dsl")
        self.assertEqual(bt.matrix_dsl_required_tickers(config), {"AAA", "CCC"})
        self.assertEqual(result["values"], [100.0, 150.0, 250.0, 450.0])
        self.assertEqual(result["trades"][0]["action"], "SWAP")
        self.assertEqual(result["trades"][0]["from"], "AAA")
        self.assertEqual(result["trades"][0]["to"], "CCC")
        self.assertEqual(result["parameters"]["execution"], "asset-level allocation events")

    def test_portfolio_matrix_dsl_swap_can_use_run_start_month_offset(self) -> None:
        config = bt.parse_portfolio_strategy_config(
            {
                "strategy": {
                    "name": "6개월 뒤 META를 LLY로 스왑",
                    "type": "portfolio_matrix_dsl",
                    "functionSpec": {
                        "language": "portfolio-matrix-dsl",
                        "program": [
                            {
                                "op": "swap",
                                "fromAsset": "META",
                                "toAsset": "LLY",
                                "effective": {"anchor": "run_start", "offsetMonths": 6, "snap": "next_trading_day"},
                            }
                        ],
                    },
                }
            }
        )
        normalized = pd.DataFrame(
            [
                {"META": 1.0, "LLY": 1.0},
                {"META": 1.2, "LLY": 1.0},
                {"META": 1.2, "LLY": 1.5},
            ]
        )
        result = bt.apply_portfolio_matrix_dsl_strategy(
            ["2026-01-02", "2026-07-02", "2026-07-03"],
            [100.0, 120.0, 120.0],
            config,
            normalized=normalized,
            tickers=["META", "LLY"],
            weights={"META": 1.0, "LLY": 0.0},
            cash_weight=0.0,
        )

        self.assertEqual(result["trades"][0]["date"], "2026-07-02")
        self.assertEqual(result["values"], [100.0, 120.0, 180.0])

    def test_portfolio_matrix_dsl_swap_and_monthly_rebalance_share_one_function_program(self) -> None:
        config = bt.parse_portfolio_strategy_config(
            {
                "strategy": {
                    "name": "스왑 + 월간 리밸런싱",
                    "type": "portfolio_matrix_dsl",
                    "functionSpec": {
                        "language": "portfolio-matrix-dsl",
                        "program": [
                            {
                                "op": "rebalance",
                                "method": "periodic",
                                "frequency": "monthly",
                                "target": "target_weights",
                            },
                            {
                                "op": "swap",
                                "fromAsset": "AAA",
                                "toAsset": "CCC",
                                "effective": {"date": "2026-03-31", "snap": "next_trading_day"},
                            },
                        ],
                    },
                }
            }
        )
        normalized = pd.DataFrame(
            [
                {"AAA": 1.0, "BBB": 1.0, "CCC": 1.0},
                {"AAA": 2.0, "BBB": 1.0, "CCC": 1.0},
                {"AAA": 2.0, "BBB": 1.0, "CCC": 2.0},
                {"AAA": 2.0, "BBB": 2.0, "CCC": 2.0},
                {"AAA": 2.0, "BBB": 2.0, "CCC": 3.0},
                {"AAA": 2.0, "BBB": 3.0, "CCC": 3.0},
                {"AAA": 2.0, "BBB": 3.0, "CCC": 4.0},
            ]
        )
        result = bt.apply_portfolio_matrix_dsl_strategy(
            ["2026-01-30", "2026-01-31", "2026-02-02", "2026-02-27", "2026-03-02", "2026-03-31", "2026-04-01"],
            [100.0, 150.0, 250.0, 300.0, 350.0, 400.0, 450.0],
            config,
            normalized=normalized,
            tickers=["AAA", "BBB", "CCC"],
            weights={"AAA": 0.5, "BBB": 0.5, "CCC": 0.0},
            cash_weight=0.0,
        )

        self.assertEqual(config["type"], "portfolio_matrix_dsl")
        self.assertEqual([trade["action"] for trade in result["trades"]], ["REBALANCE", "REBALANCE", "SWAP", "REBALANCE"])
        self.assertEqual(result["trades"][0]["date"], "2026-01-31")
        self.assertEqual(result["trades"][1]["date"], "2026-02-27")
        self.assertEqual(result["trades"][2]["date"], "2026-03-31")
        self.assertEqual(result["parameters"]["rebalance"]["method"], "periodic")
        self.assertEqual(result["parameters"]["rebalance"]["scope"], "full_period")
        self.assertEqual(result["parameters"]["execution"], "asset-level allocation events with full-period periodic rebalance")

    def test_portfolio_matrix_dsl_conditional_portfolio_swap_reallocates_to_target_weights(self) -> None:
        config = bt.parse_portfolio_strategy_config(
            {
                "strategy": {
                    "name": "A에서 B 포트폴리오로 조건부 전환",
                    "type": "portfolio_matrix_dsl",
                    "functionSpec": {
                        "language": "portfolio-matrix-dsl",
                        "program": [
                            {
                                "op": "portfolio_swap",
                                "when": "close >= 120",
                                "fromLabel": "A 성장주",
                                "toLabel": "B 방어주",
                                "targetWeights": {"BBB": 1},
                            }
                        ],
                    },
                }
            }
        )
        normalized = pd.DataFrame(
            [
                {"AAA": 1.0, "BBB": 1.0},
                {"AAA": 1.2, "BBB": 1.0},
                {"AAA": 1.2, "BBB": 1.5},
            ]
        )
        result = bt.apply_portfolio_matrix_dsl_strategy(
            ["2026-01-02", "2026-01-03", "2026-01-04"],
            [100.0, 120.0, 120.0],
            config,
            normalized=normalized,
            tickers=["AAA", "BBB"],
            weights={"AAA": 1.0, "BBB": 0.0},
            cash_weight=0.0,
        )

        self.assertEqual(config["type"], "portfolio_matrix_dsl")
        self.assertEqual(bt.matrix_dsl_required_tickers(config), {"BBB"})
        self.assertEqual(result["trades"][0]["action"], "PORTFOLIO_SWAP")
        self.assertEqual(result["trades"][0]["date"], "2026-01-03")
        self.assertEqual(result["trades"][0]["from"], "A 성장주")
        self.assertEqual(result["trades"][0]["to"], "B 방어주")
        self.assertEqual(result["values"], [100.0, 120.0, 180.0])
        self.assertEqual(result["parameters"]["execution"], "asset-level allocation events")

    def test_portfolio_matrix_dsl_portfolio_swap_supports_months_since_run_start_condition(self) -> None:
        config = bt.parse_portfolio_strategy_config(
            {
                "strategy": {
                    "name": "6개월 뒤 A에서 B로 이전",
                    "type": "portfolio_matrix_dsl",
                    "functionSpec": {
                        "language": "portfolio-matrix-dsl",
                        "program": [
                            {
                                "op": "portfolio_swap",
                                "when": "months_since_run_start >= 6",
                                "fromLabel": "A",
                                "toLabel": "B",
                                "targetWeights": {"BBB": 1},
                            }
                        ],
                    },
                }
            }
        )
        normalized = pd.DataFrame(
            [
                {"AAA": 1.0, "BBB": 1.0},
                {"AAA": 1.2, "BBB": 1.0},
                {"AAA": 1.2, "BBB": 1.5},
            ]
        )
        result = bt.apply_portfolio_matrix_dsl_strategy(
            ["2026-01-02", "2026-07-02", "2026-07-03"],
            [100.0, 120.0, 120.0],
            config,
            normalized=normalized,
            tickers=["AAA", "BBB"],
            weights={"AAA": 1.0, "BBB": 0.0},
            cash_weight=0.0,
        )

        self.assertEqual(result["trades"][0]["action"], "PORTFOLIO_SWAP")
        self.assertEqual(result["trades"][0]["date"], "2026-07-02")
        self.assertEqual(result["values"], [100.0, 120.0, 180.0])

    def test_portfolio_matrix_dsl_dca_adds_periodic_contributions_and_metrics(self) -> None:
        config = bt.parse_portfolio_strategy_config(
            {
                "strategy": {
                    "name": "월 100 적립식",
                    "type": "portfolio_matrix_dsl",
                    "functionSpec": {
                        "language": "portfolio-matrix-dsl",
                        "program": [
                            {
                                "op": "dca",
                                "amount": 100,
                                "frequency": "monthly",
                                "dayOfMonth": 2,
                                "targetWeights": {"AAA": 1},
                            }
                        ],
                    },
                }
            }
        )
        normalized = pd.DataFrame(
            [
                {"AAA": 1.0},
                {"AAA": 1.1},
                {"AAA": 1.1},
                {"AAA": 1.21},
            ]
        )
        result = bt.apply_portfolio_matrix_dsl_strategy(
            ["2026-01-02", "2026-01-03", "2026-02-02", "2026-02-03"],
            [100.0, 110.0, 110.0, 121.0],
            config,
            normalized=normalized,
            tickers=["AAA"],
            weights={"AAA": 1.0},
            cash_weight=0.0,
        )

        self.assertEqual(config["type"], "portfolio_matrix_dsl")
        self.assertEqual(bt.matrix_dsl_required_tickers(config), {"AAA"})
        self.assertEqual([round(value, 6) for value in result["values"]], [100.0, 110.0, 210.0, 231.0])
        self.assertEqual([trade["action"] for trade in result["trades"]], ["CONTRIBUTE", "CONTRIBUTE"])
        self.assertEqual([trade["date"] for trade in result["trades"]], ["2026-01-02", "2026-02-02"])
        self.assertEqual(result["parameters"]["execution"], "periodic contribution cashflows")
        self.assertEqual(result["metrics"]["metricProfile"], "dca")
        self.assertEqual(result["metrics"]["standard"]["totalContribution"], 200.0)
        self.assertEqual(result["metrics"]["standard"]["netProfit"], 31.0)
        self.assertEqual(result["metrics"]["standard"]["contributionReturn"], 15.5)
        self.assertEqual(result["metrics"]["standard"]["twr"], 21.0)

    def test_portfolio_matrix_dsl_dca_skips_elapsed_monthly_day_at_run_start(self) -> None:
        config = bt.parse_portfolio_strategy_config(
            {
                "strategy": {
                    "name": "월 100 적립식",
                    "type": "portfolio_matrix_dsl",
                    "functionSpec": {
                        "language": "portfolio-matrix-dsl",
                        "program": [
                            {
                                "op": "dca",
                                "amount": 100,
                                "frequency": "monthly",
                                "dayOfMonth": 1,
                                "targetWeights": {"AAA": 1},
                            }
                        ],
                    },
                }
            }
        )
        normalized = pd.DataFrame(
            [
                {"AAA": 1.0},
                {"AAA": 1.1},
                {"AAA": 1.1},
                {"AAA": 1.21},
            ]
        )
        result = bt.apply_portfolio_matrix_dsl_strategy(
            ["2026-01-27", "2026-01-28", "2026-02-02", "2026-02-03"],
            [100.0, 110.0, 110.0, 121.0],
            config,
            normalized=normalized,
            tickers=["AAA"],
            weights={"AAA": 1.0},
            cash_weight=0.0,
        )

        self.assertEqual([round(value, 6) for value in result["values"]], [0.0, 0.0, 100.0, 110.0])
        self.assertEqual([trade["date"] for trade in result["trades"]], ["2026-02-02"])
        self.assertEqual(result["metrics"]["standard"]["totalContribution"], 100.0)

    def test_portfolio_matrix_dsl_rejects_dca_without_amount(self) -> None:
        config = bt.parse_portfolio_strategy_config(
            {
                "strategy": {
                    "name": "금액 없는 적립식",
                    "type": "portfolio_matrix_dsl",
                    "functionSpec": {
                        "language": "portfolio-matrix-dsl",
                        "program": [{"op": "dca", "frequency": "monthly", "targetWeights": {"AAA": 1}}],
                    },
                }
            }
        )

        self.assertEqual(config["type"], "unsupported")
        self.assertIn("positive amount", config["reason"])

    def test_portfolio_matrix_dsl_rejects_incomplete_swap(self) -> None:
        config = bt.parse_portfolio_strategy_config(
            {
                "strategy": {
                    "name": "불완전 스왑",
                    "type": "portfolio_matrix_dsl",
                    "functionSpec": {
                        "language": "portfolio-matrix-dsl",
                        "program": [{"op": "swap", "fromAsset": "META"}],
                    },
                }
            }
        )

        self.assertEqual(config["type"], "unsupported")
        self.assertIn("fromAsset and toAsset", config["reason"])

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
