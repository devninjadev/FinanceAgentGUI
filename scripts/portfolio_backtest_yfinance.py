#!/usr/bin/env python3
import json
import math
import re
import sys
import calendar
from datetime import datetime, timedelta, timezone


def emit(payload):
    print(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))


def clean_ticker(value):
    ticker = str(value or "").strip().upper()
    if ticker in {"", "CASH", "CASH.KRW", "KRW", "USD"}:
        return ""
    return ticker


def clean_label(value, fallback=""):
    text = str(value or "").strip()
    if not text or text == "[object Object]":
        return fallback
    return text[:120]


def finite_number(value, fallback=0.0):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return fallback
    return number if math.isfinite(number) else fallback


def payload_bool(value, default=True):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    text = str(value).strip().lower()
    if text in {"", "false", "0", "no", "none", "off", "without", "disabled", "없음", "제외", "미사용"}:
        return False
    if text in {"true", "1", "yes", "on", "enabled"}:
        return True
    return default


def clean_iso_date(value):
    text = str(value or "").strip()
    if not text:
        return ""
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date().isoformat()
    except ValueError:
        pass
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y.%m.%d"):
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            continue
    return ""


def yfinance_exclusive_end_date(value):
    cleaned = clean_iso_date(value)
    if not cleaned:
        return ""
    try:
        return (datetime.strptime(cleaned, "%Y-%m-%d") + timedelta(days=1)).date().isoformat()
    except ValueError:
        return cleaned


def add_calendar_months(value, months):
    cleaned = clean_iso_date(value)
    if not cleaned:
        return ""
    try:
        parsed = datetime.strptime(cleaned, "%Y-%m-%d").date()
    except ValueError:
        return cleaned
    month_index = parsed.month - 1 + int(finite_number(months, 0) or 0)
    year = parsed.year + month_index // 12
    month = month_index % 12 + 1
    day = min(parsed.day, calendar.monthrange(year, month)[1])
    return datetime(year, month, day).date().isoformat()


def add_calendar_days(value, days):
    cleaned = clean_iso_date(value)
    if not cleaned:
        return ""
    try:
        return (datetime.strptime(cleaned, "%Y-%m-%d").date() + timedelta(days=int(finite_number(days, 0) or 0))).isoformat()
    except ValueError:
        return cleaned


def full_calendar_months_between(start_value, current_value):
    start = clean_iso_date(start_value)
    current = clean_iso_date(current_value)
    if not start or not current:
        return 0
    try:
        start_date = datetime.strptime(start, "%Y-%m-%d").date()
        current_date = datetime.strptime(current, "%Y-%m-%d").date()
    except ValueError:
        return 0
    months = (current_date.year - start_date.year) * 12 + (current_date.month - start_date.month)
    if months <= 0:
        return max(0, months)
    anniversary_day = min(start_date.day, calendar.monthrange(current_date.year, current_date.month)[1])
    if current_date.day < anniversary_day:
        months -= 1
    return max(0, months)


def elapsed_days_between(start_value, current_value):
    start = clean_iso_date(start_value)
    current = clean_iso_date(current_value)
    if not start or not current:
        return 0
    try:
        start_date = datetime.strptime(start, "%Y-%m-%d").date()
        current_date = datetime.strptime(current, "%Y-%m-%d").date()
    except ValueError:
        return 0
    return max(0, (current_date - start_date).days)


def yfinance_interval(value):
    text = str(value or "1d").strip().lower()
    aliases = {
        "daily": "1d",
        "day": "1d",
        "d": "1d",
        "weekly": "1wk",
        "week": "1wk",
        "w": "1wk",
        "monthly": "1mo",
        "month": "1mo",
        "m": "1mo",
    }
    normalized = aliases.get(text, text)
    allowed = {"1d", "5d", "1wk", "1mo", "3mo"}
    return normalized if normalized in allowed else "1d"


def list_like(value):
    if isinstance(value, list):
        return value
    if value in (None, ""):
        return []
    return [value]


def parse_portfolio_holdings(raw_holdings):
    holdings = []
    cash_value = 0.0
    for item in list_like(raw_holdings)[:80]:
        if not isinstance(item, dict):
            continue
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
    weights = {item["ticker"]: item["value"] / total_value for item in holdings} if total_value > 0 else {}
    cash_weight = cash_value / total_value if total_value > 0 else 0.0
    return holdings, cash_value, total_value, weights, cash_weight


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


def xirr_cashflows(cashflows):
    if not cashflows or len(cashflows) < 2:
        return None
    dated = []
    for date_value, amount in cashflows:
        date = clean_iso_date(date_value)
        number = finite_number(amount, None)
        if date and number is not None:
            dated.append((date, number))
    if len(dated) < 2:
        return None
    has_negative = any(amount < 0 for _, amount in dated)
    has_positive = any(amount > 0 for _, amount in dated)
    if not has_negative or not has_positive:
        return None
    start = datetime.strptime(dated[0][0], "%Y-%m-%d").date()

    def xnpv(rate):
        total = 0.0
        base = 1.0 + rate
        if base <= 0:
            return float("inf")
        for date_value, amount in dated:
            current = datetime.strptime(date_value, "%Y-%m-%d").date()
            years = (current - start).days / 365.25
            total += amount / (base ** years)
        return total

    low = -0.9999
    high = 10.0
    low_value = xnpv(low)
    high_value = xnpv(high)
    expand_count = 0
    while low_value * high_value > 0 and high < 1000 and expand_count < 8:
        high *= 2
        high_value = xnpv(high)
        expand_count += 1
    if low_value * high_value > 0:
        return None
    for _ in range(120):
        mid = (low + high) / 2.0
        mid_value = xnpv(mid)
        if abs(mid_value) < 1e-7:
            return mid * 100.0
        if low_value * mid_value <= 0:
            high = mid
            high_value = mid_value
        else:
            low = mid
            low_value = mid_value
    return ((low + high) / 2.0) * 100.0


def dca_metric_row(name, values, cashflows, contribution_count, twr_factor, end_date="", benchmark_name="", benchmark_values=None):
    row = standard_metric_row(name, values, benchmark_name, benchmark_values)
    total_contribution = -sum(amount for _, amount in cashflows if amount < 0)
    ending_value = values[-1] if values else 0.0
    net_profit = ending_value - total_contribution
    contribution_return = net_profit / total_contribution * 100.0 if total_contribution > 0 else None
    final_date = clean_iso_date(end_date) or (cashflows[-1][0] if cashflows else "")
    irr = xirr_cashflows([*cashflows, (final_date, ending_value)]) if cashflows else None
    average_contribution = total_contribution / contribution_count if contribution_count > 0 else None
    row.update(
        {
            "endingValue": safe_round(ending_value, 2),
            "totalContribution": safe_round(total_contribution, 2),
            "netProfit": safe_round(net_profit, 2),
            "cumulativeReturn": safe_round(contribution_return, 2) if contribution_return is not None else None,
            "contributionReturn": safe_round(contribution_return, 2) if contribution_return is not None else None,
            "irr": safe_round(irr, 2) if irr is not None else None,
            "twr": safe_round((twr_factor - 1.0) * 100.0, 2) if twr_factor > 0 else None,
            "contributionCount": contribution_count,
            "averageContribution": safe_round(average_contribution, 2) if average_contribution is not None else None,
        }
    )
    return row


def extract_price_frame(data, tickers, field):
    if data is None or data.empty:
        return None
    if hasattr(data.columns, "nlevels") and data.columns.nlevels > 1:
        level0 = list(data.columns.get_level_values(0))
        level1 = list(data.columns.get_level_values(1))
        if field in level0:
            frame = data[field].copy()
        elif field in level1:
            frame = data.xs(field, level=1, axis=1).copy()
        else:
            return None
    elif field in data:
        frame = data[[field]].copy()
        frame.columns = [tickers[0]]
    elif field == "Close":
        frame = data.copy()
    else:
        return None

    if not hasattr(frame, "columns"):
        frame = frame.to_frame(name=tickers[0])
    frame.columns = [clean_ticker(column) or str(column).strip().upper() for column in frame.columns]
    return frame.sort_index().ffill().dropna(how="all")


def backtest_strategy_source_text(strategy, function_spec):
    rules = strategy.get("rules") or function_spec.get("rules") or []
    if not isinstance(rules, list):
        rules = []
    text_parts = [
        strategy.get("name"),
        strategy.get("title"),
        strategy.get("kind"),
        strategy.get("type"),
        function_spec.get("language"),
        function_spec.get("executionMode"),
    ]
    for rule in rules:
        if isinstance(rule, dict):
            text_parts.extend([rule.get("when"), rule.get("action"), rule.get("note")])
        else:
            text_parts.append(rule)
    return " ".join(str(part or "") for part in text_parts)


def portfolio_strategy_config_parsers():
    return (parse_portfolio_matrix_dsl_strategy_config,)


def parse_portfolio_strategy_config(payload):
    strategy = payload.get("strategy")
    if not isinstance(strategy, dict):
        return None

    function_spec = strategy.get("functionSpec") if isinstance(strategy.get("functionSpec"), dict) else {}
    source = backtest_strategy_source_text(strategy, function_spec)
    for parser in portfolio_strategy_config_parsers():
        config = parser(source, strategy, function_spec)
        if config:
            return config
    return {
        "type": "unsupported",
        "name": clean_label(strategy.get("name") or strategy.get("title"), "Strategy"),
        "reason": "Only portfolio-matrix-dsl function widgets are executable. strategy-dsl, signal-rules, periodic_rebalance, threshold_rebalance, Supertrend, built-in indicator signals, external CSV signals, and universe rotation legacy routes have been removed.",
    }


def parse_backtest_strategy_config(payload):
    return parse_portfolio_strategy_config(payload)


def portfolio_nav_from_normalized(normalized, tickers, weights, cash_weight):
    if normalized is None or normalized.empty or not tickers:
        return []
    valid_weight_sum = sum(weights.get(ticker, 0.0) for ticker in tickers)
    adjusted_weights = {}
    for ticker in tickers:
        adjusted_weight = weights.get(ticker, 0.0)
        if valid_weight_sum > 0:
            adjusted_weight += (1.0 - cash_weight - valid_weight_sum) * (weights.get(ticker, 0.0) / valid_weight_sum)
        adjusted_weights[ticker] = adjusted_weight
    values = []
    for _, row in normalized.iterrows():
        weighted_close = cash_weight
        for ticker in tickers:
            weighted_close += adjusted_weights[ticker] * finite_number(row.get(ticker), 1.0)
        values.append(weighted_close * 100.0)
    return values


