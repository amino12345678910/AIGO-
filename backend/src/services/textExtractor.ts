import fs from "fs";
import crypto from "crypto";
import pdf from "pdf-parse";
import mammoth from "mammoth";
import { callGeminiOcr } from "./llm";

const pdfParse = pdf as unknown as (buffer: Buffer) => Promise<{ text: string }>;

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp"]);
const IMAGE_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

export async function extractText(
  filePath: string,
  fileType: string
): Promise<string> {
  const ext = fileType.toLowerCase();

  if (IMAGE_EXTENSIONS.has(ext)) {
    const buffer = fs.readFileSync(filePath);
    const base64Data = buffer.toString("base64");
    const mimeType = IMAGE_MIME[ext] || "image/png";
    const description = await callGeminiOcr(base64Data, mimeType);
    if (!description || description.trim().length === 0) {
      throw new Error("Gemini returned no description from image");
    }
    return description;
  }

  switch (ext) {
    case "pdf": {
      const buffer = fs.readFileSync(filePath);
      try {
        const data = await pdfParse(buffer);
        if (data.text && data.text.trim().length > 50) {
          return data.text;
        }
      } catch {}

      const base64Data = buffer.toString("base64");
      const ocrText = await callGeminiOcr(base64Data, "application/pdf");
      if (!ocrText || ocrText.trim().length === 0) {
        throw new Error("Gemini OCR returned empty text for PDF");
      }
      return ocrText;
    }

    case "txt": {
      return fs.readFileSync(filePath, "utf-8");
    }

    case "docx": {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    }

    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}

export function computeTextHash(text: string): string {
  return crypto.createHash("sha256").update(text, "utf-8").digest("hex");
}
