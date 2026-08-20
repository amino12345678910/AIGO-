import { config } from "../config/env";

export async function embedQuery(text: string): Promise<number[]> {
  const response = await fetch(`${config.ollamaBaseUrl}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.ollamaEmbeddingModel,
      prompt: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama embedding failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as { embedding: number[] };
  return data.embedding;
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += 4) {
    const batch = texts.slice(i, i + 4);
    const batchResults = await Promise.all(batch.map((text) => embedQuery(text)));
    results.push(...batchResults);
  }

  return results;
}
