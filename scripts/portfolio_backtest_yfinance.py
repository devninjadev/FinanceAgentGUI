#!/usr/bin/env python3
import json
import math
import sys
from datetime import datetime, timezone


def emit(payload):
    print(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))


def clean_ticker(value):
    ticker = str(value or "").strip().upper()
    if ticker in {"", "CASH", "CASH.KRW", "KRW", "USD"}:
        return ""
    return ticker


def finite_number(value, fallback=0.0):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return fallback
    return number if math.isfinite(number) else fallback


def max_drawdown(values):
    peak = values[0] if values else 0.0
    worst = 0.0
    for value in values:
        peak = max(peak, value)
        if peak:
            worst = min(worst, (value / peak - 1.0) * 100.0)
    return worst


def annualized_volatility(values):
    if len(values) < 3:
        return 0.0
    returns = []
    for before, after in zip(values[:-1], values[1:]):
        if before:
            returns.append(after / before - 1.0)
    if len(returns) < 2:
        return 0.0
    avg = sum(returns) / len(returns)
    variance = sum((item - avg) ** 2 for item in returns) / (len(returns) - 1)
    return math.sqrt(variance) * math.sqrt(252.0) * 100.0


def daily_returns(values):
    returns = []
    for before, after in zip(values[:-1], values[1:]):
        if before:
            returns.append(after / before - 1.0)
    return returns


def annualized_return(values):
    if len(values) < 2 or not values[0]:
        return 0.0
    total_return = values[-1] / values[0] - 1.0
    years = max((len(values) - 1) / 252.0, 1.0 / 252.0)
    if total_return <= -1.0:
        return -100.0
    return ((1.0 + total_return) ** (1.0 / years) - 1.0) * 100.0


def sharpe_ratio(values):
    returns = daily_returns(values)
    if len(returns) < 2:
        return None
    avg = sum(returns) / len(returns)
    variance = sum((item - avg) ** 2 for item in returns) / (len(returns) - 1)
    stdev = math.sqrt(variance)
    if stdev <= 0:
        return None
    return avg / stdev * math.sqrt(252.0)


def sortino_ratio(values):
    returns = daily_returns(values)
    downside = [min(0.0, item) for item in returns]
    downside = [item for item in downside if item < 0.0]
    if len(returns) < 2 or len(downside) < 2:
        return None
    avg = sum(returns) / len(returns)
    downside_variance = sum(item * item for item in downside) / (len(downside) - 1)
    downside_stdev = math.sqrt(downside_variance)
    if downside_stdev <= 0:
        return None
    return avg / downside_stdev * math.sqrt(252.0)


def ulcer_index(values):
    if not values:
        return 0.0
    peak = values[0]
    drawdowns = []
    for value in values:
        peak = max(peak, value)
        drawdown = (value / peak - 1.0) * 100.0 if peak else 0.0
        drawdowns.append(drawdown)
    if not drawdowns:
        return 0.0
    return math.sqrt(sum(item * item for item in drawdowns) / len(drawdowns))


def beta_against(values, benchmark_values):
    portfolio_returns = daily_returns(values)
    benchmark_returns = daily_returns(benchmark_values)
    length = min(len(portfolio_returns), len(benchmark_returns))
    if length < 2:
        return None
    portfolio_returns = portfolio_returns[-length:]
    benchmark_returns = benchmark_returns[-length:]
    portfolio_avg = sum(portfolio_returns) / length
    benchmark_avg = sum(benchmark_returns) / length
    benchmark_variance = sum((item - benchmark_avg) ** 2 for item in benchmark_returns) / (length - 1)
    if benchmark_variance <= 0:
        return None
    covariance = sum(
        (portfolio_returns[index] - portfolio_avg) * (benchmark_returns[index] - benchmark_avg)
        for index in range(length)
    ) / (length - 1)
    return covariance / benchmark_variance


