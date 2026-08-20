import fs from "fs";
import path from "path";
import { pool } from "../db/supabase";
import { extractText, computeTextHash } from "./textExtractor";
import { chunkText } from "./chunker";
import { embedBatch } from "./embedder";
import { log, error } from "../utils/logger";
import { IngestionProgress } from "../types";

const progressMap = new Map<string, IngestionProgress>();

export function getIngestionProgress(fileId: string): IngestionProgress | undefined {
  return progressMap.get(fileId);
}

function updateProgress(fileId: string, progress: IngestionProgress) {
  progressMap.set(fileId, progress);
}

export async function ingestFile(
  fileId: string,
  filePath: string,
  originalFileName: string,
  fileType: string,
  fileUrl: string
): Promise<void> {
  try {
    updateProgress(fileId, { stage: "QUEUED" });

    updateProgress(fileId, { stage: "EXTRACTING" });
    const text = await extractText(filePath, fileType);
    if (!text || text.trim().length === 0) {
      throw new Error("Extracted text is empty");
    }

    const contentHash = computeTextHash(text);

    const existingDoc = await pool.query(
      "SELECT id FROM knowledge_chunks WHERE content_hash = $1 LIMIT 1",
      [contentHash]
    );
    if (existingDoc.rows.length > 0) {
      updateProgress(fileId, {
        stage: "COMPLETED",
        totalChunks: 0,
        indexedChunks: 0,
        error: "Document already exists (duplicate detected)",
      });
      return;
    }

    await pool.query(
      `UPDATE documents SET status = 'processing', content_hash = $1 WHERE id = $2`,
      [contentHash, fileId]
    );

    const chunks = chunkText(text, fileId, originalFileName, fileType);
    if (chunks.length === 0) {
      throw new Error("No chunks generated from document");
    }

    updateProgress(fileId, {
      stage: "INDEXING",
      totalChunks: chunks.length,
      indexedChunks: 0,
    });

    const embeddings = await embedBatch(chunks.map((c) => c.content));

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      for (let i = 0; i < chunks.length; i++) {
        await client.query(
          `INSERT INTO knowledge_chunks
           (document_id, file_name, original_file_name, file_type, chunk_index, chunk_text, embedding, content_hash)
           VALUES ($1, $2, $3, $4, $5, $6, $7::vector, $8)`,
          [
            chunks[i].document_id,
            chunks[i].file_name,
            originalFileName,
            fileType,
            chunks[i].chunk_index,
            chunks[i].content,
            JSON.stringify(embeddings[i]),
            contentHash,
          ]
        );
      }

      await client.query(
        `UPDATE documents SET status = 'indexed', chunk_count = $1 WHERE id = $2`,
        [chunks.length, fileId]
      );

      await client.query("COMMIT");

      updateProgress(fileId, {
        stage: "COMPLETED",
        totalChunks: chunks.length,
        indexedChunks: chunks.length,
      });

      log("Document indexed", { fileId, chunks: chunks.length });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    error("Ingestion failed", err);
    updateProgress(fileId, {
      stage: "FAILED",
      error: errMsg,
    });
    await pool.query(
      `UPDATE documents SET status = 'failed', error_msg = $1 WHERE id = $2`,
      [errMsg, fileId]
    );
  }
}
