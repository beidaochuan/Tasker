/** 文字ラベルから、テストフィクスチャ用の安定した正の数値IDを作る。 */
export function testTaskId(value: string | number): number {
  if (typeof value === 'number') return value
  let hash = 0
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) % 2_147_483_647
  return hash + 1
}
