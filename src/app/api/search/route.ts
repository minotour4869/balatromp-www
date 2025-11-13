import { LeaderboardService } from '@/server/services/leaderboard'
import { RANKED_QUEUE_ID } from '@/shared/constants'
import type { PlayerSearchResult, SearchResult } from '@/types/search'
import { createFromSource } from 'fumadocs-core/search/server'
import { source } from '../../../../lib/source'

const leaderboardService = new LeaderboardService()

// Create the default fumadocs search handler
const fumadocsSearch = createFromSource(source)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query') ?? ''

    // Get fumadocs results
    const fumadocsResponse = await fumadocsSearch.GET(request)
    const fumadocsData = await fumadocsResponse.json()

    // Get leaderboard players - search by name or discord ID
    let playerResults: PlayerSearchResult[] = []

    if (query.trim()) {
      try {
        const leaderboard = await leaderboardService.getLeaderboard(
          RANKED_QUEUE_ID,
          {
            page: 1,
            pageSize: 1000, // Get enough to search through
            search: query,
          }
        )

        // Also search by Discord ID (fuzzy match)
        const queryLower = query.toLowerCase()
        const filteredPlayers = leaderboard.data.filter((player) => {
          const nameMatch = player.name.toLowerCase().includes(queryLower)
          const idMatch = player.id.toLowerCase().includes(queryLower)
          return nameMatch || idMatch
        })

        // Take top 10 matches
        playerResults = filteredPlayers.slice(0, 10).map((player) => ({
          type: 'player' as const,
          username: player.name,
          discord_id: player.id,
          ranked_mmr: player.mmr,
          url: `/players/${player.id}`,
        }))
      } catch (error) {
        console.error('Error searching leaderboard:', error)
        // Continue without player results if search fails
      }
    }
    // Merge results - fumadocs results first, then player results
    const combinedResults: SearchResult[] = [
      ...fumadocsData.map((result: any) => ({
        type: 'doc' as const,
        id: result.id,
        url: result.url,
        content: result.content,
        docType: result.type,
      })),
      ...playerResults,
    ]

    return Response.json(combinedResults)
  } catch (error) {
    console.error('Search error:', error)
    return Response.json({ error: 'Search failed' }, { status: 500 })
  }
}
