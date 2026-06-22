export const DEFUNCT_FRANCHISE_WINDOWS: Record<string, { start: number; end: number }> = {
  DCH: { start: 2008, end: 2012 },  // Deccan Chargers
  PWI: { start: 2011, end: 2013 },  // Pune Warriors India
  KTK: { start: 2011, end: 2011 },  // Kochi Tuskers Kerala
  GL:  { start: 2016, end: 2017 },  // Gujarat Lions
  RPS: { start: 2016, end: 2017 },  // Rising Pune Supergiant
}

export function isValidFranchiseYear(shortCode: string, year: number): boolean {
  const window = DEFUNCT_FRANCHISE_WINDOWS[shortCode]
  if (!window) return true  // Active franchise, all years valid
  return year >= window.start && year <= window.end
}

// Franchises that existed under a different short-code in earlier seasons.
// renamedInYear = first season using the CURRENT code.
const FRANCHISE_RENAMES: Array<{ currentCode: string; historicalCode: string; renamedInYear: number }> = [
  { currentCode: 'PBKS', historicalCode: 'KXIP', renamedInYear: 2021 },
  { currentCode: 'DC',   historicalCode: 'DD',   renamedInYear: 2019 },
]

export function getHistoricalShortCode(currentShortCode: string, seasonYear: number): string {
  for (const r of FRANCHISE_RENAMES) {
    if (r.currentCode === currentShortCode && seasonYear < r.renamedInYear) {
      return r.historicalCode
    }
  }
  return currentShortCode
}
