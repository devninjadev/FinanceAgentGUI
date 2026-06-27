# FinanceAgentGUI

FinanceAgentGUI is a local browser-based operations console for finance automation.

The repository root is the distributable app root. The app runs locally on
`127.0.0.1`; runtime data, secrets, logs, reports, browser profiles, shared
memory, and World Memory databases are stored locally and excluded from Git.

## Repository Shape

On GitHub, this app's contents should be at the repository root. If you are
working from a local development wrapper where the app lives in `GuiBuild/`,
publish the contents of that folder, not the wrapper folder itself.

## Getting Started

- Install and run: [docs/installation.md](docs/installation.md)
- Compatibility and repair notes: [docs/compatibility.md](docs/compatibility.md)
- Runtime agent instructions: [AGENTS.md](AGENTS.md)

## Current Scope

- News Feed collection and settings
- World Memory local engine controls
- Portfolio workspaces, widgets, and backtest helpers
- Report browsing and saved report artifacts
- Local agent chat surfaces for operational workflows

## License

This project is licensed under the [BSD 3-Clause License](LICENSE).
