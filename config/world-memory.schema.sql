-- FinanceAgentGUI World Memory SQLite schema blueprint.
--
-- Do not commit a generated runtime database. The local database is created at
-- data/world-memory/world_issue_log.sqlite3 and is intentionally ignored by Git.
-- This SQL file documents the durable empty-store shape that local agents and
-- repair scripts can recreate without overwriting a user's existing memory.
--
-- Runtime defaults:
-- - database file: data/world-memory/world_issue_log.sqlite3
-- - owner script: scripts/world_memory_cli.py
-- - init command: python scripts/world_memory_cli.py init

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS world_issue_entries (
  event_id TEXT PRIMARY KEY,
  as_of TEXT NOT NULL,
  issue_date TEXT NOT NULL,
  category TEXT NOT NULL,
  region TEXT NOT NULL,
  importance TEXT NOT NULL,
  entry_mode TEXT NOT NULL DEFAULT 'issue',
  dedupe_key TEXT NOT NULL DEFAULT '',
  logged_at TEXT NOT NULL,
  title TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_world_issue_entries_as_of
  ON world_issue_entries(as_of DESC);

CREATE INDEX IF NOT EXISTS idx_world_issue_entries_filters
  ON world_issue_entries(issue_date, category, region, importance);

CREATE INDEX IF NOT EXISTS idx_world_issue_entries_entry_mode
  ON world_issue_entries(entry_mode, issue_date, category, region, importance);

CREATE INDEX IF NOT EXISTS idx_world_issue_entries_dedupe_key
  ON world_issue_entries(dedupe_key, issue_date DESC);

CREATE TABLE IF NOT EXISTS world_issue_embeddings (
  event_id TEXT NOT NULL,
  embedding_engine TEXT NOT NULL,
  embedding_model TEXT NOT NULL,
  text_hash TEXT NOT NULL,
  embedding_dims INTEGER NOT NULL,
  embedding_blob BLOB NOT NULL,
  embedded_text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (event_id, embedding_engine, embedding_model),
  FOREIGN KEY (event_id) REFERENCES world_issue_entries(event_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_world_issue_embeddings_profile
  ON world_issue_embeddings(embedding_engine, embedding_model, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_world_issue_embeddings_hash
  ON world_issue_embeddings(embedding_engine, embedding_model, text_hash);

CREATE TABLE IF NOT EXISTS world_issue_taxonomy (
  taxonomy_type TEXT NOT NULL,
  value TEXT NOT NULL,
  status TEXT NOT NULL,
  source TEXT NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 0,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  PRIMARY KEY (taxonomy_type, value)
);

CREATE INDEX IF NOT EXISTS idx_world_issue_taxonomy_type
  ON world_issue_taxonomy(taxonomy_type, usage_count DESC, value);

CREATE TABLE IF NOT EXISTS world_issue_states (
  state_id TEXT PRIMARY KEY,
  state_key TEXT NOT NULL,
  state_label TEXT NOT NULL,
  state_status TEXT NOT NULL,
  state_bias TEXT NOT NULL,
  net_effect TEXT NOT NULL,
  summary TEXT NOT NULL,
  rationale TEXT NOT NULL,
  source_event_id TEXT NOT NULL,
  caused_by_event_id TEXT,
  supersedes_state_id TEXT,
  replaced_by_state_id TEXT,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  confidence REAL NOT NULL,
  source_kind TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  FOREIGN KEY (source_event_id) REFERENCES world_issue_entries(event_id),
  FOREIGN KEY (caused_by_event_id) REFERENCES world_issue_entries(event_id),
  FOREIGN KEY (supersedes_state_id) REFERENCES world_issue_states(state_id),
  FOREIGN KEY (replaced_by_state_id) REFERENCES world_issue_states(state_id)
);

CREATE INDEX IF NOT EXISTS idx_world_issue_states_key_status
  ON world_issue_states(state_key, state_status, effective_from DESC);

CREATE INDEX IF NOT EXISTS idx_world_issue_states_source_event
  ON world_issue_states(source_event_id);

CREATE INDEX IF NOT EXISTS idx_world_issue_states_effective_from
  ON world_issue_states(effective_from DESC);

CREATE TABLE IF NOT EXISTS world_issue_story_links (
  link_id TEXT PRIMARY KEY,
  story_key TEXT NOT NULL,
  story_label TEXT NOT NULL,
  related_story_key TEXT NOT NULL,
  related_story_label TEXT NOT NULL,
  relation_type TEXT NOT NULL,
  story_family_key TEXT NOT NULL,
  story_family_label TEXT NOT NULL,
  source_event_id TEXT NOT NULL DEFAULT '',
  source_kind TEXT NOT NULL,
  note TEXT NOT NULL,
  confidence REAL NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  UNIQUE (story_key, related_story_key, relation_type, source_event_id, source_kind)
);

CREATE INDEX IF NOT EXISTS idx_world_issue_story_links_story
  ON world_issue_story_links(story_key, relation_type, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_world_issue_story_links_related
  ON world_issue_story_links(related_story_key, relation_type, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_world_issue_story_links_family
  ON world_issue_story_links(story_family_key, updated_at DESC);

CREATE TABLE IF NOT EXISTS world_issue_story_family_suggestions (
  suggestion_id TEXT PRIMARY KEY,
  parent_family_key TEXT NOT NULL,
  parent_family_label TEXT NOT NULL,
  proposed_family_key TEXT NOT NULL,
  proposed_family_label TEXT NOT NULL,
  member_story_keys_json TEXT NOT NULL,
  member_story_labels_json TEXT NOT NULL,
  rationale TEXT NOT NULL,
  confidence REAL NOT NULL,
  status TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  UNIQUE (parent_family_key, proposed_family_key, source_kind, status)
);

CREATE INDEX IF NOT EXISTS idx_world_issue_story_family_suggestions_parent
  ON world_issue_story_family_suggestions(parent_family_key, status, updated_at DESC);
