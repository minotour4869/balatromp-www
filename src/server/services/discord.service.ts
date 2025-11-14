import { env } from '@/env'
import ky, { HTTPError, type KyResponse } from 'ky'

const DISCORD_URL = 'https://discord.com/api/v10'
const instance = ky.create({
  prefixUrl: DISCORD_URL,
  headers: {
    Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
  },
  timeout: 10000,
  retry: {
    limit: 3,
    methods: ['get'],
    statusCodes: [429, 500, 502, 503, 504],
    afterStatusCodes: [429, 500, 502, 503, 504],
  },
  hooks: {
    afterResponse: [
      async (request, options, response) => {
        // Handle Discord rate limit
        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after')
          const delayMs = retryAfter ? parseFloat(retryAfter) * 1000 : 1000
          console.log(`[Discord] Rate limited, waiting ${delayMs}ms before retry`)
          await new Promise(resolve => setTimeout(resolve, delayMs))
          // Return undefined to retry
          return
        }
        return response
      },
    ],
  },
})

export const discord_service = {
  get_user_by_id: async (user_id: string) => {
    try {
      const res = await instance.get(`users/${user_id}`)
      const res_json = (await res.json()) as DiscordUser

      return {
        ...res_json,
        avatar_url: `https://cdn.discordapp.com/avatars/${user_id}/${res_json.avatar}.png`,
      }
    } catch (error) {
      // Ensure response body is consumed even on error
      if (error instanceof HTTPError && error.response?.body) {
        try {
          await error.response.arrayBuffer()
        } catch {
          // ignore
        }
      }
      throw error
    }
  },
}
export type DiscordUser = {
  id: string
  username: string
  avatar: string
  discriminator: string
  public_flags: number
  flags: number
  banner?: unknown
  accent_color?: unknown
  global_name: string
  avatar_decoration_data?: unknown
  collectibles?: unknown
  banner_color?: unknown
  clan?: unknown
  primary_guild?: unknown
}
