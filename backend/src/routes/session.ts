import { Router, Request, Response } from "express";
import { pool } from "../db/supabase";
import { handleUserMessage } from "../services/orchestrator";
import { log, error } from "../utils/logger";

const router = Router();

router.post("/start", async (req: Request, res: Response) => {
  try {
    const { title } = req.body;
    const result = await pool.query(
      `INSERT INTO chat_sessions (title) VALUES ($1) RETURNING *`,
      [title || "New Chat"]
    );

    log("Session started", { sessionId: result.rows[0].id });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    error("Failed to start session", err);
    res.status(500).json({ error: "Failed to start session" });
  }
});

router.get("/sessions", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT * FROM chat_sessions ORDER BY updated_at DESC`
    );
    void req;
    res.json(result.rows);
  } catch (err) {
    error("Failed to fetch sessions", err);
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);

    const sessionResult = await pool.query(
      `SELECT * FROM chat_sessions WHERE id = $1`,
      [id]
    );

    if (sessionResult.rows.length === 0) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const messagesResult = await pool.query(
      `SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC`,
      [id]
    );

    res.json({
      session: sessionResult.rows[0],
      messages: messagesResult.rows,
    });
  } catch (err) {
    error("Failed to fetch session", err);
    res.status(500).json({ error: "Failed to fetch session" });
  }
});

router.post("/:id/message", async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    const content = String(req.body?.content || "");
    const ragEnabled = req.body?.ragEnabled !== false;

    if (!content.trim()) {
      res.status(400).json({ error: "Message content is required" });
      return;
    }

    const sessionCheck = await pool.query(
      "SELECT id FROM chat_sessions WHERE id = $1",
      [id]
    );
    if (sessionCheck.rows.length === 0) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    res.write(
      `data: ${JSON.stringify({ type: "user_message", content })}\n\n`
    );

    const result = await handleUserMessage(id, content.trim(), ragEnabled);

    res.write(
      `data: ${JSON.stringify({
        type: "ai_response",
        text: result.text,
        chunksUsed: result.chunksUsed,
      })}\n\n`
    );

    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
    res.end();
  } catch (err) {
    error("Failed to process message", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to process message" });
    } else {
      res.write(
        `data: ${JSON.stringify({ type: "error", error: "Failed to process message" })}\n\n`
      );
      res.end();
    }
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    await pool.query("DELETE FROM chat_sessions WHERE id = $1", [id]);
    log("Session deleted", { id });
    res.json({ success: true });
  } catch (err) {
    error("Failed to delete session", err);
    res.status(500).json({ error: "Failed to delete session" });
  }
});

router.post("/:id/title", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { title } = req.body;
    await pool.query(
      `UPDATE chat_sessions SET title = $1, updated_at = now() WHERE id = $2`,
      [title, id]
    );
    res.json({ success: true });
  } catch (err) {
    error("Failed to update title", err);
    res.status(500).json({ error: "Failed to update title" });
  }
});

export default router;
