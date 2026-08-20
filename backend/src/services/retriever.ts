import { pool } from "../db/supabase";
import { RetrievalResult } from "../types";

const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "need", "dare", "ought",
  "used", "to", "of", "in", "for", "on", "with", "at", "by", "from",
  "as", "into", "through", "during", "before", "after", "above", "below",
  "between", "out", "off", "over", "under", "again", "further", "then",
  "once", "here", "there", "when", "where", "why", "how", "all", "both",
  "each", "few", "more", "most", "other", "some", "such", "no", "nor",
  "not", "only", "own", "same", "so", "than", "too", "very", "just",
  "don", "now", "le", "la", "les", "de", "des", "un", "une", "du",
  "et", "est", "en", "que", "qui", "dans", "ce", "il", "se", "pas",
  "plus", "ou", "mais", "aussi", "bien", "tout", "fait", "peut", "avec",
  "cette", "ces", "mon", "ton", "son", "ma", "ta", "sa", "mes", "tes",
  "ses", "nos", "vos", "leurs", "quel", "quelle", "quels", "quelles",
  "هذا", "هذه", "ذلك", "تلك", "من", "في", "على", "إلى", "عن", "مع",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s\u0600-\u06FF]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

export async function semanticSearch(
  queryEmbedding: number[],
  topK: number = 15
): Promise<RetrievalResult[]> {
  const result = await pool.query(
    `SELECT
       id,
       chunk_text as content,
       file_name,
       chunk_index,
       1 - (embedding <=> $1::vector) as similarity
     FROM knowledge_chunks
     WHERE file_name <> 'chat_history'
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    [JSON.stringify(queryEmbedding), topK]
  );

  return result.rows.map((row) => ({
    id: row.id,
    content: row.content,
    similarity: parseFloat(row.similarity),
    file_name: row.file_name,
    chunk_index: row.chunk_index,
  }));
}

export async function keywordSearch(
  query: string,
  topK: number = 15
): Promise<RetrievalResult[]> {
  const keywords = tokenize(query);
  if (keywords.length === 0) return [];

  const keywordConditions = keywords
    .map((kw, i) => {
      const paramIdx = i + 1;
      return `( LOWER(chunk_text) LIKE '%' || $${paramIdx} || '%' OR LOWER(original_file_name) LIKE '%' || $${paramIdx} || '%' )`;
    })
    .join(" + ");

  const scoring = keywords
    .map((kw, i) => {
      const paramIdx = i + 1;
      return `CASE WHEN LOWER(chunk_text) LIKE '%' || $${paramIdx} || '%' THEN 1 ELSE 0 END + CASE WHEN LOWER(original_file_name) LIKE '%' || $${paramIdx} || '%' THEN 1 ELSE 0 END`;
    })
    .join(" + ");

  const queryStr = `
    SELECT
      id,
      chunk_text as content,
      file_name,
      chunk_index,
      (${scoring})::float / ${keywords.length * 2} as similarity
    FROM knowledge_chunks
    WHERE file_name <> 'chat_history'
      AND (${keywordConditions})
    ORDER BY similarity DESC
    LIMIT $${keywords.length + 1}
  `;

  const params = [...keywords, topK];
  const result = await pool.query(queryStr, params);

  return result.rows.map((row) => ({
    id: row.id,
    content: row.content,
    similarity: parseFloat(row.similarity),
    file_name: row.file_name,
    chunk_index: row.chunk_index,
  }));
}

export async function hybridSearch(
  queryEmbedding: number[],
  query: string,
  topK: number = 15
): Promise<RetrievalResult[]> {
  const [semanticResults, keywordResults] = await Promise.all([
    semanticSearch(queryEmbedding, topK).catch(() => []),
    keywordSearch(query, topK).catch(() => []),
  ]);

  const seen = new Set<number>();
  const merged: RetrievalResult[] = [];

  for (const r of semanticResults) {
    if (!seen.has(r.id)) {
      seen.add(r.id);
      merged.push(r);
    }
  }

  for (const r of keywordResults) {
    if (!seen.has(r.id)) {
      seen.add(r.id);
      merged.push(r);
    }
  }

  return merged.slice(0, topK);
}

export async function getIntroChunks(limit: number = 8): Promise<RetrievalResult[]> {
  const result = await pool.query(
    `SELECT id, chunk_text as content, file_name, chunk_index
     FROM knowledge_chunks
     WHERE file_name <> 'chat_history'
     ORDER BY file_name, chunk_index
     LIMIT $1`,
    [limit]
  );

  return result.rows.map((row) => ({
    id: row.id,
    content: row.content,
    similarity: 0,
    file_name: row.file_name,
    chunk_index: row.chunk_index,
  }));
}
