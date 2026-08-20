import fs from "fs";
import crypto from "crypto";
import pdf from "pdf-parse";
import mammoth from "mammoth";
import { callGeminiOcr } from "./llm";

const pdfParse = pdf as unknown as (buffer: Buffer) => Promise<{ text: string }>;

export async function extractText(
  filePath: string,
  fileType: string
): Promise<string> {
  switch (fileType.toLowerCase()) {
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
