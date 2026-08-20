import { Pool } from "pg";
import { config } from "../config/env";

export const pool = new Pool({
  connectionString: config.databaseUrl,
});

pool.on("error", (err) => {
  console.error("Unexpected pool error:", err);
});
