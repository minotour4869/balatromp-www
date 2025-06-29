import { z } from 'zod'

export const SEASON_3_START_DATE = new Date('2025-06-02T13:00:00.000Z')

// Season type for selection
export const SeasonSchema = z.enum(['season2', 'season3', 'all'])
export type Season = z.infer<typeof SeasonSchema>

// Helper function to determine which season a date belongs to
export function getSeasonForDate(date: Date): 'season2' | 'season3' {
  return date < SEASON_3_START_DATE ? 'season2' : 'season3'
}

// Helper function to filter games by season
export function filterGamesBySeason(games: any[], season: Season): any[] {
  if (season === 'all') return games

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
      return 'Season 3 (Current)'
    case 'all':
      return 'All Seasons'
  }
}