def standard_metric_row(name, values, benchmark_name="", benchmark_values=None):
    if not values:
        return {}
    ending_value = values[-1]
    cumulative_return = values[-1] / values[0] * 100.0 - 100.0 if values[0] else 0.0
    cagr = annualized_return(values)
    mdd = max_drawdown(values)
    volatility = annualized_volatility(values)
    sharpe = sharpe_ratio(values)
    sortino = sortino_ratio(values)
    ulcer = ulcer_index(values)
    calmar = cagr / abs(mdd) if mdd < 0 else None
    upi = cagr / ulcer if ulcer > 0 else None
    beta = beta_against(values, benchmark_values or []) if benchmark_values else None
    return {
        "name": name,
        "endingValue": safe_round(ending_value, 2),
        "totalContribution": safe_round(ending_value - values[0], 2),
        "cumulativeReturn": safe_round(cumulative_return, 2),
        "cagr": safe_round(cagr, 2),
        "mdd": safe_round(mdd, 2),
        "volatility": safe_round(volatility, 2),
        "sharpe": safe_round(sharpe, 3) if sharpe is not None else None,
        "sortino": safe_round(sortino, 3) if sortino is not None else None,
        "calmar": safe_round(calmar, 3) if calmar is not None else None,
        "ulcer": safe_round(ulcer, 2),
        "upi": safe_round(upi, 3) if upi is not None else None,
        "beta": safe_round(beta, 3) if beta is not None else None,
        "betaBenchmark": benchmark_name,
    }


def safe_round(value, digits=2):
    number = finite_number(value)
    return round(number, digits)


