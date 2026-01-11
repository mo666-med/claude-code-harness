---
description: harness-ui (TypeScript/React) 開発ルール
paths: "harness-ui/**/*.{ts,tsx,js,jsx}"
---

# harness-ui Development Rules

`harness-ui/` ディレクトリの TypeScript/React コード編集時に適用されるルール。

## アーキテクチャ

```
harness-ui/
├── src/
│   ├── client/          # React フロントエンド
│   │   ├── components/  # UI コンポーネント
│   │   └── main.tsx     # エントリポイント
│   ├── server/          # Hono バックエンド
│   │   ├── routes/      # API エンドポイント
│   │   └── services/    # ビジネスロジック
│   ├── mcp/             # MCP サーバー
│   └── shared/          # 共有型定義
├── tests/
│   ├── unit/            # ユニットテスト
│   └── integration/     # 統合テスト
└── e2e/                 # Playwright E2E テスト
```

## TypeScript 規約

### 型定義

```typescript
// ✅ 明示的な型定義
interface HookMetadata {
  name: string
  description: string
  timing: string
}

// ❌ any の使用禁止
function process(data: any) { ... }  // NG
function process(data: unknown) { ... }  // OK
```

### エラーハンドリング

```typescript
// ✅ 適切なエラーハンドリング
try {
  const result = await fetchData()
  return result
} catch (error) {
  console.error('Failed to fetch:', error)
  return null  // または throw new CustomError()
}

// ❌ 空の catch
catch {}  // NG
catch { return false }  // 理由なしは NG
```

## React 規約

### コンポーネント

```typescript
// ✅ 関数コンポーネント + 明示的な Props 型
interface DashboardProps {
  projectPath: string
  onRefresh?: () => void
}

export function Dashboard({ projectPath, onRefresh }: DashboardProps) {
  // ...
}
```

### フック

- カスタムフックは `use` プレフィックス
- `useMemo`, `useCallback` で不要な再計算を防止
- `useEffect` の依存配列を正確に指定

## API エンドポイント (Hono)

```typescript
// routes/ のパターン
import { Hono } from 'hono'

const app = new Hono()

app.get('/api/resource', async (c) => {
  try {
    const data = await service.getData()
    return c.json(data)
  } catch (error) {
    return c.json({ error: 'Failed to fetch' }, 500)
  }
})
```

## テスト

### ユニットテスト

```typescript
// tests/unit/*.test.ts
import { describe, it, expect } from 'vitest'

describe('ServiceName', () => {
  it('should handle normal case', () => {
    // Arrange
    // Act
    // Assert
  })
})
```

### ビルド確認

変更後は必ず:
```bash
cd harness-ui && npm run build
```

## 禁止事項

- ❌ `console.log` のコミット（`console.debug` または削除）
- ❌ ハードコードされた URL/パス
- ❌ `// @ts-ignore` の使用（型を修正する）
