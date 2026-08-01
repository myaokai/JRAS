export interface TextSegment {
  type: 'text' | 'blank'
  value: string
  blankId?: string
}

export function parseAnaumeText(text: string, questionId: number): TextSegment[] {
  const segments: TextSegment[] = []
  const regex = /\{\{(.+?)\}\}/g
  let blankIndex = 0
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text))) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    segments.push({
      type: 'blank',
      value: match[1],
      blankId: `${questionId}-${blankIndex++}`,
    })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) })
  }
  return segments
}

export function getBlankIds(text: string, questionId: number): string[] {
  return parseAnaumeText(text, questionId)
    .filter((s) => s.type === 'blank')
    .map((s) => s.blankId as string)
}
