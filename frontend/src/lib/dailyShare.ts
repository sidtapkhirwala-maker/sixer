function scoreToEmoji(score: number): string {
  if (score >= 9.0) return '🟪'
  if (score >= 7.0) return '🟩'
  if (score >= 5.0) return '🟨'
  return '🟥'
}

function fmtScore(score: number): string {
  const r = Math.round(score * 100) / 100
  return r.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')
}

export function generateDailyShareText({
  dailyNumber,
  record,
  sixerScore,
  tier,
  xi,
  rank,
  totalPlayers,
}: {
  dailyNumber: number
  record: string
  sixerScore: number
  tier: string
  xi: Array<{ player_score: number }>
  rank?: number
  totalPlayers?: number
}): string {
  const emojiRow = xi.map(p => scoreToEmoji(p.player_score)).join('')
  const lines = [
    `SIXER DAILY #${dailyNumber}`,
    `${record} · ${fmtScore(sixerScore)} · ${tier}`,
    emojiRow,
  ]
  if (rank !== undefined && totalPlayers !== undefined) {
    lines.push(`Ranked #${rank} of ${totalPlayers} today`)
  }
  lines.push('', 'https://sixer.app/daily')
  return lines.join('\n')
}
