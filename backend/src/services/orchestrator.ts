import { pool } from "../db/supabase";
import { embedQuery } from "./embedder";
import { hybridSearch, getIntroChunks } from "./retriever";
import { callGemini } from "./llm";
import { expandQuery, isKnowledgeBaseQuestion } from "./queryExpansion";
import { ChatMessage, RetrievalResult } from "../types";
import { log, error } from "../utils/logger";

const MIN_SIMILARITY = 0.25;

function buildSystemPrompt(chunks: RetrievalResult[], attachmentContext?: { fileName: string; text: string }): string {
  const chunksText =
    chunks.length > 0
      ? chunks
          .map(
            (c, i) =>
              `[SOURCE ${i + 1}] (${c.file_name}, relevance: ${c.similarity.toFixed(2)})\n${c.content}`
          )
          .join("\n\n---\n\n")
      : "No specific course material found for this query.";

  const attachmentSection = attachmentContext
    ? `\n\nATTACHMENT from the student (${attachmentContext.fileName}):\n\n${attachmentContext.text}\n\nThe student has attached this file with their message. Use it to answer their question. If it is an image, describe what you see in detail and answer based on the visual content.`
    : "";

  return `You are AIGO, an AI tutor specialized in helping Tunisian secondary school students.

You have access to the following course material:

${chunksText}
${attachmentSection}

RULES:
- Always ground your explanations in the provided sources above when relevant.
- If the answer is not in the sources, say it is not found. Do not fabricate data.
- Use the student's preferred language naturally (French, Arabic, Darija, or English - match what they use).
- Be concise but complete. This is a study session, not an essay.
- When solving exercises, show every step. Never skip reasoning.
- If the student seems confused, try a different explanation approach.
- You remember the full conversation below - maintain continuity.
- When showing formulas, use proper mathematical notation in LaTeX.
- Use tables for structured comparisons.

DIAGRAMS (IMPORTANT):
When explaining a process, concept, algorithm, architecture, or relationship between ideas, generate a Mermaid diagram to visualize it. This helps students understand complex topics faster.

Use \`\`\`mermaid code blocks for:
- Flowcharts (graph TD or graph LR) for processes and decision trees
- Sequence diagrams for interactions between components
- Class diagrams for OOP concepts
- Mind maps for summarizing topics
- State diagrams for system states
- Gantt charts for project planning (Agile/Scrum)
- ER diagrams for databases

Diagram rules:
- Keep diagrams simple and educational — max 10-12 nodes
- Use clear, descriptive labels in the student's language
- Add short explanations before and after the diagram
- Use meaningful colors with classDef when helpful (e.g., classDef success fill:#d4edda)
- Prefer vertical flow (TD) for processes, horizontal (LR) for sequences
- For algorithms, show the step-by-step flow with decision diamonds

Example flowchart:
\`\`\`mermaid
graph TD
    A[Input Data] --> B{Valid?}
    B -->|Yes| C[Process]
    B -->|No| D[Show Error]
    C --> E[Output Result]
\`\`\`

INTERACTIVE QUIZZES (IMPORTANT):
After explaining a topic, when the student asks to practice/test themselves, or when it would help reinforce learning, generate an interactive quiz using \`\`\`quiz code blocks.

The quiz must be valid JSON with this exact structure:
\`\`\`quiz
{
  "title": "Quiz: Topic Name",
  "questions": [
    {
      "type": "mcq",
      "question": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": 0,
      "explanation": "Why this answer is correct."
    },
    {
      "type": "truefalse",
      "question": "Statement to evaluate.",
      "correct": true,
      "explanation": "Why this is true/false."
    },
    {
      "type": "text",
      "question": "Fill in the blank: The capital of France is ___",
      "correct": "Paris",
      "explanation": "Paris is the capital of France."
    }
  ]
}
\`\`\`

Quiz rules:
- Mix question types (mcq, truefalse, text) for variety
- Always include 4-6 questions per quiz
- Make wrong options plausible (common misconceptions)
- Include clear, educational explanations for every question
- Use the student's language for questions and explanations
- Questions should test understanding, not just memorization
- For mcq: always provide exactly 4 options, correct is the 0-based index
- For truefalse: correct is a boolean (true/false)
- For text: correct is a string (will be matched case-insensitively)
- Title should clearly state the quiz topic`;
}

export async function handleUserMessage(
  sessionId: number,
  userMessage: string,
  ragEnabled: boolean = true,
  attachmentContext?: { fileName: string; text: string },
  attachmentImage?: { mimeType: string; data: string }
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

  const systemPrompt = buildSystemPrompt(chunks, attachmentContext);

  const response = await callGemini(systemPrompt, lastHistory, userMessage, attachmentImage);

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
