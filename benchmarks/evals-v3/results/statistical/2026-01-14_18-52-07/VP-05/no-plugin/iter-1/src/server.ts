import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { getData } from "./data.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// 静的ファイル配信
app.use(express.static(path.join(__dirname, "../public")));

// JSON パース
app.use(express.json());

// API: データ取得
// 後で機能追加する場合はここにエンドポイントを追加
app.get("/api/data", async (_req, res) => {
  try {
    const data = await getData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "データ取得に失敗しました" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

export { app };
