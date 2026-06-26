# World Memory Storage Contract

FinanceAgentGUI ships the World Memory engine shape, not a starter database.

The runtime database is local user state:

- path: `data/world-memory/world_issue_log.sqlite3`
- collector state: `data/world-memory/collector-state.json`
- logs and generated review artifacts: `logs/world-memory/*`

These files are intentionally ignored by Git. Do not commit an empty SQLite file,
sample SQLite file, copied user memory, collector state, generated embeddings,
or collection logs. Even an empty tracked database can overwrite or confuse a
user's existing local memory during clone, pull, archive extraction, or repair.

## Tracked Blueprint

The tracked design artifacts are:

- `config/world-memory.schema.sql`: empty-store SQLite schema blueprint.
- `config/world-memory-collection.prompt.md`: collection and curation operating rules.
- `scripts/world_memory_cli.py`: owner CLI that creates, migrates, reads, and writes the store.
- `scripts/world_memory_harness.py`: verification harness for store health.
- `tests/test_world_memory_cli.py` and `tests/test_world_memory_harness.py`: behavior checks.

The schema file is documentation and repair guidance. The CLI remains the runtime
owner because it also seeds system taxonomy and applies compatibility migrations.

## Initialization

From `GuiBuild/`, initialize a local store only when the user does not already
have one:

```bash
python scripts/world_memory_cli.py init
```

The command creates `data/world-memory/world_issue_log.sqlite3` if needed and
preserves existing local data. Local agents should check whether the file exists
before proposing destructive repair.

## Current SQLite Shape

The current store contains these tables:

- `world_issue_entries`: canonical issue and brief records. Each row stores
  searchable columns plus the normalized source payload in `payload_json`.
- `world_issue_embeddings`: sidecar semantic-search vectors keyed by event,
  engine, and model. Embeddings are generated runtime artifacts, not seed data.
- `world_issue_taxonomy`: indexed taxonomy values derived from entries, states,
  stories, and system taxonomy.
- `world_issue_states`: active, watch, or replaced market-regime state rows.
- `world_issue_story_links`: explicit story relation and family links.
- `world_issue_story_family_suggestions`: proposed story-family split or cleanup
  suggestions awaiting review.

All richer record fields should live inside `payload_json` unless they are needed
for filtering, joins, ordering, dedupe, or verification. This keeps the table
surface stable while allowing memory payloads to evolve.

## Data Safety Rules

- Never add `data/world-memory/world_issue_log.sqlite3` to Git.
- Never create a tracked zero-byte or empty SQLite placeholder.
- Keep only `data/world-memory/.gitkeep` tracked so the local runtime directory
  exists after checkout.
- Treat `collector-state.json` as generated local state.
- Treat embeddings as rebuildable local artifacts.
- Before running repair that could delete, replace, or import many rows, show the
  target path, planned impact, dry-run output when available, and confirmation
  boundary.
- After writes, verify with the narrowest relevant command, usually `audit`,
  `embed-status`, or `python scripts/world_memory_harness.py --strict`.

## Repair Guidance

If the store is missing, run `python scripts/world_memory_cli.py init` rather
than copying a database into place.

If the schema appears stale, prefer the CLI's init or migration path first. Use
`config/world-memory.schema.sql` as the human-readable target shape for local
repair, but do not replace a populated user database without an explicit backup
and confirmation.

If a Git command shows `data/world-memory/world_issue_log.sqlite3` as staged or
tracked, stop and remove it from the index before continuing.
