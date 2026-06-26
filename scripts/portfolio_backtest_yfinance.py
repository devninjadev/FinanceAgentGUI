#!/usr/bin/env python3
import json
import math
import re
import sys
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
    supported_ops = {"indicator", "rolling", "rank", "rebalance", "rule", "emit"}
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
    return {
        "type": "portfolio_matrix_dsl",
        "name": clean_label(strategy.get("name") or strategy.get("title"), "Portfolio Matrix DSL"),
        "language": "portfolio-matrix-dsl",
        "version": int(finite_number(function_spec.get("version"), 1) or 1),
        "program": program[:64],
        "signalRows": signal_rows[:5000],
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


def matrix_dsl_rebalance_config(program):
    for step in program or []:
        if not isinstance(step, dict):
            continue
        op = str(step.get("op") or step.get("type") or "").strip().lower()
        if op != "rebalance":
            continue
        method = str(step.get("method") or step.get("name") or "threshold_band").strip().lower()
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


def apply_portfolio_matrix_dsl_strategy(
    dates,
    portfolio_values,
    config,
    normalized=None,
    tickers=None,
    weights=None,
    cash_weight=0.0,
):
    if len(portfolio_values) < 3:
        return None
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

    tickers = sorted(set(weights) | set(beta_weights) | ({benchmark} if include_benchmark and benchmark else set()))
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

    valid_beta_tickers = [ticker for ticker in beta_weights if ticker in close.columns and close[ticker].dropna().shape[0] >= 2]
    if has_beta_reference:
        for ticker in [ticker for ticker in beta_weights if ticker not in valid_beta_tickers]:
            issues.append({"code": "BETA_BENCHMARK_PRICE_HISTORY_MISSING", "ticker": ticker})

    if not valid_tickers:
        emit({"ok": False, "code": "NO_VALID_PRICE_HISTORY", "error": "No supplied tickers had enough yfinance price history.", "issues": issues})
        return 0

    valid_weight_sum = sum(weights[ticker] for ticker in valid_tickers)
    benchmark_valid = include_benchmark and benchmark in close.columns and close[benchmark].dropna().shape[0] >= 2
    aligned_columns = list(dict.fromkeys(valid_tickers + valid_beta_tickers + ([benchmark] if benchmark_valid else [])))
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
    strategy_config = parse_portfolio_strategy_config(payload)
    strategy_result = None
    if strategy_config:
        if strategy_config.get("type") == "portfolio_matrix_dsl":
            strategy_result = apply_portfolio_matrix_dsl_strategy(
                dates,
                portfolio_values,
                strategy_config,
                normalized,
                valid_tickers,
                adjusted_weights,
                cash_weight,
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
        "portfolioReturn": safe_round(portfolio_values[-1] / portfolio_values[0] * 100.0 - 100.0, 2),
        "portfolioMaxDrawdown": safe_round(max_drawdown(portfolio_values), 2),
        "portfolioAnnualizedVolatility": safe_round(annualized_volatility(portfolio_values), 2),
        "benchmarkReturn": safe_round(benchmark_values[-1] / benchmark_values[0] * 100.0 - 100.0, 2) if benchmark_values else None,
        "benchmarkMaxDrawdown": safe_round(max_drawdown(benchmark_values), 2) if benchmark_values else None,
        "cashWeight": safe_round(cash_weight * 100.0, 2),
        "pricedWeight": safe_round(valid_weight_sum * 100.0, 2),
    }
    beta_metric_values = beta_reference_values or benchmark_values
    beta_metric_name = beta_reference_name if beta_reference_values else benchmark if benchmark_values else ""
    metrics["standard"] = standard_metric_row("Portfolio", portfolio_values, beta_metric_name, beta_metric_values)
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
