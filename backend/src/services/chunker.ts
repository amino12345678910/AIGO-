import { RawChunk } from "../types";

const CHUNK_SIZE = 4000;
const CHUNK_OVERLAP = 100;
const MIN_CHUNK_CHARS = 250;
const INTRO_CHUNKS = 6;
const MAX_CHUNKS_PER_DOC = 45;

export function chunkText(
  text: string,
  documentId: string,
  fileName: string,
  fileType: string
): RawChunk[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= CHUNK_SIZE) {
      chunks.push(remaining);
      break;
    }

    let splitPoint = -1;
    const searchStart = Math.floor(CHUNK_SIZE / 2);

    const breakPatterns: RegExp[] = [/\. \n/g, /!\n/g, /\. \n/g, /\. /g, /! /g, /\? /g, /\n\n/g, /\n/g, / /g];

    for (const pattern of breakPatterns) {
      const searchRegion = remaining.slice(searchStart, CHUNK_SIZE);
      const matches = [...searchRegion.matchAll(pattern)];
      if (matches.length > 0) {
        const lastMatch = matches[matches.length - 1];
        splitPoint = searchStart + lastMatch.index! + lastMatch[0].length;
        break;
      }
    }

    if (splitPoint === -1) {
      splitPoint = CHUNK_SIZE;
    }

    chunks.push(remaining.slice(0, splitPoint).trim());
    remaining = remaining.slice(splitPoint).trim();
  }

  const validChunks: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    if (i < INTRO_CHUNKS || chunks[i].length >= MIN_CHUNK_CHARS) {
      validChunks.push(chunks[i]);
    }
  }

  const dedupedChunks: string[] = [];
  const seen = new Set<string>();
  for (const chunk of validChunks) {
    const fingerprint = chunk.slice(0, 500).toLowerCase().replace(/\s+/g, " ").trim();
    if (!seen.has(fingerprint)) {
      seen.add(fingerprint);
      dedupedChunks.push(chunk);
    }
  }

  const finalChunks = dedupedChunks.slice(0, MAX_CHUNKS_PER_DOC);

  return finalChunks.map((content, index) => ({
    content,
    document_id: documentId,
    file_name: fileName,
    file_type: fileType,
    chunk_index: index,
  }));
}

export function chunkTextWithOverlap(
  text: string,
  documentId: string,
  fileName: string,
  fileType: string
): RawChunk[] {
  const rawChunks = chunkText(text, documentId, fileName, fileType);

  if (rawChunks.length <= 1) return rawChunks;

  const overlappedChunks: RawChunk[] = [rawChunks[0]];

  for (let i = 1; i < rawChunks.length; i++) {
    const prevText = rawChunks[i - 1].content;
    const words = prevText.split(/\s+/);
    const overlapWords = words.slice(-CHUNK_OVERLAP);
    const overlapText = overlapWords.join(" ");

    overlappedChunks.push({
      ...rawChunks[i],
      content: overlapText + "\n" + rawChunks[i].content,
    });
  }

  return overlappedChunks;
}
