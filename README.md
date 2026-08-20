<p align="center">
  <h1 align="center">AIGO</h1>
  <p align="center">
    <em>AI-Powered Tutoring for Tunisian Students</em>
  </p>
  <p align="center">
    <img src="https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js" alt="Next.js">
    <img src="https://img.shields.io/badge/Express.js-4-white?style=flat-square&logo=express" alt="Express">
    <img src="https://img.shields.io/badge/PostgreSQL-Neon-336791?style=flat-square&logo=postgresql" alt="PostgreSQL">
    <img src="https://img.shields.io/badge/pgvector-0.8.6-FF6B6B?style=flat-square" alt="pgvector">
    <img src="https://img.shields.io/badge/Ollama-bge--m3-000?style=flat-square" alt="Ollama">
    <img src="https://img.shields.io/badge/Gemini-3.1--Flash--Lite-4285F4?style=flat-square&logo=google" alt="Gemini">
  </p>
</p>

---

## What is AIGO?

AIGO is a full-stack **Retrieval-Augmented Generation (RAG)** platform that lets students upload course materials and chat with an AI tutor grounded in their actual content. Ask questions in French, English, Arabic, or Darija — get answers sourced directly from your documents.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js 14)                     │
│   Chat UI · Dark/Light Mode · Markdown · KaTeX · File Upload     │
└────────────────────────────┬─────────────────────────────────────┘
                             │ REST API
┌────────────────────────────┴─────────────────────────────────────┐
│                        Backend (Express.js)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │ Embedder │  │ Retriever │  │ Chunker  │  │   Orchestrator   │ │
│  │ (Ollama) │  │ (Hybrid)  │  │ (4K char)│  │   (RAG Pipeline) │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │
└─────────┬──────────────────────────┬────────────────────────────┘
          │                          │
┌─────────┴──────────┐  ┌───────────┴───────────┐
│   Neon PostgreSQL   │  │  Ollama (bge-m3)      │
│   + pgvector        │  │  Local Embeddings     │
└────────────────────┘  └───────────────────────┘
```

---

## Features

- **RAG-Powered Chat** — AI answers grounded in your uploaded documents, not hallucinated
- **Hybrid Search** — Semantic (pgvector) + keyword search with relevance filtering
- **Multilingual** — French, English, Arabic, Darija — matches your language
- **Rich Rendering** — Markdown, syntax-highlighted code blocks, KaTeX math formulas, tables
- **Dark / Light Mode** — Toggle in the header
- **File Upload** — PDF, DOCX, TXT, CSV with async ingestion and progress tracking
- **Query Expansion** — Rule-based expansion for Tunisian academic terminology
- **Document Deduplication** — SHA-256 content hashing prevents re-indexing
- **Conversational Memory** — Maintains chat history per session

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 14, React, Tailwind CSS, shadcn/ui | Chat interface, file upload, dark/light theme |
| **Backend** | Express.js, TypeScript, Node.js | API server, RAG pipeline, file ingestion |
| **Database** | Neon PostgreSQL + pgvector | Vector storage, hybrid search, chat persistence |
| **Embeddings** | Ollama + bge-m3 (1024-dim) | Local semantic embeddings |
| **LLM** | Gemini 3.1 Flash Lite | Response generation |
| **Markdown** | react-markdown, remark-gfm, rehype-katex | Rich content rendering |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Ollama](https://ollama.com/) running locally with `bge-m3` model
- A [Neon](https://neon.tech) PostgreSQL database
- A [Google AI](https://aistudio.google.com/) API key (Gemini)

### 1. Pull the embedding model

```bash
ollama pull bge-m3
```

### 2. Backend Setup

```bash
cd backend
cp .env.example .env    # Fill in your credentials
npm install
npm run build
node dist/index.js
```

Server runs at **http://localhost:5000**

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

App runs at **http://localhost:3000**

### 4. Database

The backend connects to Neon via `DATABASE_URL`. Tables and the `vector` extension are created automatically via `migrate.js` on first run, or manually:

```bash
cd backend
node migrate.js
```

---

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Backend port | `5000` |
| `DATABASE_URL` | Neon PostgreSQL connection string | `postgresql://user:pass@host/neondb?sslmode=require` |
| `GEMINI_API_KEY` | Google AI API key | `AIza...` |
| `GEMINI_MODEL` | Gemini model name | `gemini-3.1-flash-lite` |
| `OLLAMA_BASE_URL` | Ollama server URL | `http://localhost:11434` |
| `OLLAMA_EMBEDDING_MODEL` | Embedding model | `bge-m3` |
| `EMBEDDING_DIMENSIONS` | Vector dimensions | `1024` |

---

## How It Works

1. **Upload** — Student uploads course PDFs/DOCXs through the chat interface
2. **Ingest** — Documents are extracted (with Gemini OCR fallback), chunked (4000 chars, sentence-aware), embedded via Ollama bge-m3, and stored in pgvector
3. **Query** — Student asks a question in any language
4. **Retrieve** — Query is expanded, embedded, and matched via hybrid search (semantic + keyword). Results below 0.25 similarity are filtered out; intro chunks serve as fallback
5. **Generate** — Retrieved chunks + conversation history are sent to Gemini with a structured system prompt
6. **Render** — Response streams back with Markdown, tables, code blocks, and math formulas

---

## Project Structure

```
AIGO-/
├── backend/
│   ├── src/
│   │   ├── config/        # Environment configuration
│   │   ├── db/            # Neon PostgreSQL connection
│   │   ├── routes/        # Admin (upload) + Session (chat) endpoints
│   │   ├── services/      # RAG pipeline (embedder, chunker, retriever, orchestrator, LLM)
│   │   ├── types/         # TypeScript type definitions
│   │   └── utils/         # Logger
│   └── uploads/           # Local document storage
├── frontend/
│   ├── app/
│   │   ├── chat/          # Main chat interface
│   │   ├── layout.tsx     # Root layout with theme provider
│   │   └── providers.tsx  # Theme context
│   ├── components/ui/     # shadcn/ui components
│   └── lib/               # Utilities
└── README.md
```

---

## License

MIT
