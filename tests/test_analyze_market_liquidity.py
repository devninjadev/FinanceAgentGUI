from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path
from unittest import mock

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
SCRIPT_PATH = ROOT / "scripts" / "analyze_market.py"
SPEC = importlib.util.spec_from_file_location("analyze_market_liquidity", SCRIPT_PATH)
assert SPEC and SPEC.loader
analyze_market = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = analyze_market
SPEC.loader.exec_module(analyze_market)


class AnalyzeMarketLiquidityTest(unittest.TestCase):
    def test_net_liquidity_aligns_weekly_components_and_converts_rrp_units(self) -> None:
        dates = pd.date_range("2026-04-22", periods=14, freq="W-WED")
        walcl = pd.Series([8_000_000.0] * 14, index=dates)
        wdtgal = pd.Series(
            [1_000_000.0 - (10_000.0 * index) for index in range(14)],
            index=dates,
        )
        daily_dates = pd.date_range(dates[0], dates[-1], freq="B")
        rrpontsyd = pd.Series([100.0] * len(daily_dates), index=daily_dates)

        result = analyze_market._build_us_net_liquidity_summary(
            walcl,
            wdtgal,
            rrpontsyd,
        )

        self.assertEqual(result["formula"], "WALCL - WDTGAL - (RRPONTSYD × 1000)")
        self.assertEqual(result["date"], dates[-1].strftime("%Y-%m-%d"))
        self.assertAlmostEqual(result["last_usd_trillions"], 7.03)
        self.assertAlmostEqual(result["delta_1w_usd_billions"], 10.0)
        self.assertAlmostEqual(result["delta_4w_usd_billions"], 40.0)
        self.assertAlmostEqual(result["delta_13w_usd_billions"], 130.0)
        self.assertEqual(result["trend_4w"], "INJECTING")
        self.assertAlmostEqual(result["walcl_usd_trillions"], 8.0)
        self.assertAlmostEqual(result["tga_usd_billions"], 870.0)
        self.assertAlmostEqual(result["rrp_usd_billions"], 100.0)

    def test_fred_snapshot_keeps_credit_conditions_and_net_liquidity_separate(self) -> None:
        dates = pd.date_range("2026-04-22", periods=14, freq="W-WED")
        nfcirisk = pd.Series([-0.4 - (index * 0.01) for index in range(14)], index=dates)
        walcl = pd.Series([8_000_000.0] * 14, index=dates)
        wdtgal = pd.Series([900_000.0] * 14, index=dates)
        rrpontsyd = pd.Series([50.0] * 14, index=dates)
        series = {
            "NFCIRISK": nfcirisk,
            "WALCL": walcl,
            "WDTGAL": wdtgal,
            "RRPONTSYD": rrpontsyd,
        }

        with mock.patch.object(
            analyze_market,
            "_fetch_fred_series",
            side_effect=lambda series_id: series[series_id],
        ):
            result = analyze_market.fetch_fred_snapshot()

        self.assertEqual(result["errors"], [])
        self.assertIn("NFCIRISK", result["indicators"])
        self.assertIn("US_NET_LIQUIDITY", result["indicators"])
        self.assertNotEqual(
            result["indicators"]["NFCIRISK"],
            result["indicators"]["US_NET_LIQUIDITY"],
        )

    def test_missing_component_reports_data_gap_without_partial_proxy(self) -> None:
        dates = pd.date_range("2026-04-22", periods=14, freq="W-WED")
        series = {
            "NFCIRISK": pd.Series([-0.5] * 14, index=dates),
            "WALCL": pd.Series([8_000_000.0] * 14, index=dates),
            "WDTGAL": pd.Series([900_000.0] * 14, index=dates),
            "RRPONTSYD": pd.Series(dtype=float),
        }

        with mock.patch.object(
            analyze_market,
            "_fetch_fred_series",
            side_effect=lambda series_id: series[series_id],
        ):
            result = analyze_market.fetch_fred_snapshot()

        self.assertNotIn("US_NET_LIQUIDITY", result["indicators"])
        self.assertIn(
            "US_NET_LIQUIDITY unavailable: missing RRPONTSYD",
            result["errors"],
        )

    def test_market_only_cli_skips_feed_contract(self) -> None:
        args = analyze_market.parse_args(["--market-only"])

        self.assertTrue(args.market_only)


if __name__ == "__main__":
    unittest.main()
