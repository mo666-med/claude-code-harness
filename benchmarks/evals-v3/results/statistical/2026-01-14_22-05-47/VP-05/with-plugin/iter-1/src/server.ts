import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { getData } from "./data.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3000;

// 静的ファイル配信
app.use(express.static(path.join(__dirname, "../public")));

// APIエンドポイント
app.get("/api/data", async (_req, res) => {
  try {
    const data = await getData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "データ取得に失敗しました" });
  }
});

// 新しいAPIは↓に追加
// app.get("/api/xxx", async (req, res) => { ... });

app.listen(PORT, () => {
  console.log(`サーバー起動: http://localhost:${PORT}`);
});
