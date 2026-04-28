import "dotenv/config";
import express from "express";
import cors from "cors";
import healthRouter from "./routes/health.js";
import fragrancesRouter from "./routes/fragrances.js";
import { runSeed } from "./seed/seedFragrances.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.use("/health", healthRouter);
app.use("/fragrances", fragrancesRouter);

app.use((err, _req, res, _next) => {
  console.error("[backend] unhandled error", err);
  res
    .status(err.statusCode || 500)
    .json({ error: err.message || "Internal server error" });
});

const port = Number(process.env.PORT) || 8080;

app.listen(port, () => {
  console.log(`[backend] listening on :${port}`);
  runSeed().catch((err) => {
    console.warn("[backend] seed skipped:", err?.message || err);
  });
});
