import express from "express";
import cors from "cors";
import { config } from "./config/env";
import adminRoutes from "./routes/admin";
import sessionRoutes from "./routes/session";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "OK", message: "AIGO Backend is running" });
});

app.use("/api/admin", adminRoutes);
app.use("/api/session", sessionRoutes);

app.listen(config.port, () => {
  console.log(`AIGO Backend running on port ${config.port}`);
});
