// データ取得モジュール
// 後でDB接続やAPI呼び出しに差し替え可能

export interface DataItem {
  id: number;
  name: string;
  value: string;
}

// サンプルデータ（後でデータソースを差し替える場合はここを変更）
const sampleData: DataItem[] = [
  { id: 1, name: "項目A", value: "100" },
  { id: 2, name: "項目B", value: "200" },
  { id: 3, name: "項目C", value: "300" },
];

export async function getData(): Promise<DataItem[]> {
  // 将来的にはここでDBやAPIからデータを取得
  return sampleData;
}

// 機能追加例: IDでデータ取得
export async function getDataById(id: number): Promise<DataItem | undefined> {
  return sampleData.find((item) => item.id === id);
}
