import express, { Request, Response } from "express";
import path from "path";
import { fileURLToPath } from "url";
import { getData, getDataById } from "./data.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// 静的ファイル配信
app.use(express.static(path.join(__dirname, "../public")));

// API: 全データ取得
app.get("/api/data", async (_req: Request, res: Response) => {
  try {
    const data = await getData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "データ取得に失敗しました" });
  }
});

// API: ID指定で取得（機能追加の例）
app.get("/api/data/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const item = await getDataById(id);
    if (item) {
      res.json(item);
    } else {
      res.status(404).json({ error: "データが見つかりません" });
    }
  } catch (error) {
    res.status(500).json({ error: "データ取得に失敗しました" });
  }
});

// TODO: 新しいエンドポイントはここに追加

app.listen(PORT, () => {
  console.log(`サーバー起動: http://localhost:${PORT}`);
});