def main():
    try:
        import pandas as pd  # noqa: F401
        import yfinance as yf
    except Exception as exc:
        emit(
            {
                "ok": False,
                "code": "YFINANCE_UNAVAILABLE",
                "error": f"yfinance import failed: {exc}",
                "installHint": "python3 -m pip install yfinance pandas",
            }
        )
        return 0

    try:
        payload = json.load(sys.stdin)
    except Exception as exc:
        emit({"ok": False, "code": "INVALID_JSON", "error": str(exc)})
        return 0

    raw_holdings = payload.get("holdings") or []
    period = str(payload.get("period") or "1y")
    benchmark = clean_ticker(payload.get("benchmark") or "SPY") or "SPY"
    holdings = []
    cash_value = 0.0

    for item in raw_holdings[:80]:
        ticker = clean_ticker(item.get("ticker"))
        value = finite_number(item.get("value"))
        if value <= 0:
            value = finite_number(item.get("weight"))
        if value <= 0:
            value = finite_number(item.get("allocation"))
        if value <= 0:
            value = finite_number(item.get("ratio"))
        if value <= 0:
            continue
        if ticker:
            holdings.append({"ticker": ticker, "value": value})
        else:
            cash_value += value

    total_value = sum(item["value"] for item in holdings) + cash_value
    if not holdings or total_value <= 0:
        emit({"ok": False, "code": "NO_MARKET_HOLDINGS", "error": "No market holdings with positive value were supplied."})
        return 0

    weights = {item["ticker"]: item["value"] / total_value for item in holdings}
    cash_weight = cash_value / total_value if total_value else 0.0
    tickers = sorted(set(weights) | {benchmark})
    issues = []

    try:
        data = yf.download(
            tickers=tickers,
            period=period,
            interval="1d",
            auto_adjust=True,
            progress=False,
            threads=True,
        )
    except Exception as exc:
        emit({"ok": False, "code": "YFINANCE_DOWNLOAD_FAILED", "error": str(exc), "tickers": tickers})
        return 0

    if data is None or data.empty:
        emit({"ok": False, "code": "YFINANCE_EMPTY_DATA", "error": "No price data returned from yfinance.", "tickers": tickers})
        return 0

    if hasattr(data.columns, "nlevels") and data.columns.nlevels > 1:
        if "Close" in data.columns.get_level_values(0):
            close = data["Close"].copy()
        else:
            emit({"ok": False, "code": "YFINANCE_CLOSE_MISSING", "error": "Close price columns were not found."})
            return 0
    elif "Close" in data:
        close = data[["Close"]].copy()
        close.columns = [tickers[0]]
    else:
        close = data.copy()

    if not hasattr(close, "columns"):
        close = close.to_frame(name=tickers[0])

    close = close.sort_index().ffill().dropna(how="all")
    valid_tickers = [ticker for ticker in weights if ticker in close.columns and close[ticker].dropna().shape[0] >= 2]
    missing_tickers = [ticker for ticker in weights if ticker not in valid_tickers]
    for ticker in missing_tickers:
        issues.append({"code": "MISSING_PRICE_HISTORY", "ticker": ticker})

    if not valid_tickers:
        emit({"ok": False, "code": "NO_VALID_PRICE_HISTORY", "error": "No supplied tickers had enough yfinance price history.", "issues": issues})
        return 0

    valid_weight_sum = sum(weights[ticker] for ticker in valid_tickers)
    benchmark_valid = benchmark in close.columns and close[benchmark].dropna().shape[0] >= 2
    close = close[valid_tickers + ([benchmark] if benchmark_valid and benchmark not in valid_tickers else [])].dropna(how="all").ffill().dropna()
    if close.empty:
        emit({"ok": False, "code": "ALIGNED_HISTORY_EMPTY", "error": "Aligned price history is empty after cleaning.", "issues": issues})
        return 0

    base = close.iloc[0]
    normalized = close.divide(base).replace([float("inf"), float("-inf")], float("nan")).dropna()
    if normalized.empty:
        emit({"ok": False, "code": "NORMALIZED_HISTORY_EMPTY", "error": "Normalized price history is empty.", "issues": issues})
        return 0

    portfolio_values = []
    for _, row in normalized.iterrows():
        weighted = cash_weight
        for ticker in valid_tickers:
            adjusted_weight = weights[ticker]
            if valid_weight_sum > 0:
                adjusted_weight += (1.0 - cash_weight - valid_weight_sum) * (weights[ticker] / valid_weight_sum)
            weighted += adjusted_weight * finite_number(row[ticker], 1.0)
        portfolio_values.append(weighted * 100.0)

    benchmark_values = []
    if benchmark_valid and benchmark in normalized.columns:
        benchmark_values = [finite_number(value, 1.0) * 100.0 for value in normalized[benchmark].tolist()]
    else:
        issues.append({"code": "BENCHMARK_PRICE_HISTORY_MISSING", "ticker": benchmark})

    dates = [idx.strftime("%Y-%m-%d") for idx in normalized.index]
    series = []
    for index, date in enumerate(dates):
        row = {
            "date": date,
            "portfolio": safe_round(portfolio_values[index], 2),
        }
        if benchmark_values:
            row["benchmark"] = safe_round(benchmark_values[index], 2)
        series.append(row)

    metrics = {
        "periodStart": dates[0],
        "periodEnd": dates[-1],
        "tradingDays": len(series),
        "portfolioReturn": safe_round(portfolio_values[-1] / portfolio_values[0] * 100.0 - 100.0, 2),
        "portfolioMaxDrawdown": safe_round(max_drawdown(portfolio_values), 2),
        "portfolioAnnualizedVolatility": safe_round(annualized_volatility(portfolio_values), 2),
        "benchmarkReturn": safe_round(benchmark_values[-1] / benchmark_values[0] * 100.0 - 100.0, 2) if benchmark_values else None,
        "benchmarkMaxDrawdown": safe_round(max_drawdown(benchmark_values), 2) if benchmark_values else None,
        "cashWeight": safe_round(cash_weight * 100.0, 2),
        "pricedWeight": safe_round(valid_weight_sum * 100.0, 2),
    }
    metrics["standard"] = standard_metric_row("Portfolio", portfolio_values, benchmark, benchmark_values)
    if benchmark_values:
        benchmark_standard = standard_metric_row(benchmark, benchmark_values, benchmark, benchmark_values)
        benchmark_standard["beta"] = 1.0
        metrics["benchmarkStandard"] = benchmark_standard

    emit(
        {
            "ok": True,
            "source": "yfinance",
            "methodology": "Current values or supplied weights are normalized and applied to adjusted daily close history; cash is modeled as flat NAV.",
            "fetchedAt": datetime.now(timezone.utc).isoformat(),
            "period": period,
            "benchmark": benchmark,
            "tickers": valid_tickers,
            "issues": issues,
            "metrics": metrics,
            "series": series,
        }
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
