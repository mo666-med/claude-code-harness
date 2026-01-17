// データ層 - 将来的にDB接続等に差し替え可能
export interface DataItem {
  id: number;
  name: string;
  value: string;
}

// サンプルデータ（後でDBやAPIに置き換え可能）
const sampleData: DataItem[] = [
  { id: 1, name: "項目A", value: "100" },
  { id: 2, name: "項目B", value: "200" },
  { id: 3, name: "項目C", value: "300" },
];

// データ取得関数（非同期対応で拡張しやすく）
export async function getData(): Promise<DataItem[]> {
  // TODO: ここをDB接続やAPI呼び出しに変更可能
  return sampleData;
}

// 個別データ取得（機能追加の例）
export async function getDataById(id: number): Promise<DataItem | undefined> {
  return sampleData.find((item) => item.id === id);
}
