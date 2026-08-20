export interface Document {
  id: string;
  filename: string;
  file_url: string;
  file_type: string;
  content_hash?: string;
  status: "pending" | "processing" | "indexed" | "failed";
  chunk_count: number;
  error_msg?: string;
  uploaded_at: string;
}

export interface KnowledgeChunk {
  id: number;
  document_id: string;
  file_name: string;
  original_file_name?: string;
  file_type?: string;
  chunk_index: number;
  chunk_text: string;
  embedding?: number[];
  content_hash?: string;
  created_at: string;
}

export interface ChatSession {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: number;
  session_id: number;
  role: "user" | "assistant";
  content: string;
  has_attachment?: boolean;
  attachment_url?: string;
  chunks_used?: number[];
  created_at: string;
}

export interface RawChunk {
  content: string;
  document_id: string;
  file_name: string;
  file_type: string;
  chunk_index: number;
}

export interface RetrievalResult {
  id: number;
  content: string;
  similarity: number;
  file_name: string;
  chunk_index: number;
}

export interface IngestionProgress {
  stage: "QUEUED" | "EXTRACTING" | "INDEXING" | "COMPLETED" | "FAILED";
  totalChunks?: number;
  indexedChunks?: number;
  error?: string;
}
