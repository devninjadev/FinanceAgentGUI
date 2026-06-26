# Report Files

FinanceAgentGUI uses a file-based report system. The local app does not need a report database for ordinary browsing, search, or reading.

## Storage

- Generated user-facing reports should be written under `data/reports/`.
- Existing World Memory market reports are also discoverable from `logs/world-memory/`.
- A standalone copied `GuiBuild/` folder should still work with these paths.
- Runtime report files are local user state and should stay gitignored.

## API

- The web server exposes `GET /api/reports`.
- Sidebar-agent generated reports can be saved with `POST /api/reports`.
- Report deletion uses `DELETE /api/reports?id=<report-id>` after explicit UI confirmation.
- The endpoint scans configured report folders, reads supported files, and returns normalized report metadata plus display sections.
- `POST /api/reports` accepts a validated `save_report_artifact` payload and writes a Markdown file under `data/reports/`.
- Delete requests accept only the opaque report id from the list response; file paths are not a UI/API input.
- Supported extensions are `.md`, `.markdown`, `.txt`, `.html`, and `.json`.
- `FINANCE_AGENT_GUI_REPORT_DIRS` can add extra local report folders. Separate paths with the host platform path delimiter.

## Generation Catalog

- `config/report-catalog.json` is the self-contained catalog of report procedures injected into sidebar-agent context on the Reports screen.
- The catalog is advisory until a specific job runner is implemented. Agents should use it to choose a report type, explain fit, collect missing inputs, and propose an approved execution path.
- Report-generating procedures should write user-facing artifacts under `data/reports/` unless a future workflow documents a different runtime folder under `data/`.
- Clear report-writing requests on the Reports screen use an LLM-controlled `report_artifact` action. The GUI hides the action block, validates the schema, saves the Markdown artifact, then refreshes the visible list.
- Ordinary chat, catalog questions, and ambiguous draft/planning requests should not emit `report_artifact`; they remain sidebar chat only.

## UI Contract

- The Reports page reads from `/api/reports`.
- The Reports reader is implemented in `web/src/reports/ReportsView.jsx` and is lazy-loaded by `App.jsx`.
- Search is client-side over title, category, summary, tags, and parsed section text.
- Report generation guidance should stay in the sidebar-agent context, not as a visible Reports-page catalog or report-type picker.
- File paths, extensions, and raw JSON are implementation details and should not be shown in the reader UI.
- A list item delete control should appear only for the selected or hovered/focused report.
- The UI should not require SQLite or another report index until the file count or feature set clearly demands it.

## Rich Blocks

- Markdown sections can include fenced `echarts` or `chart` blocks containing a JSON ECharts option object.
- JSON reports can include `charts: [{ heading, body, option }]`.
- Rich blocks should render as user-facing objects in the reader, not as raw code or JSON.
- The shared chart renderer in `web/src/portfolio/PortfolioEChart.jsx` registers line, pie, bar, and scatter chart types. If a report needs another ECharts series or component type, extend that runtime deliberately instead of importing the full ECharts distribution.
