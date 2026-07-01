import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { deleteMagazineEventSignatureIndexEntry } from "../server/magazineApi.mjs";

let sqliteModule = null;
try {
  sqliteModule = await import("node:sqlite");
} catch {
  sqliteModule = null;
}

const CREATE_EVENT_SIGNATURE_TABLE_SQL = `
CREATE TABLE magazine_event_signature_embeddings (
  article_id TEXT PRIMARY KEY,
  embedding_engine TEXT NOT NULL,
  embedding_model TEXT NOT NULL,
  signature_hash TEXT NOT NULL,
  embedding_dims INTEGER NOT NULL,
  embedding_blob BLOB NOT NULL,
  signature_text TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

function insertIndexRow(db, articleId) {
  db.prepare(
    `INSERT INTO magazine_event_signature_embeddings (
      article_id, embedding_engine, embedding_model, signature_hash,
      embedding_dims, embedding_blob, signature_text, updated_at
    )
    VALUES (?, 'sentence-transformers', 'model', ?, 1, ?, ?, CURRENT_TIMESTAMP)`,
  ).run(articleId, `${articleId}-hash`, Buffer.from([1, 2, 3, 4]), `${articleId} signature`);
}

function indexRowCount(db, articleId) {
  const row = db.prepare("SELECT COUNT(*) AS count FROM magazine_event_signature_embeddings WHERE article_id = ?").get(articleId);
  return Number(row.count) || 0;
}

test(
  "magazine article deletion removes only the matching event-signature index row",
  { skip: sqliteModule ? false : "node:sqlite unavailable" },
  async () => {
    const { DatabaseSync } = sqliteModule;
    const tempDir = await mkdtemp(join(tmpdir(), "magazine-index-delete-"));
    const indexPath = join(tempDir, "event-signature-index.sqlite3");
    let db = new DatabaseSync(indexPath);

    try {
      db.exec(CREATE_EVENT_SIGNATURE_TABLE_SQL);
      insertIndexRow(db, "delete-me");
      insertIndexRow(db, "keep-me");
      db.close();
      db = null;

      const result = await deleteMagazineEventSignatureIndexEntry("delete-me", { indexPath });
      db = new DatabaseSync(indexPath);

      assert.equal(result.ok, true);
      assert.equal(result.deleted, true);
      assert.equal(result.deletedCount, 1);
      assert.equal(indexRowCount(db, "delete-me"), 0);
      assert.equal(indexRowCount(db, "keep-me"), 1);
    } finally {
      db?.close();
      await rm(tempDir, { recursive: true, force: true });
    }
  },
);
