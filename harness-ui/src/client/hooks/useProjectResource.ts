import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * プロジェクトリソースを取得するカスタムフック
 *
 * 特徴:
 * - Race Condition 対策（プロジェクト切り替え時のリクエストキャンセル）
 * - 統一されたローディング/エラー状態管理
 * - コンポーネント間のコード重複を解消
 */
export function useProjectResource<T>(
  fetchFn: (projectPath?: string) => Promise<T>,
  projectPath?: string,
  options?: {
    /** 初期値（データ取得前に使用） */
    initialValue?: T
    /** 依存配列の追加項目 */
    deps?: unknown[]
  }
) {
  const [data, setData] = useState<T | null>(options?.initialValue ?? null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Race Condition 対策: 最新のリクエストのみを反映
  const requestIdRef = useRef(0)

  const refetch = useCallback(async () => {
    const currentRequestId = ++requestIdRef.current
    setLoading(true)
    setError(null)

    try {
      const result = await fetchFn(projectPath)

      // 古いリクエストの結果は無視
      if (currentRequestId !== requestIdRef.current) {
        return
      }

      setData(result)
    } catch (err) {
      // 古いリクエストのエラーは無視
      if (currentRequestId !== requestIdRef.current) {
        return
      }

      console.error('Failed to fetch resource:', err)
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      // 古いリクエストの場合はローディング状態を変更しない
      if (currentRequestId === requestIdRef.current) {
        setLoading(false)
      }
    }
  }, [fetchFn, projectPath])

  // プロジェクトが変わったらデータをクリア
  useEffect(() => {
    setData(options?.initialValue ?? null)
    setError(null)
  }, [projectPath])

  // データ取得
  useEffect(() => {
    refetch()
  }, [refetch, ...(options?.deps ?? [])])

  return {
    data,
    loading,
    error,
    refetch,
    /** データが存在するか */
    hasData: data !== null,
    /** エラーが発生したか */
    hasError: error !== null
  }
}

/**
 * 複数のプロジェクトリソースを並列で取得
 */
export function useProjectResources<T extends Record<string, unknown>>(
  fetchFns: { [K in keyof T]: (projectPath?: string) => Promise<T[K]> },
  projectPath?: string
) {
  const [data, setData] = useState<Partial<T>>({})
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState<Record<string, Error>>({})

  const requestIdRef = useRef(0)

  useEffect(() => {
    const currentRequestId = ++requestIdRef.current
    setLoading(true)
    setErrors({})

    const keys = Object.keys(fetchFns) as (keyof T)[]

    Promise.allSettled(
      keys.map(key => fetchFns[key](projectPath))
    ).then(results => {
      // 古いリクエストの結果は無視
      if (currentRequestId !== requestIdRef.current) {
        return
      }

      const newData: Partial<T> = {}
      const newErrors: Record<string, Error> = {}

      results.forEach((result, index) => {
        const key = keys[index]
        if (key === undefined) return
        const keyStr = String(key)
        if (result.status === 'fulfilled') {
          (newData as Record<string, unknown>)[keyStr] = result.value
        } else {
          newErrors[keyStr] = result.reason instanceof Error
            ? result.reason
            : new Error(String(result.reason))
        }
      })

      setData(newData)
      setErrors(newErrors)
      setLoading(false)
    })
  }, [projectPath])

  // プロジェクトが変わったらデータをクリア
  useEffect(() => {
    setData({})
    setErrors({})
  }, [projectPath])

  return {
    data,
    loading,
    errors,
    hasErrors: Object.keys(errors).length > 0
  }
}
