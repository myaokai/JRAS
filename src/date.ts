// 日付は端末のタイムゾーン（日本時間）で扱う。toISOString は UTC になり、
// 0〜9時が前日扱いになるため使わない。
function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function dateStrOf(ms: number): string {
  return formatDate(new Date(ms))
}

export function todayStr(): string {
  return formatDate(new Date())
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return formatDate(new Date(y, m - 1, d + days))
}

// from から to までの日数（同じ日なら0、過ぎていれば負）
export function daysBetween(from: string, to: string): number {
  const toTime = (s: string) => {
    const [y, m, d] = s.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((toTime(to) - toTime(from)) / 86400000)
}
