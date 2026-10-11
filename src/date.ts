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
