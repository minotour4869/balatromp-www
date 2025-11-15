import { z } from 'zod'

export const SEASON_3_START_DATE = new Date('2025-06-02T13:00:00.000Z')
export const SEASON_4_START_DATE = new Date('2025-09-01T05:00:00.000Z')

// Season type for selection
export const SeasonSchema = z.enum(['season2', 'season3', 'season4'])
export type Season = z.infer<typeof SeasonSchema>

// Helper function to determine which season a date belongs to
export function getSeasonForDate(
  date: Date
): 'season2' | 'season3' | 'season4' {
  if (date < SEASON_3_START_DATE) return 'season2'
  if (date < SEASON_4_START_DATE) return 'season3'
  return 'season4'
}

// Helper function to filter games by season
export function filterGamesBySeason(games: any[], season: Season): any[] {
  return games.filter((game) => {
    const gameDate = new Date(game.gameTime)
    const gameSeason = getSeasonForDate(gameDate)
    return gameSeason === season
  })
}

// Helper function to get a display name for a season
export function getSeasonDisplayName(season: Season): string {
  switch (season) {
    case 'season2':
      return 'Season 2'
    case 'season3':
      return 'Season 3'
    case 'season4':
      return 'Season 4 (Current)'
  }
}
