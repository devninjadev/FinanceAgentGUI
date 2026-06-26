#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts import world_memory_cli as wm  # noqa: E402


def _to_int(value: Any, default: int = 0) -> int:
    try:
        return int(float(str(value).strip()))
    except (TypeError, ValueError):
        return default


def _to_percent(value: Any, default: float = 0.0) -> float:
    text = str(value).strip()
    if text.endswith("%"):
        text = text[:-1]
    try:
        return float(text)
    except (TypeError, ValueError):
        return default


def _index_audit_rows(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    index: dict[str, dict[str, Any]] = {}
    for row in rows:
        key = str(row.get("Metric", "")).strip()
        if key:
            index[key] = row
    return index


def _find_metric_key(index: dict[str, dict[str, Any]], prefix: str) -> str:
    for key in index:
        if key.startswith(prefix):
            return key
    return ""


def _metric_value(index: dict[str, dict[str, Any]], metric: str, default: Any = 0) -> Any:
    row = index.get(metric)
    if row is None:
        return default
    return row.get("Value", default)


def _evaluate_threshold(value: float, threshold: float, operator: str) -> bool:
    if operator == "<=":
        return value <= threshold
    if operator == ">=":
        return value >= threshold
    raise ValueError(f"Unsupported operator: {operator}")


def _build_checks(
    *,
    rows: list[dict[str, Any]],
    days: int,
    max_cleanup_candidates: int,
    max_legacy_blank_issues: int,
    max_orphan_brief_ratio: float,
    min_issue_dedupe_fill: float,
    min_brief_dedupe_fill: float,
    min_recent_entries: int,
) -> list[dict[str, Any]]:
    index = _index_audit_rows(rows)
    recent_metric = _find_metric_key(index, "Recent entries (")

    brief_entries = _to_int(_metric_value(index, "Brief entries", 0))
    orphan_briefs = _to_int(_metric_value(index, "Orphan briefs with metadata", 0))
    orphan_brief_ratio = (orphan_briefs / brief_entries * 100.0) if brief_entries > 0 else 0.0

    checks = [
        {
            "check": "Cleanup candidates",
            "metric": "Cleanup candidates",
            "operator": "<=",
            "threshold": float(max_cleanup_candidates),
            "value": float(_to_int(_metric_value(index, "Cleanup candidates", 0))),
        },
        {
            "check": "Legacy blank issues",
            "metric": "Legacy blank issues",
            "operator": "<=",
            "threshold": float(max_legacy_blank_issues),
            "value": float(_to_int(_metric_value(index, "Legacy blank issues", 0))),
        },
        {
            "check": "Orphan brief ratio",
            "metric": "Orphan briefs with metadata / Brief entries",
            "operator": "<=",
            "threshold": float(max_orphan_brief_ratio),
            "value": float(orphan_brief_ratio),
        },
        {
            "check": "Issue dedupe fill rate",
            "metric": "Issue dedupe fill rate",
            "operator": ">=",
            "threshold": float(min_issue_dedupe_fill),
            "value": float(_to_percent(_metric_value(index, "Issue dedupe fill rate", "0%"))),
        },
        {
            "check": "Brief dedupe fill rate",
            "metric": "Brief dedupe fill rate",
            "operator": ">=",
            "threshold": float(min_brief_dedupe_fill),
            "value": float(_to_percent(_metric_value(index, "Brief dedupe fill rate", "0%"))),
        },
        {
            "check": "Recent entries volume",
            "metric": recent_metric or f"Recent entries ({max(1, days)}d)",
            "operator": ">=",
            "threshold": float(min_recent_entries),
            "value": float(_to_int(_metric_value(index, recent_metric, 0))),
        },
    ]

    results: list[dict[str, Any]] = []
    for item in checks:
        ok = _evaluate_threshold(item["value"], item["threshold"], item["operator"])
        results.append(
            {
                "check": item["check"],
                "metric": item["metric"],
                "status": "pass" if ok else "warn",
                "value": item["value"],
                "threshold": item["threshold"],
                "operator": item["operator"],
            }
        )
    return results


def _format_value(item: dict[str, Any]) -> str:
    value = float(item["value"])
    threshold = float(item["threshold"])
    if "fill rate" in str(item.get("check", "")).lower() or "ratio" in str(item.get("check", "")).lower():
        return f"{value:.1f}% (기준 {item['operator']} {threshold:.1f}%)"
    return f"{int(round(value))} (기준 {item['operator']} {int(round(threshold))})"


def _render_markdown(
    *,
    db_path: Path,
    days: int,
    checks: list[dict[str, Any]],
    strict: bool,
    exit_code: int,
) -> str:
    warn_count = sum(1 for item in checks if item["status"] != "pass")
    lines = [
        "# 월드 메모리 유지보수 하네스",
        "",
        f"- DB: `{db_path}`",
        f"- Audit 기준 기간: `{days}`일",
        f"- Strict 모드: `{'on' if strict else 'off'}`",
        f"- 결과: `{'PASS' if warn_count == 0 else 'WARN'}` (warn={warn_count})",
        "",
        "| Check | Status | Metric | Value / Threshold |",
        "| --- | --- | --- | --- |",
    ]
    for item in checks:
        lines.append(
            f"| {item['check']} | {item['status']} | {item['metric']} | {_format_value(item)} |"
        )

    if warn_count > 0:
        lines.extend(
            [
                "",
                "권장 유지보수 액션:",
                "1. `python3 scripts/world_memory_cli.py audit --format md`로 원인 지표 상세 확인",
                "2. `python3 scripts/world_memory_cli.py cleanup --dry-run`으로 변경 예정 건수 확인",
                "3. 필요 시 `python3 scripts/world_memory_cli.py cleanup` 실행 후 재점검",
            ]
        )

    lines.append(f"")
    lines.append(f"exit_code={exit_code}")
    return "\n".join(lines).rstrip() + "\n"


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="월드 메모리 DB의 유지보수 지표를 빠르게 점검하는 하네스",
    )
    parser.add_argument("--base-dir", default=wm.DEFAULT_BASE_DIR, help="DB 베이스 디렉터리")
    parser.add_argument("--db-file", default=wm.DEFAULT_DB_FILE, help="SQLite 파일명")
    parser.add_argument("--days", type=int, default=30, help="audit 기준 기간(일)")
    parser.add_argument("--max-cleanup-candidates", type=int, default=0, help="허용 cleanup candidate 최대치")
    parser.add_argument("--max-legacy-blank-issues", type=int, default=0, help="허용 legacy blank issue 최대치")
    parser.add_argument(
        "--max-orphan-brief-ratio",
        type=float,
        default=25.0,
        help="허용 orphan brief 비율(%%)",
    )
    parser.add_argument("--min-issue-dedupe-fill", type=float, default=95.0, help="issue dedupe fill 최소치(%%)")
    parser.add_argument("--min-brief-dedupe-fill", type=float, default=95.0, help="brief dedupe fill 최소치(%%)")
    parser.add_argument("--min-recent-entries", type=int, default=1, help="최근 기간 최소 엔트리 개수")
    parser.add_argument("--strict", action="store_true", help="warn이 있으면 종료코드 1로 반환")
    parser.add_argument("--format", choices=["md", "json"], default="md", help="출력 형식")
    parser.add_argument("--out", default=None, help="출력 파일 경로")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    days = max(1, int(args.days))

    db_path = wm._ensure_db(args.base_dir, args.db_file)
    with wm._connect_db(db_path) as conn:
        wm._init_db(conn)
        rows = wm._build_audit_rows(conn, recent_days=days)

    checks = _build_checks(
        rows=rows,
        days=days,
        max_cleanup_candidates=max(0, int(args.max_cleanup_candidates)),
        max_legacy_blank_issues=max(0, int(args.max_legacy_blank_issues)),
        max_orphan_brief_ratio=max(0.0, float(args.max_orphan_brief_ratio)),
        min_issue_dedupe_fill=max(0.0, float(args.min_issue_dedupe_fill)),
        min_brief_dedupe_fill=max(0.0, float(args.min_brief_dedupe_fill)),
        min_recent_entries=max(0, int(args.min_recent_entries)),
    )
    warn_count = sum(1 for item in checks if item["status"] != "pass")
    exit_code = 1 if args.strict and warn_count > 0 else 0

    if args.format == "json":
        payload = {
            "db_path": str(db_path),
            "days": days,
            "strict": bool(args.strict),
            "warn_count": warn_count,
            "checks": checks,
            "audit_rows": rows,
            "exit_code": exit_code,
        }
        wm._emit_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", args.out)
        return exit_code

    text = _render_markdown(
        db_path=db_path,
        days=days,
        checks=checks,
        strict=bool(args.strict),
        exit_code=exit_code,
    )
    wm._emit_text(text, args.out)
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
