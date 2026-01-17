// データ層 - 後から拡張しやすい設計

export interface DataItem {
  id: number;
  name: string;
  value: string;
}

// サンプルデータ（後でDBやAPI呼び出しに置き換え可能）
const sampleData: DataItem[] = [
  { id: 1, name: "項目A", value: "100" },
  { id: 2, name: "項目B", value: "200" },
  { id: 3, name: "項目C", value: "300" },
];

// データ取得（非同期対応で拡張しやすい）
export async function getData(): Promise<DataItem[]> {
  // TODO: ここをDB呼び出しやAPI取得に変更可能
  return sampleData;
}

// IDで取得（機能追加の例）
export async function getDataById(id: number): Promise<DataItem | undefined> {
  return sampleData.find((item) => item.id === id);
}
