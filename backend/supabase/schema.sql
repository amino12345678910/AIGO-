-- =============================================
-- AIGO RAG Database Schema
-- Run this in Supabase SQL Editor
-- =============================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- =============================================
-- SUBJECTS — the namespace unit for RAG
-- =============================================
CREATE TABLE IF NOT EXISTS subjects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  grade       TEXT,
  branch      TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- DOCUMENTS — files uploaded by admin
-- =============================================
CREATE TABLE IF NOT EXISTS documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id   UUID REFERENCES subjects(id) ON DELETE CASCADE,
  filename     TEXT NOT NULL,
  file_url     TEXT NOT NULL,
  file_type    TEXT,
  status       TEXT DEFAULT 'pending',
  chunk_count  INT DEFAULT 0,
  error_msg    TEXT,
  uploaded_at  TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- CHUNKS — embedded text chunks (RAG core)
-- =============================================
CREATE TABLE IF NOT EXISTS chunks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID REFERENCES documents(id) ON DELETE CASCADE,
  subject_id   UUID REFERENCES subjects(id) ON DELETE CASCADE,
  content      TEXT NOT NULL,
  metadata     JSONB DEFAULT '{}',
  embedding    VECTOR(768),
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- HNSW index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS idx_chunks_embedding
  ON chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Index for subject-scoped queries
CREATE INDEX IF NOT EXISTS idx_chunks_subject ON chunks(subject_id);

-- =============================================
-- SESSIONS — student study sessions
-- =============================================
CREATE TABLE IF NOT EXISTS sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID NOT NULL,
  subject_id  UUID REFERENCES subjects(id),
  started_at  TIMESTAMPTZ DEFAULT now(),
  ended_at    TIMESTAMPTZ,
  summary     TEXT
);

-- =============================================
-- MESSAGES — chat messages within a session
-- =============================================
CREATE TABLE IF NOT EXISTS messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID REFERENCES sessions(id) ON DELETE CASCADE,
  role         TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content      TEXT NOT NULL,
  chunks_used  UUID[] DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_session
  ON messages(session_id, created_at);

-- =============================================
-- STORAGE BUCKET
-- Run this via Supabase Dashboard → Storage → New Bucket
-- Bucket name: documents, Private
-- =============================================
