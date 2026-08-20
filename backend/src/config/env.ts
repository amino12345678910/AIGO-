import dotenv from "dotenv";
dotenv.config();

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

export const config = {
  port: parseInt(process.env.PORT || "5000", 10),
  nodeEnv: process.env.NODE_ENV || "development",

  supabaseUrl: required("SUPABASE_URL"),
  supabaseAnonKey: required("SUPABASE_ANON_KEY"),
  supabaseServiceKey: required("SUPABASE_SERVICE_KEY"),

  geminiApiKey: required("GEMINI_API_KEY"),
  geminiModel: process.env.GEMINI_MODEL || "gemini-3.1-flash-lite",

  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
  ollamaEmbeddingModel: process.env.OLLAMA_EMBEDDING_MODEL || "bge-m3",
  embeddingDimensions: parseInt(process.env.EMBEDDING_DIMENSIONS || "1024", 10),

  databaseUrl: required("DATABASE_URL"),
};
