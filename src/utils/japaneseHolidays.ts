import { addDays } from 'date-fns'

const holidayCache = new Map<number, ReadonlyMap<string, string>>()

function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function nthMonday(year: number, month: number, occurrence: number): number {
  const firstDay = new Date(year, month, 1).getDay()
  const firstMonday = 1 + ((8 - firstDay) % 7)
  return firstMonday + (occurrence - 1) * 7
}

function vernalEquinoxDay(year: number): number | null {
  if (year < 1949 || year > 2150) return null
  if (year <= 1979) {
    return Math.floor(20.8357 + 0.242194 * (year - 1980) - Math.floor((year - 1983) / 4))
  }
  if (year <= 2099) {
    return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4))
  }
  return Math.floor(21.851 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4))
}

function autumnalEquinoxDay(year: number): number | null {
  if (year < 1948 || year > 2150) return null
  if (year <= 1979) {
    return Math.floor(23.2588 + 0.242194 * (year - 1980) - Math.floor((year - 1983) / 4))
  }
  if (year <= 2099) {
    return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4))
  }
  return Math.floor(24.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4))
}

function buildJapaneseHolidays(year: number): ReadonlyMap<string, string> {
  const nationalHolidays = new Map<string, string>()
  const add = (month: number, day: number, name: string) => {
    nationalHolidays.set(toDateKey(new Date(year, month - 1, day)), name)
  }

  if (year >= 1949) {
    add(1, 1, '元日')
    add(1, year >= 2000 ? nthMonday(year, 0, 2) : 15, '成人の日')
  }
  if (year >= 1967) add(2, 11, '建国記念の日')
  if (year >= 2020) add(2, 23, '天皇誕生日')
  if (year >= 1989 && year <= 2018) add(12, 23, '天皇誕生日')

  const vernalEquinox = vernalEquinoxDay(year)
  if (vernalEquinox) add(3, vernalEquinox, '春分の日')

  if (year >= 2007) add(4, 29, '昭和の日')
  else if (year >= 1989) add(4, 29, 'みどりの日')
  else if (year >= 1949) add(4, 29, '天皇誕生日')

  if (year >= 1949) {
    add(5, 3, '憲法記念日')
    if (year >= 2007) add(5, 4, 'みどりの日')
    add(5, 5, 'こどもの日')
  }

  if (year === 2020) add(7, 23, '海の日')
  else if (year === 2021) add(7, 22, '海の日')
  else if (year >= 2003) add(7, nthMonday(year, 6, 3), '海の日')
  else if (year >= 1996) add(7, 20, '海の日')

  if (year === 2020) add(8, 10, '山の日')
  else if (year === 2021) add(8, 8, '山の日')
  else if (year >= 2016) add(8, 11, '山の日')

  if (year >= 2003) add(9, nthMonday(year, 8, 3), '敬老の日')
  else if (year >= 1966) add(9, 15, '敬老の日')

  const autumnalEquinox = autumnalEquinoxDay(year)
  if (autumnalEquinox) add(9, autumnalEquinox, '秋分の日')

  if (year === 2020) add(7, 24, 'スポーツの日')
  else if (year === 2021) add(7, 23, 'スポーツの日')
  else if (year >= 2022) add(10, nthMonday(year, 9, 2), 'スポーツの日')
  else if (year >= 2000) add(10, nthMonday(year, 9, 2), '体育の日')
  else if (year >= 1966) add(10, 10, '体育の日')

  if (year >= 1948) {
    add(11, 3, '文化の日')
    add(11, 23, '勤労感謝の日')
  }

  const oneOffHolidays: Record<number, Array<[number, number, string]>> = {
    1959: [[4, 10, '皇太子明仁親王の結婚の儀']],
    1989: [[2, 24, '昭和天皇の大喪の礼']],
    1990: [[11, 12, '即位礼正殿の儀']],
    1993: [[6, 9, '皇太子徳仁親王の結婚の儀']],
    2019: [
      [5, 1, '天皇の即位の日'],
      [10, 22, '即位礼正殿の儀'],
    ],
  }
  oneOffHolidays[year]?.forEach(([month, day, name]) => add(month, day, name))

  // 祝日に挟まれた平日も「国民の休日」になる（1986年以降）。
  if (year >= 1986) {
    for (let date = new Date(year, 0, 2); date.getFullYear() === year; date = addDays(date, 1)) {
      const key = toDateKey(date)
      if (nationalHolidays.has(key)) continue
      const previousKey = toDateKey(addDays(date, -1))
      const nextKey = toDateKey(addDays(date, 1))
      if (nationalHolidays.has(previousKey) && nationalHolidays.has(nextKey)) {
        nationalHolidays.set(key, '国民の休日')
      }
    }
  }

  // 日曜日と重なった祝日は、次の祝日でない日を振替休日にする。
  const holidays = new Map(nationalHolidays)
  for (const key of nationalHolidays.keys()) {
    const holiday = new Date(`${key}T00:00:00`)
    if (holiday < new Date(1973, 3, 12) || holiday.getDay() !== 0) continue

    let substitute = addDays(holiday, 1)
    if (year >= 2007) {
      while (holidays.has(toDateKey(substitute))) substitute = addDays(substitute, 1)
    }
    const substituteKey = toDateKey(substitute)
    if (!holidays.has(substituteKey)) holidays.set(substituteKey, '振替休日')
  }

  return holidays
}

export function getJapaneseHolidayName(date: Date): string | null {
  const year = date.getFullYear()
  let holidays = holidayCache.get(year)
  if (!holidays) {
    holidays = buildJapaneseHolidays(year)
    holidayCache.set(year, holidays)
  }
  return holidays.get(toDateKey(date)) ?? null
}
