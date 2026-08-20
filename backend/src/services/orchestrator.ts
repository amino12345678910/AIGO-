import { pool } from "../db/supabase";
import { embedQuery } from "./embedder";
import { hybridSearch, getIntroChunks } from "./retriever";
import { callGemini } from "./llm";
import { expandQuery, isKnowledgeBaseQuestion } from "./queryExpansion";
import { ChatMessage, RetrievalResult } from "../types";
import { log, error } from "../utils/logger";

const MIN_SIMILARITY = 0.25;

function buildSystemPrompt(chunks: RetrievalResult[]): string {
  const chunksText =
    chunks.length > 0
      ? chunks
          .map(
            (c, i) =>
              `[SOURCE ${i + 1}] (${c.file_name}, relevance: ${c.similarity.toFixed(2)})\n${c.content}`
          )
          .join("\n\n---\n\n")
      : "No specific course material found for this query.";

  return `You are AIGO, an AI tutor specialized in helping Tunisian secondary school students.

You have access to the following course material:

${chunksText}

RULES:
- Always ground your explanations in the provided sources above when relevant.
- If the answer is not in the sources, say it is not found. Do not fabricate data.
- Use the student's preferred language naturally (French, Arabic, Darija, or English - match what they use).
- Be concise but complete. This is a study session, not an essay.
- When solving exercises, show every step. Never skip reasoning.
- If the student seems confused, try a different explanation approach.
- You remember the full conversation below - maintain continuity.
- When showing formulas, use proper mathematical notation.
- Use tables for lists.`;
}

export async function handleUserMessage(
  sessionId: number,
  userMessage: string,
  ragEnabled: boolean = true
): Promise<{ text: string; chunksUsed: number[] }> {
  const historyResult = await pool.query(
    `SELECT role, content FROM chat_messages
     WHERE session_id = $1
     ORDER BY created_at ASC`,
    [sessionId]
  );

  const history: ChatMessage[] = historyResult.rows.map((row) => ({
    id: 0,
    session_id: sessionId,
    role: row.role,
    content: row.content,
    created_at: "",
  }));

  const lastHistory = history.slice(-10);

  let chunks: RetrievalResult[] = [];

  if (ragEnabled) {
    const expandedQuery = expandQuery(userMessage);
    const queryEmbedding = await embedQuery(expandedQuery);

    chunks = await hybridSearch(queryEmbedding, expandedQuery, 15);
    chunks = chunks.filter((c) => c.similarity >= MIN_SIMILARITY);

    if (chunks.length === 0 && isKnowledgeBaseQuestion(userMessage)) {
      chunks = await getIntroChunks(8);
    }
  }

  const systemPrompt = buildSystemPrompt(chunks);

  const response = await callGemini(systemPrompt, lastHistory, userMessage);

  const chunkIds = chunks.map((c) => c.id);

  await pool.query(
    `INSERT INTO chat_messages (session_id, role, content, chunks_used)
     VALUES ($1, 'user', $2, '{}')`,
    [sessionId, userMessage]
  );

  await pool.query(
    `INSERT INTO chat_messages (session_id, role, content, chunks_used)
     VALUES ($1, 'assistant', $2, $3)`,
    [sessionId, response.text, chunkIds]
  );

  await pool.query(
    `UPDATE chat_sessions SET updated_at = now() WHERE id = $1`,
    [sessionId]
  );

  return { text: response.text, chunksUsed: chunkIds };
}
