import { config } from "../config/env";
import { ChatMessage } from "../types";

const GEMINI_API_KEY = config.geminiApiKey;
const GEMINI_MODEL = config.geminiModel;
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export async function callGemini(
  systemPrompt: string,
  history: ChatMessage[],
  userMessage: string
): Promise<{ text: string }> {
  const url = `${BASE_URL}/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const chatHistory = history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const payload = {
    contents: [
      ...chatHistory,
      { role: "user", parts: [{ text: userMessage }] },
    ],
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2048,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${body}`);
  }

  const data = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const candidates = data.candidates;
  if (!candidates || candidates.length === 0 || !candidates[0].content?.parts?.[0]?.text) {
    throw new Error("No response from Gemini");
  }

  return { text: candidates[0].content.parts[0].text! };
}

export async function callGeminiOcr(
  base64Data: string,
  mimeType: string
): Promise<string> {
  const url = `${BASE_URL}/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const payload = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
          {
            text: "Extract all text from this PDF document exactly as it appears, preserving paragraphs and layout. Include any Arabic text properly.",
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.0,
      maxOutputTokens: 8192,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    throw new Error(`Gemini OCR failed: ${response.status}`);
  }

  const data = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}