def matrix_dsl_threshold_band_drift(asset_values, cash_value, weights, cash_weight, config):
    total_value = cash_value + sum(asset_values.values())
    if total_value <= 0:
        return 0.0
    current_weights = {ticker: value / total_value for ticker, value in asset_values.items()}
    condition_assets = [ticker for ticker in config.get("conditionAssets") or [] if ticker in current_weights]
    if len(condition_assets) >= 2:
        return abs(current_weights.get(condition_assets[0], 0.0) - current_weights.get(condition_assets[1], 0.0))
    drift_values = [abs(current_weights.get(ticker, 0.0) - weights.get(ticker, 0.0)) for ticker in asset_values]
    if cash_weight > 0:
        drift_values.append(abs(cash_value / total_value - cash_weight))
    return max(drift_values or [0.0])


def normalize_rebalance_target_weights(weights, cash_weight, available_tickers):
    target_weights = {
        ticker: max(0.0, finite_number((weights or {}).get(ticker), 0.0))
        for ticker in available_tickers
    }
    target_sum = sum(target_weights.values())
    target_cash_weight = max(0.0, finite_number(cash_weight, 0.0))
    total_target = target_sum + target_cash_weight
    if total_target > 1.0001:
        target_weights = {ticker: value / total_target for ticker, value in target_weights.items()}
        target_cash_weight = target_cash_weight / total_target
    return target_weights, target_cash_weight


def apply_target_weight_rebalance(asset_values, total_value, target_weights, target_cash_weight, available_tickers):
    next_values = {
        ticker: total_value * max(0.0, finite_number(target_weights.get(ticker), 0.0))
        for ticker in available_tickers
    }
    next_cash = total_value * max(0.0, finite_number(target_cash_weight, 0.0))
    allocated = next_cash + sum(next_values.values())
    if allocated < total_value:
        next_cash += total_value - allocated
    return next_values, next_cash


