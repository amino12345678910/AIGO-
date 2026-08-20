import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../db/supabase";
import { ingestFile, getIngestionProgress } from "../services/ingestion";
import { log, error } from "../utils/logger";

const router = Router();

const UPLOADS_DIR = path.resolve(__dirname, "../../uploads");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const id = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, `${id}${ext}`);
  },
});
const upload = multer({ storage });

// =============================================
// DOCUMENTS (Global Knowledge Base)
// =============================================

router.get("/documents", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      "SELECT * FROM documents ORDER BY uploaded_at DESC"
    );
    void req;
    res.json(result.rows);
  } catch (err: any) {
    console.error("FULL ERROR:", err.message, err.stack);
    res.status(500).json({ error: "Failed to fetch documents", detail: err.message });
  }
});

router.get("/documents/:id/status", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const progress = getIngestionProgress(id);
    if (progress) {
      res.json(progress);
      return;
    }

    const result = await pool.query(
      "SELECT id, status, chunk_count, error_msg FROM documents WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    const doc = result.rows[0];
    res.json({
      stage: doc.status === "indexed" ? "COMPLETED" : doc.status === "failed" ? "FAILED" : "INDEXING",
      totalChunks: doc.chunk_count,
      indexedChunks: doc.status === "indexed" ? doc.chunk_count : 0,
      error: doc.error_msg,
    });
  } catch (err) {
    error("Failed to fetch document status", err);
    res.status(500).json({ error: "Failed to fetch document status" });
  }
});

router.delete("/documents/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const result = await pool.query(
      "SELECT file_url FROM documents WHERE id = $1",
      [id]
    );
    if (result.rows.length > 0) {
      const filePath = result.rows[0].file_url;
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    await pool.query("DELETE FROM documents WHERE id = $1", [id]);
    log("Document deleted", { id });
    res.json({ success: true });
  } catch (err) {
    error("Failed to delete document", err);
    res.status(500).json({ error: "Failed to delete document" });
  }
});

router.post(
  "/upload",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      const file = req.file;
      const fileType = path.extname(file.originalname).slice(1).toLowerCase();
      const docId = path.basename(file.filename, path.extname(file.filename));
      const localPath = file.path;

      await pool.query(
        `INSERT INTO documents (id, filename, file_url, file_type, status)
         VALUES ($1, $2, $3, $4, 'processing')`,
        [docId, file.originalname, localPath, fileType]
      );

      ingestFile(docId, localPath, file.originalname, fileType, localPath).catch(
        (err) => error("Document processing failed", err)
      );

      log("Document upload started", { docId, filename: file.originalname });
      res.status(202).json({ id: docId, status: "processing" });
    } catch (err) {
      error("Upload failed", err);
      res.status(500).json({ error: "Upload failed" });
    }
  }
);

export default router;
