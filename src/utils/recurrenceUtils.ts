import { RRule } from 'rrule'

export type RRuleFreq = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'

// UI が現在 byweekday/bymonthday 入力に対応していないため、
// RecurrenceOptions は freq/interval のみを公開する。
// 将来対応する際はこのインタフェースを拡張し、buildRRule / parseRRule を同時に更新すること。
export interface RecurrenceOptions {
  freq: RRuleFreq
  interval: number
}

export const FREQ_MAP: Record<RRuleFreq, number> = {
  DAILY: RRule.DAILY,
  WEEKLY: RRule.WEEKLY,
  MONTHLY: RRule.MONTHLY,
  YEARLY: RRule.YEARLY,
}

// #8: 不正な interval を早期に弾く
export function buildRRule(options: RecurrenceOptions): string {
  if (!Number.isInteger(options.interval) || options.interval < 1) {
    throw new RangeError(`interval must be a positive integer, got: ${options.interval}`)
  }
  return new RRule({ freq: FREQ_MAP[options.freq], interval: options.interval }).toString()
}

export function parseRRule(rruleStr: string | null): RecurrenceOptions | null {
  if (!rruleStr) return null
  try {
    const rule = RRule.fromString(rruleStr)
    const options = rule.options

    const freqReverse: Record<number, RRuleFreq> = {
      [RRule.DAILY]: 'DAILY',
      [RRule.WEEKLY]: 'WEEKLY',
      [RRule.MONTHLY]: 'MONTHLY',
      [RRule.YEARLY]: 'YEARLY',
    }

    const freq = freqReverse[options.freq]
    if (!freq) return null

    return { freq, interval: options.interval ?? 1 }
  } catch {
    return null
  }
}

export function getNextOccurrence(rruleStr: string | null, after: Date): Date | null {
  if (!rruleStr) return null
  // parseRRule 経由で freq/interval だけを取り出し、再構築する。
  // RRule.fromString のまま spread すると現在時刻の曜日・時刻が byweekday/byhour 等に
  // 混入し、意図しない発生日になる（rrule v2 の既知の挙動）。
  const parsed = parseRRule(rruleStr)
  if (!parsed) return null
  try {
    const ruleWithStart = new RRule({
      freq: FREQ_MAP[parsed.freq],
      interval: parsed.interval,
      dtstart: after,
    })
    // after の翌日 00:00 UTC を起点に、そこを含む最初の発生を取得（inc=true は ">="）
    const startOfNextDay = new Date(
      Date.UTC(after.getUTCFullYear(), after.getUTCMonth(), after.getUTCDate() + 1)
    )
    return ruleWithStart.after(startOfNextDay, true)
  } catch {
    return null
  }
}

// rrule はすべての Date を UTC として扱う。
// ローカル日付を "UTC の同じ年月日" に変換してから渡し、戻り値を逆変換することで日付ずれを防ぐ。
function toUTCDate(localDate: Date): Date {
  return new Date(Date.UTC(localDate.getFullYear(), localDate.getMonth(), localDate.getDate()))
}
function fromUTCDate(utcDate: Date): Date {
  return new Date(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate())
}

/**
 * repeatRule を持つタスクの、rangeStart〜rangeEnd（両端含む）内の全発生日を返す。
 * dtstart はタスクの dueDate（基準日）を使う。
 */
export function expandOccurrences(
  rruleStr: string,
  dtstart: Date,
  rangeStart: Date,
  rangeEnd: Date
): Date[] {
  const parsed = parseRRule(rruleStr)
  if (!parsed) return []
  try {
    const rule = new RRule({
      freq: FREQ_MAP[parsed.freq],
      interval: parsed.interval,
      dtstart: toUTCDate(dtstart),
    })
    return rule.between(toUTCDate(rangeStart), toUTCDate(rangeEnd), true).map(fromUTCDate)
  } catch {
    return []
  }
}

/**
 * 仮想インスタンス ID（"taskId_timestamp" 形式）から実タスク ID を取得する。
 * 通常の ID はそのまま返す。
 */
export function resolveTaskId(id: string): string {
  const sep = id.lastIndexOf('_')
  if (sep === -1) return id
  const suffix = id.slice(sep + 1)
  return /^\d+$/.test(suffix) ? id.slice(0, sep) : id
}

export function hasRepeatRule(rruleStr: string | null | undefined): rruleStr is string {
  return typeof rruleStr === 'string' && rruleStr.length > 0
}

// #11: Record マップで網羅性チェックを TypeScript に委ねる
export function describeRRule(rruleStr: string | null): string {
  if (!rruleStr) return ''
  const parsed = parseRRule(rruleStr)
  if (!parsed) return ''

  const { freq, interval } = parsed
  const labels: Record<RRuleFreq, [string, string]> = {
    DAILY: ['毎日', `${interval}日ごと`],
    WEEKLY: ['毎週', `${interval}週間ごと`],
    MONTHLY: ['毎月', `${interval}ヶ月ごと`],
    YEARLY: ['毎年', `${interval}年ごと`],
  }
  const [singular, plural] = labels[freq]
  return interval === 1 ? singular : plural
}