def matrix_dsl_periodic_rebalance_due(current_date, next_date, config):
    if not current_date or not next_date:
        return False
    frequency = matrix_dsl_dca_frequency(config.get("frequency"))
    try:
        current = datetime.strptime(current_date, "%Y-%m-%d").date()
        following = datetime.strptime(next_date, "%Y-%m-%d").date()
    except ValueError:
        return False
    if frequency == "quarterly":
        return (current.year, (current.month - 1) // 3) != (following.year, (following.month - 1) // 3)
    if frequency == "weekly":
        return current.isocalendar()[:2] != following.isocalendar()[:2]
    return (current.year, current.month) != (following.year, following.month)


def apply_matrix_dsl_periodic_rebalance(dates, normalized, tickers, weights, cash_weight, config):
    if not dates or normalized is None or normalized.empty or not tickers:
        return None

    available_tickers = [ticker for ticker in tickers if ticker in normalized.columns]
    if not available_tickers:
        return None
    target_weights, target_cash_weight = normalize_rebalance_target_weights(weights or {}, cash_weight, available_tickers)
    asset_values = {ticker: 100.0 * target_weights.get(ticker, 0.0) for ticker in available_tickers}
    cash_value = 100.0 * target_cash_weight
    values = [cash_value + sum(asset_values.values())]
    trades = []

    for index in range(1, len(dates)):
        previous_row = normalized.iloc[index - 1]
        current_row = normalized.iloc[index]
        for ticker in available_tickers:
            before = finite_number(previous_row.get(ticker), 1.0)
            after = finite_number(current_row.get(ticker), before)
            if before > 0:
                asset_values[ticker] *= after / before

        total_value = cash_value + sum(asset_values.values())
        values.append(total_value)

        next_date = dates[index + 1] if index + 1 < len(dates) else ""
        if next_date and matrix_dsl_periodic_rebalance_due(dates[index], next_date, config):
            asset_values, cash_value = apply_target_weight_rebalance(
                asset_values,
                total_value,
                target_weights,
                target_cash_weight,
                available_tickers,
            )
            trades.append(
                {
                    "date": dates[index],
                    "action": "REBALANCE",
                    "frequency": matrix_dsl_dca_frequency(config.get("frequency")),
                    "reason": f"full-period {matrix_dsl_dca_frequency(config.get('frequency'))} portfolio-matrix-dsl periodic rebalance",
                }
            )

    return {
        "values": values,
        "trades": trades,
        "exposurePct": 100.0,
        "parameters": {
            "frequency": matrix_dsl_dca_frequency(config.get("frequency")),
            "method": "periodic",
        },
        "issues": [],
    }


def apply_matrix_dsl_threshold_band_rebalance(dates, normalized, tickers, weights, cash_weight, config):
    if not dates or normalized is None or normalized.empty or not tickers:
        return None

    threshold = max(0.0001, min(1.0, finite_number(config.get("threshold"), 0.10)))
    asset_values = {ticker: 100.0 * weights.get(ticker, 0.0) for ticker in tickers}
    cash_value = 100.0 * cash_weight
    values = [cash_value + sum(asset_values.values())]
    trades = []

    for index in range(1, len(dates)):
        previous_row = normalized.iloc[index - 1]
        current_row = normalized.iloc[index]
        for ticker in tickers:
            before = finite_number(previous_row.get(ticker), 1.0)
            after = finite_number(current_row.get(ticker), before)
            if before > 0:
                asset_values[ticker] *= after / before

        total_value = cash_value + sum(asset_values.values())
        values.append(total_value)

        next_date = dates[index + 1] if index + 1 < len(dates) else ""
        if next_date and matrix_dsl_threshold_band_drift(asset_values, cash_value, weights, cash_weight, config) >= threshold:
            asset_values = {ticker: total_value * weights.get(ticker, 0.0) for ticker in tickers}
            cash_value = total_value * cash_weight
            trades.append(
                {
                    "date": dates[index],
                    "action": "REBALANCE",
                    "reason": f"{threshold * 100.0:g}%p portfolio-matrix-dsl threshold_band rebalance",
                }
            )

    return {
        "values": values,
        "trades": trades,
        "exposurePct": 100.0,
        "parameters": {
            "threshold": safe_round(threshold * 100.0, 2),
            "conditionAssets": config.get("conditionAssets") or [],
        },
    }


def matrix_dsl_program(function_spec):
    program = function_spec.get("program") if isinstance(function_spec, dict) else []
    return program if isinstance(program, list) else []


def matrix_dsl_target_position(value):
    if value is None:
        return None
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        if re.match(r"^(?:carry|carry_forward|hold|유지)$", text, flags=re.IGNORECASE):
            return None
        if text.endswith("%"):
            number = finite_number(text[:-1], None)
            return None if number is None else max(0.0, min(1.0, number / 100.0))
        action_text = text.upper()
        if action_text in {"BUY", "LONG"}:
            return 1.0
        if action_text in {"SELL", "CLOSE", "FLAT", "CASH"}:
            return 0.0
    number = finite_number(value, None)
    return None if number is None else max(0.0, min(1.0, number))


def normalize_signal_matrix_target_rows(signal_matrix):
    if not isinstance(signal_matrix, dict):
        return []
    rows = signal_matrix.get("rows")
    if not isinstance(rows, list):
        return []
    normalized = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        field = matrix_dsl_identifier(row.get("field") or row.get("name"), "").lower()
        if field != "target_weight":
            continue
        date = clean_iso_date(row.get("effectiveDate") or row.get("date"))
        target = matrix_dsl_target_position(row.get("value"))
        if not date or target is None:
            continue
        normalized.append(
            {
                "date": date,
                "target": target,
                "asset": clean_ticker(row.get("asset") or row.get("ticker") or row.get("symbol")),
                "ruleId": clean_label(row.get("ruleId") or row.get("id"), ""),
                "reason": clean_label(row.get("signal") or row.get("condition") or row.get("note") or row.get("source"), "signal_matrix target_weight"),
            }
        )
    return sorted(normalized, key=lambda item: item["date"])


def clean_matrix_dsl_op(step):
    if not isinstance(step, dict):
        return ""
    return clean_label(step.get("op") or step.get("type"), "").strip().lower()


def matrix_dsl_effective_spec(value, step=None):
    step = step if isinstance(step, dict) else {}
    def bounded_int(raw, fallback=0):
        number = finite_number(raw, fallback)
        return int(number if number is not None else (fallback if fallback is not None else 0))

    if isinstance(value, dict):
        date = clean_iso_date(value.get("date") or value.get("effectiveDate"))
        return {
            "date": date,
            "anchor": clean_label(value.get("anchor") or "run_start", "run_start"),
            "offsetMonths": bounded_int(value.get("offsetMonths") or value.get("months"), 0),
            "offsetDays": bounded_int(value.get("offsetDays") or value.get("days"), 0),
            "snap": clean_label(value.get("snap") or value.get("roll") or value.get("tradingDay"), "next_trading_day"),
            "text": clean_label(value.get("text"), ""),
        }
    text = str(value or "").strip()
    date = clean_iso_date(text)
    months_match = re.search(r"(\d+)\s*(?:months?|개월)", text, flags=re.IGNORECASE)
    days_match = re.search(r"(\d+)\s*(?:days?|일)", text, flags=re.IGNORECASE)
    return {
        "date": date or clean_iso_date(step.get("date") or step.get("effectiveDate")),
        "anchor": clean_label(step.get("anchor") or "run_start", "run_start"),
        "offsetMonths": bounded_int(step.get("offsetMonths"), None) if step.get("offsetMonths") not in (None, "") else bounded_int(months_match.group(1), 0) if months_match else 0,
        "offsetDays": bounded_int(step.get("offsetDays"), None) if step.get("offsetDays") not in (None, "") else bounded_int(days_match.group(1), 0) if days_match else 0,
        "snap": clean_label(step.get("snap") or ("previous_trading_day" if re.search(r"previous|prev|직전", text, flags=re.IGNORECASE) else "next_trading_day"), "next_trading_day"),
        "text": text,
    }


def matrix_dsl_weight_map(value):
    raw_items = []
    if isinstance(value, dict):
        for ticker, weight in value.items():
            cleaned_ticker = clean_ticker(ticker)
            number = finite_number(weight, None)
            if cleaned_ticker and number is not None and number > 0:
                raw_items.append((cleaned_ticker, number))
    elif isinstance(value, list):
        for item in value:
            if not isinstance(item, dict):
                continue
            ticker = clean_ticker(item.get("ticker") or item.get("asset") or item.get("symbol") or item.get("name"))
            number = finite_number(
                item.get("weight")
                if item.get("weight") not in (None, "")
                else item.get("value")
                if item.get("value") not in (None, "")
                else item.get("allocation")
                if item.get("allocation") not in (None, "")
                else item.get("ratio"),
                None,
            )
            if ticker and number is not None and number > 0:
                raw_items.append((ticker, number))
    if not raw_items:
        return {}
    merged = {}
    for ticker, weight in raw_items:
        merged[ticker] = merged.get(ticker, 0.0) + weight
    total = sum(merged.values())
    if total > 1.0001:
        merged = {ticker: weight / total for ticker, weight in merged.items()}
    return {ticker: weight for ticker, weight in merged.items() if weight > 0}


def matrix_dsl_portfolio_swap_target_weights(step):
    if not isinstance(step, dict):
        return {}
    for key in ("targetWeights", "toWeights", "weights", "allocation", "targetAllocation"):
        weights = matrix_dsl_weight_map(step.get(key))
        if weights:
            return weights
    for key in ("toPortfolio", "targetPortfolio", "portfolioB"):
        source = step.get(key)
        if isinstance(source, dict):
            weights = matrix_dsl_weight_map(source.get("weights") or source.get("holdings") or source.get("allocation"))
            if weights:
                return weights
    return {}


def matrix_dsl_dca_target_weights(step):
    if not isinstance(step, dict):
        return {}
    for key in ("targetWeights", "contributionWeights", "buyWeights", "weights", "allocation", "targetAllocation"):
        weights = matrix_dsl_weight_map(step.get(key))
        if weights:
            return weights
    for key in ("targetPortfolio", "portfolio", "portfolioB"):
        source = step.get(key)
        if isinstance(source, dict):
            weights = matrix_dsl_weight_map(source.get("weights") or source.get("holdings") or source.get("allocation"))
            if weights:
                return weights
    return {}


def matrix_dsl_dca_frequency(value):
    text = clean_label(value, "monthly").strip().lower().replace("-", "_").replace(" ", "_")
    aliases = {
        "d": "daily",
        "day": "daily",
        "daily": "daily",
        "매일": "daily",
        "w": "weekly",
        "week": "weekly",
        "weekly": "weekly",
        "매주": "weekly",
        "biweekly": "biweekly",
        "two_week": "biweekly",
        "every_2_weeks": "biweekly",
        "격주": "biweekly",
        "m": "monthly",
        "month": "monthly",
        "monthly": "monthly",
        "매월": "monthly",
        "q": "quarterly",
        "quarter": "quarterly",
        "quarterly": "quarterly",
        "분기": "quarterly",
        "매분기": "quarterly",
    }
    return aliases.get(text, "monthly")


def matrix_dsl_dca_amount(step):
    if not isinstance(step, dict):
        return None
    for key in ("amount", "contributionAmount", "depositAmount", "periodicAmount", "installmentAmount", "monthlyAmount", "value"):
        if step.get(key) not in (None, ""):
            amount = finite_number(step.get(key), None)
            return amount if amount and amount > 0 else None
    return None


def matrix_dsl_dca_configs(program):
    configs = []
    for index, step in enumerate(program or []):
        if not isinstance(step, dict):
            continue
        op = clean_matrix_dsl_op(step)
        if op not in {"dca", "contribution", "cashflow", "deposit", "periodic_buy"}:
            continue
        amount = matrix_dsl_dca_amount(step)
        if amount is None:
            continue
        condition_source = step.get("condition") or step.get("if")
        condition = clean_label(condition_source, "")
        condition_expr = matrix_dsl_parse_expression(condition_source) if condition_source not in (None, "") else None
        if condition and not condition_expr:
            continue
        configs.append(
            {
                "type": "dca",
                "amount": amount,
                "frequency": matrix_dsl_dca_frequency(
                    step.get("frequency")
                    or step.get("cadence")
                    or step.get("interval")
                    or ("monthly" if step.get("monthlyAmount") not in (None, "") else "monthly")
                ),
                "targetWeights": matrix_dsl_dca_target_weights(step),
                "effective": matrix_dsl_effective_spec(
                    step.get("effective") or step.get("start") or step.get("startDate") or step.get("dateRule"),
                    step,
                ),
                "endDate": clean_iso_date(step.get("endDate") or step.get("until")),
                "dayOfMonth": max(1, min(31, int(finite_number(step.get("dayOfMonth") or step.get("day"), 1) or 1))),
                "maxContributions": max(0, int(finite_number(step.get("maxContributions") or step.get("count") or step.get("installments"), 0) or 0)),
                "condition": condition,
                "conditionExpr": condition_expr,
                "ruleId": clean_label(step.get("ruleId") or step.get("id"), f"dca_{index + 1}"),
                "reason": clean_label(step.get("note") or step.get("reason"), "periodic contribution"),
            }
        )
    return configs


def matrix_dsl_dca_op_count(program):
    count = 0
    for step in program or []:
        if not isinstance(step, dict):
            continue
        if clean_matrix_dsl_op(step) in {"dca", "contribution", "cashflow", "deposit", "periodic_buy"}:
            count += 1
    return count


def matrix_dsl_allocation_event_type(op, step):
    raw_type = clean_label(
        step.get("eventType") or step.get("event") or step.get("kind") or step.get("method") or step.get("action"),
        "",
    ).strip().lower()
    if op == "portfolio_swap":
        return "portfolio_swap"
    if raw_type:
        return raw_type
    if op == "swap":
        return "swap"
    if matrix_dsl_portfolio_swap_target_weights(step):
        return "portfolio_swap"
    return "swap"


def matrix_dsl_allocation_events(program):
    events = []
    for index, step in enumerate(program or []):
        if not isinstance(step, dict):
            continue
        op = clean_matrix_dsl_op(step)
        if op not in {"swap", "portfolio_swap", "allocation_event"}:
            continue
        event_type = matrix_dsl_allocation_event_type(op, step)
        if event_type in {"portfolio_swap", "portfolio_allocation_swap", "allocation_swap", "target_weights"}:
            target_weights = matrix_dsl_portfolio_swap_target_weights(step)
            condition_source = step.get("expr") or step.get("condition") or step.get("if") or step.get("when")
            condition = clean_label(condition_source, "")
            condition_expr = matrix_dsl_parse_expression(condition_source) if condition_source not in (None, "") else None
            if not target_weights or (condition and not condition_expr):
                continue
            effective = matrix_dsl_effective_spec(
                step.get("effective") or step.get("dateRule") or step.get("date") or step.get("effectiveDate"),
                step,
            )
            events.append(
                {
                    "type": "portfolio_swap",
                    "targetWeights": target_weights,
                    "condition": condition,
                    "conditionExpr": condition_expr,
                    "effective": effective,
                    "fromLabel": clean_label(step.get("fromPortfolio") or step.get("fromLabel") or "A", "A"),
                    "toLabel": clean_label(step.get("toPortfolioLabel") or step.get("toLabel") or step.get("targetLabel") or "B", "B"),
                    "ruleId": clean_label(step.get("ruleId") or step.get("id"), f"portfolio_swap_{index + 1}"),
                    "reason": clean_label(step.get("note") or step.get("reason") or condition, "conditional portfolio swap"),
                }
            )
            continue
        if event_type != "swap":
            continue
        from_asset = clean_ticker(step.get("fromAsset") or step.get("from") or step.get("sell") or step.get("sourceAsset"))
        to_asset = clean_ticker(step.get("toAsset") or step.get("to") or step.get("buy") or step.get("targetAsset"))
        if not from_asset or not to_asset or from_asset == to_asset:
            continue
        effective = matrix_dsl_effective_spec(
            step.get("effective") or step.get("dateRule") or step.get("when") or step.get("date") or step.get("effectiveDate"),
            step,
        )
        events.append(
            {
                "type": "swap",
                "fromAsset": from_asset,
                "toAsset": to_asset,
                "effective": effective,
                "weightPolicy": clean_label(step.get("weightPolicy") or step.get("policy"), "preserve_value"),
                "ruleId": clean_label(step.get("ruleId") or step.get("id"), f"swap_{index + 1}"),
                "reason": clean_label(step.get("note") or step.get("reason"), f"{from_asset}->{to_asset} swap"),
            }
        )
    return events


def matrix_dsl_allocation_event_op_count(program):
    count = 0
    for step in program or []:
        if not isinstance(step, dict):
            continue
        op = clean_matrix_dsl_op(step)
        if op not in {"swap", "portfolio_swap", "allocation_event"}:
            continue
        count += 1
    return count


def matrix_dsl_required_tickers(config):
    tickers = set()
    if not isinstance(config, dict):
        return tickers
    for event in config.get("allocationEvents") or []:
        if not isinstance(event, dict):
            continue
        for key in ("fromAsset", "toAsset"):
            ticker = clean_ticker(event.get(key))
            if ticker:
                tickers.add(ticker)
        if isinstance(event.get("targetWeights"), dict):
            tickers.update(clean_ticker(ticker) for ticker in event["targetWeights"] if clean_ticker(ticker))
    for contribution in config.get("contributions") or []:
        if not isinstance(contribution, dict):
            continue
        if isinstance(contribution.get("targetWeights"), dict):
            tickers.update(clean_ticker(ticker) for ticker in contribution["targetWeights"] if clean_ticker(ticker))
    for row in config.get("signalRows") or []:
        ticker = clean_ticker(row.get("asset"))
        if ticker and ticker not in {"PORTFOLIO"}:
            tickers.add(ticker)
    return tickers


def parse_portfolio_matrix_dsl_strategy_config(source, strategy, function_spec):
    language = str(function_spec.get("language") or function_spec.get("dsl") or "").strip().lower()
    program = matrix_dsl_program(function_spec)
    strategy_type = str(strategy.get("type") or "").strip().lower()
    if language != "portfolio-matrix-dsl" and strategy_type != "portfolio_matrix_dsl":
        return None
    if not program:
        return {
            "type": "unsupported",
            "name": clean_label(strategy.get("name") or strategy.get("title"), "Portfolio Matrix DSL"),
            "reason": "portfolio-matrix-dsl strategies require functionSpec.program.",
        }
    supported_ops = {
        "indicator",
        "rolling",
        "rank",
        "rebalance",
        "rule",
        "emit",
        "swap",
        "portfolio_swap",
        "allocation_event",
        "dca",
        "contribution",
        "cashflow",
        "deposit",
        "periodic_buy",
    }
    unsupported_ops = [
        clean_label(step.get("op") or step.get("type"), "unknown")
        for step in program
        if isinstance(step, dict) and clean_label(step.get("op") or step.get("type"), "").lower() not in supported_ops
    ]
    if unsupported_ops:
        return {
            "type": "unsupported",
            "name": clean_label(strategy.get("name") or strategy.get("title"), "Portfolio Matrix DSL"),
            "reason": "Unsupported portfolio-matrix-dsl operations: " + ", ".join(unsupported_ops[:4]),
        }
    signal_matrix = strategy.get("signalMatrix") if isinstance(strategy.get("signalMatrix"), dict) else {}
    signal_rows = normalize_signal_matrix_target_rows(signal_matrix)
    allocation_events = matrix_dsl_allocation_events(program)
    allocation_event_op_count = matrix_dsl_allocation_event_op_count(program)
    contributions = matrix_dsl_dca_configs(program)
    contribution_op_count = matrix_dsl_dca_op_count(program)
    if allocation_event_op_count != len(allocation_events):
        return {
            "type": "unsupported",
            "name": clean_label(strategy.get("name") or strategy.get("title"), "Portfolio Matrix DSL"),
            "reason": "portfolio-matrix-dsl allocation events require valid swap fromAsset and toAsset or portfolio_swap targetWeights.",
        }
    if contribution_op_count != len(contributions):
        return {
            "type": "unsupported",
            "name": clean_label(strategy.get("name") or strategy.get("title"), "Portfolio Matrix DSL"),
            "reason": "portfolio-matrix-dsl dca/contribution operations require a positive amount and a valid optional condition.",
        }
    return {
        "type": "portfolio_matrix_dsl",
        "name": clean_label(strategy.get("name") or strategy.get("title"), "Portfolio Matrix DSL"),
        "language": "portfolio-matrix-dsl",
        "version": int(finite_number(function_spec.get("version"), 1) or 1),
        "program": program[:64],
        "signalRows": signal_rows[:5000],
        "allocationEvents": allocation_events[:200],
        "contributions": contributions[:200],
    }


def rolling_rsi(values, period):
    rows = [None] * len(values)
    if period <= 0 or len(values) <= period:
        return rows
    gains = []
    losses = []
    for before, after in zip(values[:-1], values[1:]):
        change = after - before
        gains.append(max(change, 0.0))
        losses.append(abs(min(change, 0.0)))
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period
    rows[period] = 100.0 if avg_loss == 0 else 100.0 - (100.0 / (1.0 + avg_gain / avg_loss))
    for index in range(period + 1, len(values)):
        gain = gains[index - 1]
        loss = losses[index - 1]
        avg_gain = (avg_gain * (period - 1) + gain) / period
        avg_loss = (avg_loss * (period - 1) + loss) / period
        rows[index] = 100.0 if avg_loss == 0 else 100.0 - (100.0 / (1.0 + avg_gain / avg_loss))
    return rows


def rolling_ema(values, period):
    rows = [None] * len(values)
    if period <= 0 or len(values) < period:
        return rows
    alpha = 2.0 / (period + 1.0)
    warmup = []
    ema = None
    for index, raw_value in enumerate(values):
        value = finite_number(raw_value, None)
        if value is None:
            continue
        if ema is None:
            warmup.append(value)
            if len(warmup) == period:
                ema = sum(warmup) / period
                rows[index] = ema
            continue
        ema = value * alpha + ema * (1.0 - alpha)
        rows[index] = ema
    return rows


def matrix_dsl_identifier(value, fallback=""):
    text = re.sub(r"[^\w.-]+", "_", str(value or fallback).strip()).strip("_")
    return text or fallback


def matrix_dsl_term_value(term, fields):
    if isinstance(term, dict):
        term_type = str(term.get("type") or "").lower()
        if term_type == "literal" or "literal" in term:
            return term.get("literal") if "literal" in term else term.get("value")
        if term_type == "field" or term.get("field") or term.get("name"):
            return fields.get(matrix_dsl_identifier(term.get("field") or term.get("name")))
    numeric = finite_number(term, None)
    if numeric is not None:
        return numeric
    text = str(term or "").strip().strip("\"'")
    return fields.get(matrix_dsl_identifier(text), text)


def matrix_dsl_parse_expression(value):
    if isinstance(value, bool):
        return {"type": "constant", "value": value}
    if isinstance(value, dict):
        expr_type = str(value.get("type") or "").lower()
        if expr_type == "constant" or "constant" in value:
            return {"type": "constant", "value": bool(value.get("constant", value.get("value")))}
        if expr_type in {"and", "or"}:
            terms = value.get("terms") if isinstance(value.get("terms"), list) else [value.get("left"), value.get("right")]
            parsed_terms = [matrix_dsl_parse_expression(term) for term in terms]
            parsed_terms = [term for term in parsed_terms if term]
            return {"type": expr_type, "terms": parsed_terms} if len(parsed_terms) >= 2 else (parsed_terms[0] if parsed_terms else None)
        operator = str(value.get("operator") or "").strip()
        if operator in {"<", "<=", ">", ">=", "==", "=", "!="}:
            return {
                "type": "comparison",
                "left": value.get("left") or {"type": "field", "name": value.get("field")},
                "operator": operator,
                "right": value.get("right") if "right" in value else value.get("value"),
            }
    source = str(value or "").strip()
    if not source:
        return None
    if re.match(r"^(?:true|always|항상)$", source, flags=re.IGNORECASE):
        return {"type": "constant", "value": True}
    if re.match(r"^(?:false|never|절대)$", source, flags=re.IGNORECASE):
        return {"type": "constant", "value": False}
    or_parts = [part.strip() for part in re.split(r"\s+(?:or|\|\|)\s+", source, flags=re.IGNORECASE) if part.strip()]
    if len(or_parts) > 1:
        terms = [matrix_dsl_parse_expression(part) for part in or_parts]
        return {"type": "or", "terms": [term for term in terms if term]} if all(terms) else None
    and_parts = [part.strip() for part in re.split(r"\s+(?:and|&&)\s+", source, flags=re.IGNORECASE) if part.strip()]
    if len(and_parts) > 1:
        terms = [matrix_dsl_parse_expression(part) for part in and_parts]
        return {"type": "and", "terms": [term for term in terms if term]} if all(terms) else None
    match = re.match(r"^([A-Za-z_][\w.-]*)\s*(<=|>=|==|!=|=|<|>)\s*(-?\d+(?:\.\d+)?|[A-Za-z_][\w.-]*|['\"][^'\"]+['\"])$", source)
    if not match:
        return None
    return {
        "type": "comparison",
        "left": {"type": "field", "name": matrix_dsl_identifier(match.group(1))},
        "operator": match.group(2),
        "right": finite_number(match.group(3), match.group(3).strip("\"'")),
    }


def matrix_dsl_expression_matches(expr, fields):
    if not expr:
        return False
    expr_type = str(expr.get("type") or "").lower() if isinstance(expr, dict) else ""
    if expr_type == "constant":
        return bool(expr.get("value"))
    if expr_type == "and":
        return all(matrix_dsl_expression_matches(term, fields) for term in expr.get("terms", []))
    if expr_type == "or":
        return any(matrix_dsl_expression_matches(term, fields) for term in expr.get("terms", []))
    if expr_type != "comparison":
        return False
    left = matrix_dsl_term_value(expr.get("left"), fields)
    right = matrix_dsl_term_value(expr.get("right"), fields)
    operator = str(expr.get("operator") or "").strip()
    left_number = finite_number(left, None)
    right_number = finite_number(right, None)
    if left_number is not None and right_number is not None:
        left, right = left_number, right_number
    else:
        left, right = str(left or ""), str(right or "")
    if operator == "<":
        return left < right
    if operator == "<=":
        return left <= right
    if operator == ">":
        return left > right
    if operator == ">=":
        return left >= right
    if operator in {"=", "=="}:
        return left == right
    if operator == "!=":
        return left != right
    return False


def matrix_dsl_rolling(values, period, method):
    rows = [None] * len(values)
    if period <= 0 or len(values) < period:
        return rows
    for index in range(period - 1, len(values)):
        window = [finite_number(item, None) for item in values[index - period + 1 : index + 1]]
        if any(item is None for item in window):
            continue
        if method == "sum":
            rows[index] = sum(window)
        elif method == "min":
            rows[index] = min(window)
        elif method == "max":
            rows[index] = max(window)
        elif method == "std":
            mean = sum(window) / len(window)
            rows[index] = math.sqrt(sum((item - mean) ** 2 for item in window) / len(window))
        else:
            rows[index] = sum(window) / len(window)
    return rows


def matrix_dsl_runtime_records(dates, portfolio_values, program):
    run_start = dates[0] if dates else ""
    records = [
        {
            "date": date,
            "fields": {
                "bar_index": index,
                "close": value,
                "days_since_run_start": elapsed_days_between(run_start, date),
                "months_since_run_start": full_calendar_months_between(run_start, date),
                "portfolio": value,
                "nav": value,
                "trading_days_since_run_start": index,
                "years_since_run_start": elapsed_days_between(run_start, date) / 365.25,
            },
        }
        for index, (date, value) in enumerate(zip(dates, portfolio_values))
    ]
    issues = []
    for step in program or []:
        if not isinstance(step, dict):
            continue
        op = str(step.get("op") or step.get("type") or "").strip().lower()
        if op == "indicator":
            name = matrix_dsl_identifier(step.get("name") or step.get("indicator")).lower()
            field = matrix_dsl_identifier(step.get("field"), "close")
            output = matrix_dsl_identifier(step.get("outputField") or step.get("as") or name, name)
            period = max(1, min(400, int(finite_number(step.get("period") or step.get("length"), 14) or 14)))
            values = [record["fields"].get(field) for record in records]
            if name == "rsi":
                for record, value in zip(records, rolling_rsi(values, period)):
                    if value is not None:
                        record["fields"][output] = value
                continue
            if name == "ema":
                for record, value in zip(records, rolling_ema(values, period)):
                    if value is not None:
                        record["fields"][output] = value
                continue
            if name == "macd":
                fast_period = max(1, min(400, int(finite_number(step.get("fastPeriod") or step.get("fast") or step.get("fastLength"), 12) or 12)))
                slow_period = max(1, min(400, int(finite_number(step.get("slowPeriod") or step.get("slow") or step.get("slowLength"), 26) or 26)))
                signal_period = max(1, min(400, int(finite_number(step.get("signalPeriod") or step.get("signal") or step.get("signalLength"), 9) or 9)))
                macd_output = matrix_dsl_identifier(step.get("outputField") or step.get("macdField") or step.get("as"), "macd")
                signal_output = matrix_dsl_identifier(step.get("signalField"), "macd_signal")
                histogram_output = matrix_dsl_identifier(step.get("histogramField") or step.get("histField"), "macd_histogram")
                fast_values = rolling_ema(values, fast_period)
                slow_values = rolling_ema(values, slow_period)
                macd_values = [
                    fast - slow if fast is not None and slow is not None else None
                    for fast, slow in zip(fast_values, slow_values)
                ]
                signal_values = rolling_ema(macd_values, signal_period)
                for record, macd_value, signal_value in zip(records, macd_values, signal_values):
                    if macd_value is not None:
                        record["fields"][macd_output] = macd_value
                    if signal_value is not None:
                        record["fields"][signal_output] = signal_value
                        if macd_value is not None:
                            record["fields"][histogram_output] = macd_value - signal_value
                continue
            issues.append({"code": "UNSUPPORTED_DSL_INDICATOR", "detail": name})
            continue
        if op == "rolling":
            method = matrix_dsl_identifier(step.get("name") or step.get("method"), "mean").lower()
            method = "mean" if method == "avg" else method
            if method not in {"mean", "sum", "min", "max", "std"}:
                issues.append({"code": "UNSUPPORTED_DSL_ROLLING", "detail": method})
                continue
            field = matrix_dsl_identifier(step.get("field"), "close")
            output = matrix_dsl_identifier(step.get("outputField") or step.get("as") or f"{field}_{method}", f"{field}_{method}")
            period = max(1, min(400, int(finite_number(step.get("period") or step.get("window"), 20) or 20)))
            values = [record["fields"].get(field) for record in records]
            for record, value in zip(records, matrix_dsl_rolling(values, period, method)):
                if value is not None:
                    record["fields"][output] = value
    return records, issues


def matrix_dsl_rebalance_config(program):
    for step in program or []:
        if not isinstance(step, dict):
            continue
        op = str(step.get("op") or step.get("type") or "").strip().lower()
        if op != "rebalance":
            continue
        method = str(step.get("method") or step.get("name") or "threshold_band").strip().lower()
        if method in {"periodic", "calendar", "calendar_month_end", "monthly", "month_end"}:
            return {
                "method": "periodic",
                "scope": "full_period",
                "frequency": matrix_dsl_dca_frequency(
                    step.get("frequency") or step.get("cadence") or step.get("interval") or "monthly"
                ),
            }
        if method not in {"threshold_band", "drift_rebalance", "band_rebalance"}:
            return None
        threshold = finite_number(
            step.get("threshold")
            if step.get("threshold") not in (None, "")
            else step.get("driftThreshold")
            if step.get("driftThreshold") not in (None, "")
            else step.get("band")
            if step.get("band") not in (None, "")
            else step.get("value"),
            0.10,
        )
        condition_assets = [
            clean_ticker(asset)
            for asset in list_like(step.get("assets") or step.get("conditionAssets"))
            if clean_ticker(asset)
        ]
        return {
            "method": "threshold_band",
            "threshold": max(0.0001, min(1.0, threshold)),
            "conditionAssets": condition_assets,
        }
    return None


def apply_signal_matrix_target_weight_strategy(dates, portfolio_values, signal_rows):
    if len(portfolio_values) < 3 or not signal_rows:
        return None
    changes = sorted(signal_rows, key=lambda item: item.get("date") or "")
    change_index = 0
    position = 1.0
    strategy_values = [100.0]
    trades = []
    exposure_days = 0

    def apply_changes_through(current_date):
        nonlocal change_index, position
        while change_index < len(changes) and changes[change_index].get("date", "") <= current_date:
            change = changes[change_index]
            new_position = matrix_dsl_target_position(change.get("target"))
            if new_position is not None and new_position != position:
                trades.append(
                    {
                        "date": current_date,
                        "action": "BUY" if new_position > position else "SELL",
                        "reason": change.get("reason") or change.get("ruleId") or "signal_matrix target_weight",
                    }
                )
                position = new_position
            elif new_position is not None:
                position = new_position
            change_index += 1

    apply_changes_through(dates[0])
    for index in range(1, len(portfolio_values)):
        apply_changes_through(dates[index])
        before = portfolio_values[index - 1]
        after = portfolio_values[index]
        daily_return = after / before - 1.0 if before else 0.0
        strategy_values.append(strategy_values[-1] * (1.0 + position * daily_return))
        if position > 0:
            exposure_days += 1

    return {
        "values": strategy_values,
        "trades": trades,
        "exposurePct": safe_round(exposure_days / max(1, len(portfolio_values) - 1) * 100.0, 2),
        "parameters": {
            "language": "portfolio-matrix-dsl",
            "signalRows": len(signal_rows),
            "execution": "signal_matrix target_weight rows",
        },
        "issues": [],
    }


def resolve_event_effective_date(dates, event):
    if not dates:
        return ""
    effective = event.get("effective") if isinstance(event.get("effective"), dict) else {}
    target = clean_iso_date(effective.get("date"))
    if not target:
        anchor = clean_label(effective.get("anchor"), "run_start").lower()
        anchor_date = dates[-1] if anchor in {"run_end", "end"} else dates[0]
        target = anchor_date
        if int(finite_number(effective.get("offsetMonths"), 0) or 0):
            target = add_calendar_months(target, effective.get("offsetMonths"))
        if int(finite_number(effective.get("offsetDays"), 0) or 0):
            target = add_calendar_days(target, effective.get("offsetDays"))
    if not target:
        return ""
    snap = clean_label(effective.get("snap"), "next_trading_day").lower()
    sorted_dates = sorted(dates)
    if snap in {"previous_trading_day", "previous", "prev"}:
        candidates = [date for date in sorted_dates if date <= target]
        return candidates[-1] if candidates else sorted_dates[0]
    candidates = [date for date in sorted_dates if date >= target]
    return candidates[0] if candidates else sorted_dates[-1]


def dca_schedule_dates(dates, config):
    if not dates:
        return []
    start_date = resolve_event_effective_date(dates, config)
    if not start_date:
        start_date = dates[0]
    end_date = clean_iso_date(config.get("endDate"))
    frequency = matrix_dsl_dca_frequency(config.get("frequency"))
    day_of_month = max(1, min(31, int(finite_number(config.get("dayOfMonth"), 1) or 1)))
    max_contributions = max(0, int(finite_number(config.get("maxContributions"), 0) or 0))
    try:
        start_parsed = datetime.strptime(start_date, "%Y-%m-%d").date()
    except ValueError:
        start_parsed = None
    selected = []
    seen_keys = set()
    start_week_anchor = None
    for date in dates:
        if date < start_date:
            continue
        if end_date and date > end_date:
            continue
        try:
            parsed = datetime.strptime(date, "%Y-%m-%d").date()
        except ValueError:
            continue
        key = None
        due = False
        if frequency == "daily":
            key = date
            due = True
        elif frequency in {"weekly", "biweekly"}:
            iso_year, iso_week, _ = parsed.isocalendar()
            key = (iso_year, iso_week)
            if key not in seen_keys:
                if frequency == "weekly":
                    due = True
                else:
                    week_index = iso_year * 53 + iso_week
                    if start_week_anchor is None:
                        start_week_anchor = week_index
                    due = (week_index - start_week_anchor) % 2 == 0
        elif frequency == "quarterly":
            key = (parsed.year, (parsed.month - 1) // 3)
            quarter_start_month = ((parsed.month - 1) // 3) * 3 + 1
            scheduled_day = min(day_of_month, calendar.monthrange(parsed.year, quarter_start_month)[1])
            scheduled_date = datetime(parsed.year, quarter_start_month, scheduled_day).date()
            due = key not in seen_keys and parsed >= scheduled_date and (not start_parsed or scheduled_date >= start_parsed)
        else:
            key = (parsed.year, parsed.month)
            scheduled_day = min(day_of_month, calendar.monthrange(parsed.year, parsed.month)[1])
            scheduled_date = datetime(parsed.year, parsed.month, scheduled_day).date()
            due = key not in seen_keys and parsed >= scheduled_date and (not start_parsed or scheduled_date >= start_parsed)
        if not due or key in seen_keys:
            continue
        selected.append(date)
        seen_keys.add(key)
        if max_contributions and len(selected) >= max_contributions:
            break
    return selected


def normalized_contribution_weights(config, base_weights, available_tickers):
    raw_weights = config.get("targetWeights") if isinstance(config.get("targetWeights"), dict) else {}
    explicit_weights = bool(raw_weights)
    if not raw_weights:
        raw_weights = {ticker: weight for ticker, weight in (base_weights or {}).items() if weight > 0}
    target_weights = {
        clean_ticker(ticker): max(0.0, finite_number(weight, 0.0))
        for ticker, weight in raw_weights.items()
        if clean_ticker(ticker)
    }
    if explicit_weights and any(ticker not in available_tickers for ticker in target_weights):
        return {}, -1.0
    target_weights = {ticker: weight for ticker, weight in target_weights.items() if ticker in available_tickers and weight > 0}
    target_sum = sum(target_weights.values())
    if target_sum <= 0:
        return {}, 0.0
    if target_sum > 1.0001:
        target_weights = {ticker: weight / target_sum for ticker, weight in target_weights.items()}
        target_sum = 1.0
    return target_weights, max(0.0, 1.0 - target_sum)


def apply_dca_contribution_strategy(dates, portfolio_values, normalized, tickers, weights, cash_weight, config, benchmark_name="", benchmark_values=None):
    contributions = [item for item in config.get("contributions") or [] if isinstance(item, dict)]
    if not dates or normalized is None or normalized.empty or not tickers or not contributions:
        return None
    available_tickers = [ticker for ticker in tickers if ticker in normalized.columns]
    if not available_tickers:
        return None

    records, record_issues = matrix_dsl_runtime_records(dates, portfolio_values, config.get("program") or [])
    if record_issues:
        return None
    record_by_date = {record["date"]: record for record in records}

    events = []
    for contribution in contributions:
        target_weights, target_cash_weight = normalized_contribution_weights(contribution, weights or {}, available_tickers)
        if target_cash_weight < 0:
            return None
        if not target_weights and target_cash_weight <= 0:
            return None
        condition_expr = contribution.get("conditionExpr") if isinstance(contribution.get("conditionExpr"), dict) else None
        for date in dca_schedule_dates(dates, contribution):
            if condition_expr:
                record = record_by_date.get(date)
                if not record or not matrix_dsl_expression_matches(condition_expr, record.get("fields") or {}):
                    continue
            events.append(
                {
                    **contribution,
                    "date": date,
                    "targetWeights": target_weights,
                    "cashWeight": target_cash_weight,
                }
            )
    if not events:
        return None
    events = sorted(events, key=lambda item: item.get("date") or "")
    events_by_date = {}
    for event in events:
        events_by_date.setdefault(event["date"], []).append(event)

    asset_values = {ticker: 0.0 for ticker in available_tickers}
    cash_value = 0.0
    values = []
    trades = []
    cashflows = []
    contribution_count = 0
    twr_factor = 1.0
    exposure_days = 0

    def apply_contributions(current_date):
        nonlocal cash_value, contribution_count
        for event in events_by_date.get(current_date, []):
            amount = finite_number(event.get("amount"), 0.0)
            if amount <= 0:
                continue
            for ticker in available_tickers:
                asset_values[ticker] = asset_values.get(ticker, 0.0) + amount * event["targetWeights"].get(ticker, 0.0)
            cash_value += amount * event.get("cashWeight", 0.0)
            cashflows.append((current_date, -amount))
            contribution_count += 1
            trades.append(
                {
                    "date": current_date,
                    "action": "CONTRIBUTE",
                    "amount": safe_round(amount, 2),
                    "frequency": event.get("frequency") or "monthly",
                    "targetWeights": {ticker: safe_round(weight * 100.0, 4) for ticker, weight in event["targetWeights"].items() if weight > 0},
                    "reason": event.get("reason") or event.get("ruleId") or "periodic contribution",
                }
            )

    for index, current_date in enumerate(dates):
        if index > 0:
            previous_row = normalized.iloc[index - 1]
            current_row = normalized.iloc[index]
            before_market = cash_value + sum(asset_values.values())
            for ticker in available_tickers:
                before = finite_number(previous_row.get(ticker), 1.0)
                after = finite_number(current_row.get(ticker), before)
                if before > 0:
                    asset_values[ticker] = asset_values.get(ticker, 0.0) * after / before
            after_market = cash_value + sum(asset_values.values())
            if before_market > 0 and after_market > 0:
                twr_factor *= after_market / before_market
        apply_contributions(current_date)
        total_value = cash_value + sum(asset_values.values())
        values.append(total_value)
        if total_value > 0:
            exposure_days += 1

    standard_metrics = dca_metric_row(
        "Portfolio",
        values,
        cashflows,
        contribution_count,
        twr_factor,
        dates[-1],
        benchmark_name,
        benchmark_values or [],
    )
    return {
        "values": values,
        "trades": trades,
        "exposurePct": safe_round(exposure_days / max(1, len(values)) * 100.0, 2),
        "parameters": {
            "language": "portfolio-matrix-dsl",
            "version": config.get("version") or 1,
            "execution": "periodic contribution cashflows",
            "contributions": contribution_count,
            "program": config.get("program") or [],
        },
        "metrics": {"standard": standard_metrics, "metricProfile": "dca"},
        "issues": [],
    }


def apply_asset_allocation_events_strategy(dates, portfolio_values, normalized, tickers, weights, cash_weight, config):
    allocation_events = [event for event in config.get("allocationEvents") or [] if isinstance(event, dict)]
    if not dates or normalized is None or normalized.empty or not tickers or not allocation_events:
        return None

    available_tickers = [ticker for ticker in tickers if ticker in normalized.columns]
    if not available_tickers:
        return None
    records, record_issues = matrix_dsl_runtime_records(dates, portfolio_values, config.get("program") or [])
    if record_issues:
        return None
    record_by_date = {record["date"]: record for record in records}

    dated_events = []
    for event in allocation_events:
        effective_date = resolve_event_effective_date(dates, event)
        event_type = clean_label(event.get("type"), "").lower()
        if event_type == "swap":
            from_asset = clean_ticker(event.get("fromAsset"))
            to_asset = clean_ticker(event.get("toAsset"))
            if not effective_date or from_asset not in normalized.columns or to_asset not in normalized.columns:
                return None
        elif event_type == "portfolio_swap":
            target_weights = event.get("targetWeights") if isinstance(event.get("targetWeights"), dict) else {}
            target_tickers = [clean_ticker(ticker) for ticker in target_weights if clean_ticker(ticker)]
            if not effective_date or not target_tickers or any(ticker not in normalized.columns for ticker in target_tickers):
                return None
        else:
            return None
        dated_events.append({**event, "date": effective_date})
    dated_events = sorted(dated_events, key=lambda item: item.get("date") or "")

    target_weights, target_cash_weight = normalize_rebalance_target_weights(weights or {}, cash_weight, available_tickers)
    rebalance_config = matrix_dsl_rebalance_config(config.get("program") or [])
    periodic_rebalance_config = rebalance_config if rebalance_config and rebalance_config.get("method") == "periodic" else None
    asset_values = {ticker: 100.0 * target_weights.get(ticker, 0.0) for ticker in available_tickers}
    cash_value = 100.0 * target_cash_weight
    values = [cash_value + sum(asset_values.values())]
    trades = []
    pending_events = dated_events[:]

    def apply_due_events(current_date, total_value):
        nonlocal cash_value, pending_events, target_weights, target_cash_weight
        next_pending = []
        for event in pending_events:
            if event.get("date", "") > current_date:
                next_pending.append(event)
                continue
            event_type = clean_label(event.get("type"), "").lower()
            if event_type == "swap":
                from_asset = clean_ticker(event.get("fromAsset"))
                to_asset = clean_ticker(event.get("toAsset"))
                moved_value = asset_values.get(from_asset, 0.0)
                if moved_value > 0 and to_asset in asset_values:
                    asset_values[to_asset] = asset_values.get(to_asset, 0.0) + moved_value
                    asset_values[from_asset] = 0.0
                    moved_weight = target_weights.get(from_asset, 0.0)
                    if moved_weight > 0:
                        target_weights[to_asset] = target_weights.get(to_asset, 0.0) + moved_weight
                        target_weights[from_asset] = 0.0
                    trades.append(
                        {
                            "date": current_date,
                            "action": "SWAP",
                            "from": from_asset,
                            "to": to_asset,
                            "value": safe_round(moved_value, 4),
                            "reason": event.get("reason") or event.get("ruleId") or f"{from_asset}->{to_asset} swap",
                        }
                    )
                continue
            if event_type == "portfolio_swap":
                condition_expr = event.get("conditionExpr") if isinstance(event.get("conditionExpr"), dict) else None
                if condition_expr:
                    record = record_by_date.get(current_date)
                    if not record or not matrix_dsl_expression_matches(condition_expr, record.get("fields") or {}):
                        next_pending.append(event)
                        continue
                target_weights = {
                    clean_ticker(ticker): max(0.0, finite_number(weight, 0.0))
                    for ticker, weight in (event.get("targetWeights") or {}).items()
                    if clean_ticker(ticker)
                }
                target_sum = sum(target_weights.values())
                if target_sum <= 0:
                    continue
                if target_sum > 1.0001:
                    target_weights = {ticker: weight / target_sum for ticker, weight in target_weights.items()}
                    target_sum = 1.0
                for ticker in available_tickers:
                    asset_values[ticker] = total_value * target_weights.get(ticker, 0.0)
                cash_value = max(0.0, total_value * (1.0 - target_sum))
                target_cash_weight = max(0.0, 1.0 - target_sum)
                trades.append(
                    {
                        "date": current_date,
                        "action": "PORTFOLIO_SWAP",
                        "from": event.get("fromLabel") or "A",
                        "to": event.get("toLabel") or "B",
                        "targetWeights": {ticker: safe_round(weight * 100.0, 4) for ticker, weight in target_weights.items() if weight > 0},
                        "reason": event.get("reason") or event.get("condition") or event.get("ruleId") or "conditional portfolio swap",
                    }
                )
                continue
        pending_events = next_pending

    apply_due_events(dates[0], values[0])
    for index in range(1, len(dates)):
        previous_row = normalized.iloc[index - 1]
        current_row = normalized.iloc[index]
        for ticker in available_tickers:
            before = finite_number(previous_row.get(ticker), 1.0)
            after = finite_number(current_row.get(ticker), before)
            if before > 0:
                asset_values[ticker] = asset_values.get(ticker, 0.0) * after / before

        total_value = cash_value + sum(asset_values.values())
        values.append(total_value)
        if index + 1 < len(dates):
            apply_due_events(dates[index], total_value)
            total_value = cash_value + sum(asset_values.values())
            if periodic_rebalance_config and matrix_dsl_periodic_rebalance_due(dates[index], dates[index + 1], periodic_rebalance_config):
                asset_values, cash_value = apply_target_weight_rebalance(
                    asset_values,
                    total_value,
                    target_weights,
                    target_cash_weight,
                    available_tickers,
                )
                trades.append(
                    {
                        "date": dates[index],
                        "action": "REBALANCE",
                        "frequency": matrix_dsl_dca_frequency(periodic_rebalance_config.get("frequency")),
                        "reason": f"full-period {matrix_dsl_dca_frequency(periodic_rebalance_config.get('frequency'))} portfolio-matrix-dsl periodic rebalance",
                    }
                )

    exposure_days = sum(1 for value in values[1:] if value > 0)
    execution = "asset-level allocation events"
    if periodic_rebalance_config:
        execution = f"{execution} with full-period periodic rebalance"
    return {
        "values": values,
        "trades": trades,
        "exposurePct": safe_round(exposure_days / max(1, len(values) - 1) * 100.0, 2),
        "parameters": {
            "language": "portfolio-matrix-dsl",
            "version": config.get("version") or 1,
            "execution": execution,
            "allocationEvents": len(allocation_events),
            "rebalance": periodic_rebalance_config or {},
            "program": config.get("program") or [],
        },
        "issues": [],
    }


def apply_portfolio_matrix_dsl_strategy(
    dates,
    portfolio_values,
    config,
    normalized=None,
    tickers=None,
    weights=None,
    cash_weight=0.0,
    benchmark_name="",
    benchmark_values=None,
):
    if len(portfolio_values) < 3:
        return None
    dca_result = apply_dca_contribution_strategy(
        dates,
        portfolio_values,
        normalized,
        tickers or [],
        weights or {},
        cash_weight,
        config,
        benchmark_name,
        benchmark_values or [],
    )
    if dca_result:
        return dca_result
    asset_event_result = apply_asset_allocation_events_strategy(
        dates,
        portfolio_values,
        normalized,
        tickers or [],
        weights or {},
        cash_weight,
        config,
    )
    if asset_event_result:
        return asset_event_result
    signal_rows = config.get("signalRows") or []
    if signal_rows:
        signal_result = apply_signal_matrix_target_weight_strategy(dates, portfolio_values, signal_rows)
        if signal_result:
            signal_result["parameters"] = {
                **(signal_result.get("parameters") or {}),
                "version": config.get("version") or 1,
                "program": config.get("program") or [],
            }
            return signal_result
    rebalance_config = matrix_dsl_rebalance_config(config.get("program") or [])
    if rebalance_config:
        if rebalance_config.get("method") == "periodic":
            rebalance_result = apply_matrix_dsl_periodic_rebalance(
                dates,
                normalized,
                tickers or [],
                weights or {},
                cash_weight,
                rebalance_config,
            )
        else:
            rebalance_result = apply_matrix_dsl_threshold_band_rebalance(
                dates,
                normalized,
                tickers or [],
                weights or {},
                cash_weight,
                rebalance_config,
            )
        if not rebalance_result:
            return None
        rebalance_result["parameters"] = {
            **(rebalance_result.get("parameters") or {}),
            "language": "portfolio-matrix-dsl",
            "version": config.get("version") or 1,
            "program": config.get("program") or [],
        }
        rebalance_result["issues"] = []
        return rebalance_result

    records = [
        {
            "date": date,
            "fields": {
                "close": value,
                "portfolio": value,
                "nav": value,
            },
        }
        for date, value in zip(dates, portfolio_values)
    ]
    rules = []
    issues = []
    for step in config.get("program") or []:
        if not isinstance(step, dict):
            continue
        op = str(step.get("op") or step.get("type") or "").strip().lower()
        if op == "indicator":
            name = matrix_dsl_identifier(step.get("name") or step.get("indicator")).lower()
            field = matrix_dsl_identifier(step.get("field"), "close")
            output = matrix_dsl_identifier(step.get("outputField") or step.get("as") or name, name)
            period = max(1, min(400, int(finite_number(step.get("period") or step.get("length"), 14) or 14)))
            values = [record["fields"].get(field) for record in records]
            if name == "rsi":
                for record, value in zip(records, rolling_rsi(values, period)):
                    if value is not None:
                        record["fields"][output] = value
                continue
            if name == "ema":
                for record, value in zip(records, rolling_ema(values, period)):
                    if value is not None:
                        record["fields"][output] = value
                continue
            if name == "macd":
                fast_period = max(1, min(400, int(finite_number(step.get("fastPeriod") or step.get("fast") or step.get("fastLength"), 12) or 12)))
                slow_period = max(1, min(400, int(finite_number(step.get("slowPeriod") or step.get("slow") or step.get("slowLength"), 26) or 26)))
                signal_period = max(1, min(400, int(finite_number(step.get("signalPeriod") or step.get("signal") or step.get("signalLength"), 9) or 9)))
                macd_output = matrix_dsl_identifier(step.get("outputField") or step.get("macdField") or step.get("as"), "macd")
                signal_output = matrix_dsl_identifier(step.get("signalField"), "macd_signal")
                histogram_output = matrix_dsl_identifier(step.get("histogramField") or step.get("histField"), "macd_histogram")
                fast_values = rolling_ema(values, fast_period)
                slow_values = rolling_ema(values, slow_period)
                macd_values = [
                    fast - slow if fast is not None and slow is not None else None
                    for fast, slow in zip(fast_values, slow_values)
                ]
                signal_values = rolling_ema(macd_values, signal_period)
                for record, macd_value, signal_value in zip(records, macd_values, signal_values):
                    if macd_value is not None:
                        record["fields"][macd_output] = macd_value
                    if signal_value is not None:
                        record["fields"][signal_output] = signal_value
                        if macd_value is not None:
                            record["fields"][histogram_output] = macd_value - signal_value
                continue
            else:
                issues.append({"code": "UNSUPPORTED_DSL_INDICATOR", "detail": name})
                continue
        elif op == "rolling":
            method = matrix_dsl_identifier(step.get("name") or step.get("method"), "mean").lower()
            method = "mean" if method == "avg" else method
            if method not in {"mean", "sum", "min", "max", "std"}:
                issues.append({"code": "UNSUPPORTED_DSL_ROLLING", "detail": method})
                continue
            field = matrix_dsl_identifier(step.get("field"), "close")
            output = matrix_dsl_identifier(step.get("outputField") or step.get("as") or f"{field}_{method}", f"{field}_{method}")
            period = max(1, min(400, int(finite_number(step.get("period") or step.get("window"), 20) or 20)))
            values = [record["fields"].get(field) for record in records]
            for record, value in zip(records, matrix_dsl_rolling(values, period, method)):
                if value is not None:
                    record["fields"][output] = value
        elif op in {"rule", "emit"}:
            expr = matrix_dsl_parse_expression(step.get("expr") or step.get("when") or step.get("condition") or step.get("if"))
            emit_spec = step.get("emit") if isinstance(step.get("emit"), dict) else step
            if not expr:
                if op == "emit":
                    continue
                issues.append({"code": "INVALID_DSL_RULE_EXPRESSION", "detail": clean_label(step.get("when") or step.get("ruleId"), "rule")})
                continue
            rules.append(
                {
                    "expr": expr,
                    "when": clean_label(step.get("when") or step.get("condition"), ""),
                    "field": matrix_dsl_identifier(emit_spec.get("field") or emit_spec.get("action"), "target_weight"),
                    "value": emit_spec.get("value", 1),
                    "ruleId": clean_label(step.get("ruleId") or step.get("id"), ""),
                }
            )
    if issues:
        return None
    if not rules:
        return None

    strategy_values = [100.0]
    trades = []
    position = 1.0
    exposure_days = 0
    for index in range(1, len(portfolio_values)):
        before = portfolio_values[index - 1]
        after = portfolio_values[index]
        daily_return = after / before - 1.0 if before else 0.0
        strategy_values.append(strategy_values[-1] * (1.0 + position * daily_return))
        for rule in rules:
            if not matrix_dsl_expression_matches(rule["expr"], records[index]["fields"]):
                continue
            raw_value = matrix_dsl_term_value(rule.get("value"), records[index]["fields"])
            new_position = finite_number(raw_value, None)
            if new_position is None:
                action_text = str(raw_value or rule.get("field") or "").upper()
                new_position = 1.0 if action_text in {"BUY", "LONG"} else 0.0 if action_text in {"SELL", "CLOSE", "FLAT"} else position
            new_position = max(0.0, min(1.0, new_position))
            if new_position != position:
                trades.append(
                    {
                        "date": dates[index],
                        "action": "BUY" if new_position > position else "SELL",
                        "reason": rule.get("when") or rule.get("ruleId") or "portfolio-matrix-dsl rule",
                    }
                )
            position = new_position
            break
        if position > 0:
            exposure_days += 1
    return {
        "values": strategy_values,
        "trades": trades,
        "exposurePct": safe_round(exposure_days / max(1, len(portfolio_values) - 1) * 100.0, 2),
        "parameters": {"language": "portfolio-matrix-dsl", "version": config.get("version") or 1, "program": config.get("program") or []},
        "issues": [],
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
    scenario_matrix = payload.get("scenarioMatrix") if isinstance(payload.get("scenarioMatrix"), dict) else {}
    scenario_run = scenario_matrix.get("run") if isinstance(scenario_matrix.get("run"), dict) else {}
    period = str(payload.get("period") or scenario_run.get("period") or "1y")
    start_date = clean_iso_date(payload.get("startDate") or scenario_run.get("startDate"))
    end_date = clean_iso_date(payload.get("endDate") or scenario_run.get("endDate"))
    interval = yfinance_interval(payload.get("timeframe") or scenario_run.get("timeframe") or "1d")
    include_benchmark = payload_bool(
        payload.get("includeBenchmark", payload.get("showBenchmark", payload.get("withBenchmark"))),
        False,
    )
    benchmark = clean_ticker(payload.get("benchmark") or "")
    if include_benchmark and not benchmark:
        include_benchmark = False
    beta_raw_holdings = payload.get("betaBenchmarkHoldings") or payload.get("benchmarkHoldings") or payload.get("betaReferenceHoldings") or []
    beta_name = clean_label(payload.get("betaBenchmarkName") or payload.get("benchmarkPortfolioName") or payload.get("betaReferenceName"), "")

    holdings, cash_value, total_value, weights, cash_weight = parse_portfolio_holdings(raw_holdings)
    beta_holdings, _, beta_total_value, beta_weights, beta_cash_weight = parse_portfolio_holdings(beta_raw_holdings)
    has_beta_reference = bool(beta_holdings) and beta_total_value > 0
    beta_reference_name = beta_name or (", ".join(item["ticker"] for item in beta_holdings[:3]) if has_beta_reference else "")
    if not holdings or total_value <= 0:
        emit({"ok": False, "code": "NO_MARKET_HOLDINGS", "error": "No market holdings with positive value were supplied."})
        return 0

    strategy_config = parse_portfolio_strategy_config(payload)
    strategy_required_tickers = matrix_dsl_required_tickers(strategy_config)
    tickers = sorted(set(weights) | set(beta_weights) | strategy_required_tickers | ({benchmark} if include_benchmark and benchmark else set()))
    issues = []

    try:
        download_kwargs = {
            "tickers": tickers,
            "interval": interval,
            "auto_adjust": True,
            "progress": False,
            "threads": True,
        }
        if start_date or end_date:
            if start_date:
                download_kwargs["start"] = start_date
            if end_date:
                download_kwargs["end"] = yfinance_exclusive_end_date(end_date)
        else:
            download_kwargs["period"] = period
        data = yf.download(**download_kwargs)
    except Exception as exc:
        emit({"ok": False, "code": "YFINANCE_DOWNLOAD_FAILED", "error": str(exc), "tickers": tickers})
        return 0

    if data is None or data.empty:
        emit({"ok": False, "code": "YFINANCE_EMPTY_DATA", "error": "No price data returned from yfinance.", "tickers": tickers})
        return 0

    close = extract_price_frame(data, tickers, "Close")
    if close is None:
        emit({"ok": False, "code": "YFINANCE_CLOSE_MISSING", "error": "Close price columns were not found."})
        return 0
    high = extract_price_frame(data, tickers, "High")
    low = extract_price_frame(data, tickers, "Low")

    valid_tickers = [ticker for ticker in weights if ticker in close.columns and close[ticker].dropna().shape[0] >= 2]
    missing_tickers = [ticker for ticker in weights if ticker not in valid_tickers]
    for ticker in missing_tickers:
        issues.append({"code": "MISSING_PRICE_HISTORY", "ticker": ticker})

    valid_strategy_tickers = [ticker for ticker in strategy_required_tickers if ticker in close.columns and close[ticker].dropna().shape[0] >= 2]
    for ticker in [ticker for ticker in strategy_required_tickers if ticker not in valid_strategy_tickers]:
        issues.append({"code": "STRATEGY_PRICE_HISTORY_MISSING", "ticker": ticker})

    valid_beta_tickers = [ticker for ticker in beta_weights if ticker in close.columns and close[ticker].dropna().shape[0] >= 2]
    if has_beta_reference:
        for ticker in [ticker for ticker in beta_weights if ticker not in valid_beta_tickers]:
            issues.append({"code": "BETA_BENCHMARK_PRICE_HISTORY_MISSING", "ticker": ticker})

    if not valid_tickers:
        emit({"ok": False, "code": "NO_VALID_PRICE_HISTORY", "error": "No supplied tickers had enough yfinance price history.", "issues": issues})
        return 0

    valid_weight_sum = sum(weights[ticker] for ticker in valid_tickers)
    benchmark_valid = include_benchmark and benchmark in close.columns and close[benchmark].dropna().shape[0] >= 2
    aligned_columns = list(dict.fromkeys(valid_tickers + valid_strategy_tickers + valid_beta_tickers + ([benchmark] if benchmark_valid else [])))
    close = close[aligned_columns].dropna(how="all").ffill().dropna()
    if close.empty:
        emit({"ok": False, "code": "ALIGNED_HISTORY_EMPTY", "error": "Aligned price history is empty after cleaning.", "issues": issues})
        return 0

    if high is None:
        high = close.copy()
        issues.append({"code": "YFINANCE_HIGH_MISSING", "detail": "High prices were unavailable; Close was used for strategy high values."})
    if low is None:
        low = close.copy()
        issues.append({"code": "YFINANCE_LOW_MISSING", "detail": "Low prices were unavailable; Close was used for strategy low values."})
    high = high.reindex(index=close.index, columns=aligned_columns).ffill().fillna(close)
    low = low.reindex(index=close.index, columns=aligned_columns).ffill().fillna(close)

    base = close.iloc[0]
    normalized = close.divide(base).replace([float("inf"), float("-inf")], float("nan")).dropna()
    if normalized.empty:
        emit({"ok": False, "code": "NORMALIZED_HISTORY_EMPTY", "error": "Normalized price history is empty.", "issues": issues})
        return 0
    normalized_high = high.divide(base).replace([float("inf"), float("-inf")], float("nan")).reindex(index=normalized.index, columns=normalized.columns).fillna(normalized)
    normalized_low = low.divide(base).replace([float("inf"), float("-inf")], float("nan")).reindex(index=normalized.index, columns=normalized.columns).fillna(normalized)

    portfolio_values = []
    portfolio_high_values = []
    portfolio_low_values = []
    adjusted_weights = {}
    for ticker in valid_tickers:
        adjusted_weight = weights[ticker]
        if valid_weight_sum > 0:
            adjusted_weight += (1.0 - cash_weight - valid_weight_sum) * (weights[ticker] / valid_weight_sum)
        adjusted_weights[ticker] = adjusted_weight
    for ticker in valid_strategy_tickers:
        adjusted_weights.setdefault(ticker, 0.0)
    strategy_tickers = list(dict.fromkeys(valid_tickers + valid_strategy_tickers))

    for index, row in normalized.iterrows():
        high_row = normalized_high.loc[index]
        low_row = normalized_low.loc[index]
        weighted_close = cash_weight
        weighted_high = cash_weight
        weighted_low = cash_weight
        for ticker in valid_tickers:
            adjusted_weight = adjusted_weights[ticker]
            weighted_close += adjusted_weight * finite_number(row[ticker], 1.0)
            weighted_high += adjusted_weight * finite_number(high_row[ticker], finite_number(row[ticker], 1.0))
            weighted_low += adjusted_weight * finite_number(low_row[ticker], finite_number(row[ticker], 1.0))
        portfolio_values.append(weighted_close * 100.0)
        portfolio_high_values.append(weighted_high * 100.0)
        portfolio_low_values.append(weighted_low * 100.0)

    benchmark_values = []
    if include_benchmark and benchmark_valid and benchmark in normalized.columns:
        benchmark_values = [finite_number(value, 1.0) * 100.0 for value in normalized[benchmark].tolist()]
    elif include_benchmark:
        issues.append({"code": "BENCHMARK_PRICE_HISTORY_MISSING", "ticker": benchmark})
    beta_reference_values = []
    if has_beta_reference and valid_beta_tickers:
        beta_reference_values = portfolio_nav_from_normalized(normalized, valid_beta_tickers, beta_weights, beta_cash_weight)
    elif has_beta_reference:
        issues.append({"code": "BETA_BENCHMARK_EMPTY", "detail": "No valid price history remained for the beta reference portfolio."})

    dates = [idx.strftime("%Y-%m-%d") for idx in normalized.index]
    beta_metric_values = beta_reference_values or benchmark_values
    beta_metric_name = beta_reference_name if beta_reference_values else benchmark if benchmark_values else ""
    strategy_result = None
    if strategy_config:
        if strategy_config.get("type") == "portfolio_matrix_dsl":
            strategy_result = apply_portfolio_matrix_dsl_strategy(
                dates,
                portfolio_values,
                strategy_config,
                normalized,
                strategy_tickers,
                adjusted_weights,
                cash_weight,
                beta_metric_name,
                beta_metric_values,
            )
            if not strategy_result:
                emit(
                    {
                        "ok": False,
                        "code": "STRATEGY_INSUFFICIENT_HISTORY",
                        "error": "Not enough price history or supported source fields to evaluate the portfolio-matrix-dsl strategy.",
                        "strategy": strategy_config,
                        "issues": issues,
                    }
                )
                return 0
            portfolio_values = strategy_result["values"]
        else:
            emit(
                {
                    "ok": False,
                    "code": "STRATEGY_UNSUPPORTED",
                    "error": strategy_config.get("reason") or "The supplied strategy is not executable yet.",
                    "strategy": strategy_config,
                }
            )
            return 0

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
        "portfolioReturn": safe_round(portfolio_values[-1] / portfolio_values[0] * 100.0 - 100.0, 2) if portfolio_values[0] else None,
        "portfolioMaxDrawdown": safe_round(max_drawdown(portfolio_values), 2),
        "portfolioAnnualizedVolatility": safe_round(annualized_volatility(portfolio_values), 2),
        "benchmarkReturn": safe_round(benchmark_values[-1] / benchmark_values[0] * 100.0 - 100.0, 2) if benchmark_values else None,
        "benchmarkMaxDrawdown": safe_round(max_drawdown(benchmark_values), 2) if benchmark_values else None,
        "cashWeight": safe_round(cash_weight * 100.0, 2),
        "pricedWeight": safe_round(valid_weight_sum * 100.0, 2),
    }
    strategy_metrics = strategy_result.get("metrics") if isinstance(strategy_result, dict) and isinstance(strategy_result.get("metrics"), dict) else {}
    metrics["standard"] = strategy_metrics.get("standard") or standard_metric_row("Portfolio", portfolio_values, beta_metric_name, beta_metric_values)
    if strategy_metrics.get("metricProfile"):
        metrics["metricProfile"] = strategy_metrics.get("metricProfile")
    if benchmark_values:
        benchmark_standard = standard_metric_row(benchmark, benchmark_values, benchmark, benchmark_values)
        benchmark_standard["beta"] = 1.0
        metrics["benchmarkStandard"] = benchmark_standard

    emit(
        {
            "ok": True,
            "source": "yfinance",
            "methodology": (
                "Current values or supplied weights are normalized to adjusted daily close history; portfolio-matrix-dsl transforms price rows into target-weight signals with next-interval execution; cash is modeled as flat NAV."
                if strategy_result and strategy_config.get("type") == "portfolio_matrix_dsl"
                else "Current values or supplied weights are normalized and applied to adjusted daily close history; cash is modeled as flat NAV."
            ),
            "fetchedAt": datetime.now(timezone.utc).isoformat(),
            "period": period,
            "startDate": start_date,
            "endDate": end_date,
            "timeframe": interval,
            "scenarioMatrix": scenario_matrix,
            "benchmark": benchmark if include_benchmark else "",
            "includeBenchmark": include_benchmark,
            "betaBenchmark": beta_metric_name,
            "betaBenchmarkTickers": valid_beta_tickers,
            "tickers": valid_tickers,
            "issues": issues,
            "metrics": metrics,
            "strategy": strategy_result
            and {
                "name": strategy_config["name"],
                "type": strategy_config["type"],
                "parameters": strategy_result["parameters"],
                "trades": strategy_result["trades"][:120],
                "tradeCount": len(strategy_result["trades"]),
                "exposurePct": strategy_result["exposurePct"],
            },
            "series": series,
        }
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
