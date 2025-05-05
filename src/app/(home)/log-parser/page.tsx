'use client'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dropzone,
  DropzoneDescription,
  DropzoneGroup,
  DropzoneInput,
  DropzoneTitle,
  DropzoneUploadIcon,
  DropzoneZone,
} from '@/components/ui/dropzone'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useFormatter } from 'next-intl'
import { useState } from 'react'

// Define the structure for individual log events within a game
type LogEvent = {
  timestamp: Date
  text: string
  type: 'event' | 'status' | 'system' | 'shop' | 'action' | 'error' | 'info'
}

// Define the structure for game options parsed from lobbyOptions
type GameOptions = {
  back?: string | null // Deck
  custom_seed?: string | null
  ruleset?: string | null
  different_decks?: boolean | null
  different_seeds?: boolean | null
  death_on_round_loss?: boolean | null
  gold_on_life_loss?: boolean | null
  no_gold_on_round_loss?: boolean | null
  starting_lives?: number | null
  stake?: number | null
}

// Refined Game type to hold structured data
type Game = {
  id: number // Simple identifier for keys
  host: string | null
  guest: string | null
  hostMods: string[]
  guestMods: string[]
  isHost: boolean | null
  opponentName: string | null
  deck: string | null
  seed: string | null
  options: GameOptions | null
  moneyGained: number
  moneySpent: number
  opponentMoneySpent: number
  startDate: Date
  endDate: Date | null
  durationSeconds: number | null
  lastLives: number
  moneySpentPerShop: (number | null)[]
  moneySpentPerShopOpponent: (number | null)[]
  events: LogEvent[]
}

// Helper to initialize a new game object
const initGame = (id: number, startDate: Date): Game => ({
  id,
  host: null,
  guest: null,
  hostMods: [],
  guestMods: [],
  isHost: null,
  opponentName: null,
  deck: null,
  seed: null,
  options: null,
  moneyGained: 0,
  moneySpent: 0,
  opponentMoneySpent: 0,
  startDate,
  endDate: null,
  durationSeconds: null,
  lastLives: 4, // Default starting lives, might be overridden by options
  moneySpentPerShop: [],
  moneySpentPerShopOpponent: [],
  events: [],
})

// Helper to format duration
const formatDuration = (seconds: number | null): string => {
  if (seconds === null || seconds < 0) return 'N/A'
  if (seconds === 0) return '0s'

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  const parts = []
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`)

  return parts.join(' ')
}

// Helper to convert boolean strings
function boolStrToText(str: string | boolean | undefined | null): string {
  if (str === null || str === undefined) return 'Unknown'
  if (typeof str === 'boolean') return str ? 'Yes' : 'No'
  const lower = str.toLowerCase()
  if (lower === 'true') return 'Yes'
  if (lower === 'false') return 'No'
  return str // Return original if not true/false
}

// Main component
export default function LogParser() {
  const formatter = useFormatter()
  const [parsedGames, setParsedGames] = useState<Game[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const parseLogFile = async (file: File) => {
    setIsLoading(true)
    setError(null)
    setParsedGames([]) // Clear previous results

    try {
      const content = await file.text()
      const logLines = content.split('\n')

      const games: Game[] = []
      let currentGame: Game | null = null
      let lastSeenLobbyOptions: GameOptions | null = null
      let gameCounter = 0

      // Pre-process to find lobby info associated with game starts
      // This is simplified; a more robust approach might be needed for complex logs
      const gameStartInfos = extractGameStartInfo(logLines)
      let gameInfoIndex = 0

      for (const line of logLines) {
        const timeMatch = line.match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/)
        const timestamp = timeMatch?.[1] ? new Date(timeMatch[1]) : new Date() // Use current time as fallback
        const lineLower = line.toLowerCase()

        // --- Game Lifecycle ---
        if (lineLower.includes('startgame message')) {
          // Finalize previous game if it exists
          if (currentGame) {
            if (!currentGame.endDate) currentGame.endDate = timestamp // Use current line time if no end signal seen
            currentGame.durationSeconds = currentGame.endDate
              ? (currentGame.endDate.getTime() -
                  currentGame.startDate.getTime()) /
                1000
              : null
            games.push(currentGame)
          }

          // Start new game
          gameCounter++
          currentGame = initGame(gameCounter, timestamp)
          const currentInfo = gameStartInfos[gameInfoIndex++] ?? {}

          // Apply pre-parsed lobby info and options
          currentGame.host = currentInfo.lobbyInfo?.host ?? null
          currentGame.guest = currentInfo.lobbyInfo?.guest ?? null
          currentGame.hostMods = currentInfo.lobbyInfo?.hostHash ?? []
          currentGame.guestMods = currentInfo.lobbyInfo?.guestHash ?? []
          currentGame.isHost = currentInfo.lobbyInfo?.isHost ?? null
          currentGame.opponentName = currentGame.isHost
            ? currentGame.guest
            : currentGame.host
          currentGame.options = lastSeenLobbyOptions // Apply last seen options
          currentGame.deck = lastSeenLobbyOptions?.back ?? null
          currentGame.seed = currentInfo.seed ?? null // Use seed found near startGame
          if (currentGame.options?.starting_lives) {
            currentGame.lastLives = currentGame.options.starting_lives
          }

          // Add system event for game start
          currentGame.events.push({
            timestamp,
            text: `Game ${gameCounter} Started`,
            type: 'system',
          })
          currentGame.events.push({
            timestamp,
            text: `Host: ${currentGame.host || 'Unknown'}, Guest: ${currentGame.guest || 'Unknown'}`,
            type: 'info',
          })
          currentGame.events.push({
            timestamp,
            text: `Deck: ${currentGame.deck || 'Unknown'}`,
            type: 'info',
          })
          currentGame.events.push({
            timestamp,
            text: `Seed: ${currentGame.seed || 'Unknown'}`,
            type: 'info',
          })
          // Add more info events for options if needed
          continue // Move to next line
        }

        if (line.includes('Client got receiveEndGameJokers')) {
          if (currentGame && !currentGame.endDate) {
            currentGame.endDate = timestamp
            // Sometimes seed is only available here
            const seedMatch = line.match(/seed: ([A-Z0-9]+)/)
            if (!currentGame.seed && seedMatch?.[1]) {
              currentGame.seed = seedMatch[1]
            }
          }
          continue
        }

        // --- Lobby and Options Parsing ---
        if (lineLower.includes('lobbyoptions')) {
          const optionsStr = line.split(' Client sent message:')[1]?.trim()
          if (optionsStr) {
            lastSeenLobbyOptions = parseLobbyOptions(optionsStr)
            // If a game is active, update its options (might happen mid-game?)
            if (currentGame && !currentGame.options) {
              currentGame.options = lastSeenLobbyOptions
              currentGame.deck = lastSeenLobbyOptions.back ?? currentGame.deck
              if (lastSeenLobbyOptions.starting_lives) {
                currentGame.lastLives = lastSeenLobbyOptions.starting_lives
              }
            }
          }
          continue
        }

        // --- In-Game Event Parsing (requires currentGame) ---
        if (!currentGame) continue // Skip lines if no game is active

        if (lineLower.includes('enemyinfo')) {
          const match = line.match(/lives:(\d+)/)
          if (match?.[1]) {
            const newLives = Number.parseInt(match[1], 10)
            if (!isNaN(newLives) && newLives < currentGame.lastLives) {
              currentGame.events.push({
                timestamp,
                text: `Opponent lost a life (${currentGame.lastLives} -> ${newLives})`,
                type: 'event',
              })
            }
            currentGame.lastLives = newLives
          }
          continue
        }
        if (line.includes('Client sent message: action:soldCard')) {
          const match = line.match(/card:(.+)$/)
          if (match?.[1]) {
            const card = match[1].trim()
            currentGame.events.push({
              timestamp,
              text: `Sold ${card}`,
              type: 'shop',
            })
          }
          continue
        }

        if (line.includes(' Client got spentLastShop message')) {
          const match = line.match(/amount: (\d+)/)
          if (match?.[1]) {
            const amount = Number.parseInt(match[1], 10)
            if (!isNaN(amount)) {
              currentGame.opponentMoneySpent += amount
              currentGame.moneySpentPerShopOpponent.push(amount)
              currentGame.events.push({
                timestamp,
                text: `Opponent spent $${amount} in shop`,
                type: 'shop',
              })
            }
          }
          continue
        }

        if (line.includes('Client sent message: action:spentLastShop')) {
          const match = line.match(/amount:(\d+)/)
          if (match?.[1]) {
            const amount = Number.parseInt(match[1], 10)
            if (!isNaN(amount)) {
              currentGame.moneySpentPerShop.push(amount)
              // Note: Total money spent is tracked via moneymoved/reroll/buy
              currentGame.events.push({
                timestamp,
                text: `Reported spending $${amount} last shop`,
                type: 'shop',
              })
            }
          }
          continue
        }

        if (line.includes('Client sent message: action:skip')) {
          currentGame.moneySpentPerShop.push(null) // Mark shop as skipped
          currentGame.events.push({
            timestamp,
            text: 'Skipped shop',
            type: 'shop',
          })
          continue
        }

        // --- Player Actions/Events ---
        if (lineLower.includes('client sent')) {
          if (lineLower.includes('moneymoved')) {
            const match = line.match(/amount: *(-?\d+)/)
            if (match?.[1]) {
              const amount = Number.parseInt(match[1], 10)
              if (!isNaN(amount)) {
                if (amount >= 0) {
                  currentGame.moneyGained += amount
                  currentGame.events.push({
                    timestamp,
                    text: `Gained $${amount}`,
                    type: 'event',
                  })
                } else {
                  const spent = Math.abs(amount)
                  currentGame.moneySpent += spent // Track spending here
                  currentGame.events.push({
                    timestamp,
                    text: `Spent $${spent}`,
                    type: 'event',
                  })
                }
              }
            }
          } else if (line.includes('boughtCardFromShop')) {
            const cardMatch = line.match(/card:([^,\n]+)/i)
            const costMatch = line.match(/cost: *(\d+)/i) // Assuming cost is logged
            const cardRaw = cardMatch?.[1]?.trim() ?? 'Unknown Card'
            const cardClean = cardRaw.replace(/^(c_mp_|j_mp_)/, '')
            const cost = costMatch?.[1] ? Number.parseInt(costMatch[1], 10) : 0
            if (cost > 0) currentGame.moneySpent += cost // Add purchase cost
            currentGame.events.push({
              timestamp,
              text: `Bought ${cardClean}${cost > 0 ? ` for $${cost}` : ''}`,
              type: 'shop',
            })
          } else if (line.includes('rerollShop')) {
            const costMatch = line.match(/cost: *(\d+)/i)
            if (costMatch?.[1]) {
              const cost = Number.parseInt(costMatch[1], 10)
              if (!isNaN(cost)) {
                currentGame.moneySpent += cost // Add reroll cost
                currentGame.events.push({
                  timestamp,
                  text: `Rerolled shop for $${cost}`,
                  type: 'shop',
                })
              }
            }
          } else if (lineLower.includes('usedcard')) {
            const match = line.match(/card:([^,\n]+)/i)
            if (match?.[1]) {
              const raw = match[1].trim()
              const clean = raw
                .replace(/^(c_mp_|j_mp_)/, '')
                .replace(/_/g, ' ')
                .replace(
                  /\w\S*/g,
                  (txt) =>
                    txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
                )
              currentGame.events.push({
                timestamp,
                text: `Used ${clean}`,
                type: 'action',
              })
            }
          } else if (lineLower.includes('setlocation')) {
            const locMatch = line.match(/location:([a-zA-Z0-9_-]+)/)
            if (locMatch?.[1]) {
              const locCode = locMatch[1]
              if (locCode !== 'loc_selecting' && locCode) {
                currentGame.events.push({
                  timestamp,
                  text: `Moved to ${formatLocation(locCode)}`,
                  type: 'status',
                })
              }
            }
          }
        }
      } // End of line processing loop

      // Add the last game if it exists
      if (currentGame) {
        if (!currentGame.endDate) {
          // Find the timestamp of the last event or the last line processed
          const lastEventTime =
            currentGame.events.length > 0
              ? currentGame.events[currentGame.events.length - 1].timestamp
              : null
          const lastLineTime = timeMatch?.[1] ? new Date(timeMatch[1]) : null
          currentGame.endDate =
            lastEventTime ?? lastLineTime ?? currentGame.startDate // Fallback chain
        }
        currentGame.durationSeconds = currentGame.endDate
          ? (currentGame.endDate.getTime() - currentGame.startDate.getTime()) /
            1000
          : null
        games.push(currentGame)
      }

      if (games.length === 0) {
        setError('No games found in the log file.')
      }

      setParsedGames(games)
    } catch (err) {
      console.error('Error parsing log:', err)
      setError(
        `Failed to parse log file. ${err instanceof Error ? err.message : 'Unknown error'}`
      )
      setParsedGames([])
    } finally {
      setIsLoading(false)
    }
  }

  const defaultTabValue =
    parsedGames.length > 0
      ? `game-${parsedGames[0].id}-${parsedGames[0].opponentName || 'Unknown'}`
      : ''

  return (
    <div
      className={
        'mx-auto flex w-[calc(100%-1rem)] max-w-fd-container flex-col gap-4 pt-16'
      }
    >
      <Dropzone
        onDropAccepted={(files) => {
          const file = files[0]
          if (file instanceof File) {
            parseLogFile(file)
          }
        }}
        disabled={isLoading}
      >
        <DropzoneZone className={'w-full'}>
          <DropzoneInput />
          <DropzoneGroup className='gap-4'>
            <DropzoneUploadIcon />
            <DropzoneGroup>
              <DropzoneTitle>Drop log file here or click</DropzoneTitle>
              <DropzoneDescription>
                Upload your Balatro <strong>log.txt</strong> file.
              </DropzoneDescription>
            </DropzoneGroup>
          </DropzoneGroup>
        </DropzoneZone>
      </Dropzone>

      {isLoading && <p>Loading and parsing log...</p>}
      {error && <p className='text-red-500'>{error}</p>}

      {parsedGames.length > 0 && (
        <Tabs defaultValue={defaultTabValue} className='mt-6 w-full'>
          <TabsList className='grid w-full grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'>
            {parsedGames.map((game) => (
              <TabsTrigger
                key={game.id}
                value={`game-${game.id}-${game.opponentName || 'Unknown'}`}
              >
                Game {game.id}: {game.opponentName || 'Unknown'}
              </TabsTrigger>
            ))}
          </TabsList>

          {parsedGames.map((game) => (
            <TabsContent
              key={game.id}
              value={`game-${game.id}-${game.opponentName || 'Unknown'}`}
              className='mt-4'
            >
              <Card>
                <CardHeader>
                  <CardTitle>
                    Game {game.id} vs {game.opponentName || 'Unknown'}
                  </CardTitle>
                  <CardDescription>
                    Started:{' '}
                    {formatter.dateTime(game.startDate, {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}{' '}
                    | Ended:{' '}
                    {game.endDate
                      ? formatter.dateTime(game.endDate, {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })
                      : 'N/A'}{' '}
                    | Duration: {formatDuration(game.durationSeconds)}
                  </CardDescription>
                </CardHeader>
                <CardContent className='grid grid-cols-1 gap-6 md:grid-cols-2'>
                  {/* Column 1: Game Info & Events */}
                  <div className='flex flex-col gap-4'>
                    <Card>
                      <CardHeader>
                        <CardTitle className='text-lg'>Game Details</CardTitle>
                      </CardHeader>
                      <CardContent className='space-y-1 text-base'>
                        <p>
                          <strong>You Were:</strong>{' '}
                          {game.isHost ? 'Host' : 'Guest'} (
                          {game.isHost ? game.host : game.guest})
                        </p>
                        <p>
                          <strong>Deck:</strong> {game.deck || 'Unknown'}
                        </p>
                        <p>
                          <strong>Seed:</strong> {game.seed || 'Unknown'}
                        </p>
                        <p>
                          <strong>Ruleset:</strong>{' '}
                          {game.options?.ruleset || 'Default'}
                        </p>
                        <p>
                          <strong>Stake:</strong>{' '}
                          {game.options?.stake ?? 'Unknown'}
                        </p>
                        {/* Add more options as needed */}
                        <p>
                          <strong>Different Decks:</strong>{' '}
                          {boolStrToText(game.options?.different_decks)}
                        </p>
                        <p>
                          <strong>Different Seeds:</strong>{' '}
                          {boolStrToText(game.options?.different_seeds)}
                        </p>
                        <p>
                          <strong>Death on Round Loss:</strong>{' '}
                          {boolStrToText(game.options?.death_on_round_loss)}
                        </p>
                        <p>
                          <strong>Gold on Life Loss:</strong>{' '}
                          {boolStrToText(game.options?.gold_on_life_loss)}
                        </p>
                        <p>
                          <strong>No Gold on Round Loss:</strong>{' '}
                          {boolStrToText(game.options?.no_gold_on_round_loss)}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className='text-lg'>Events</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className='h-[90vh]'>
                          <div className='space-y-2 pr-4'>
                            {game.events.map((event, index) => (
                              <div
                                // biome-ignore lint/suspicious/noArrayIndexKey: Simple list rendering
                                key={index}
                                className={`text-base ${getEventColor(event.type)}`}
                              >
                                <span className='mr-2 font-mono'>
                                  {formatter.dateTime(event.timestamp, {
                                    timeStyle: 'medium',
                                  })}
                                </span>
                                <span>{event.text}</span>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Column 2: Money & Mods */}
                  <div className='flex flex-col gap-4'>
                    <Card>
                      <CardHeader>
                        <CardTitle className='text-lg'>Shop Spending</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ShopSpendingTable game={game} />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className='text-lg'>Mods</CardTitle>
                      </CardHeader>
                      <CardContent className='space-y-2 text-sm'>
                        <div>
                          <strong>Host ({game.host || 'Unknown'}) Mods:</strong>
                          {game.hostMods.length > 0 ? (
                            <ul className='ml-4 list-inside list-disc font-mono text-xs'>
                              {game.hostMods.map((mod, i) => (
                                <li key={i}>{mod}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className='text-gray-500 italic'>
                              None detected
                            </p>
                          )}
                        </div>
                        <div>
                          <strong>
                            Guest ({game.guest || 'Unknown'}) Mods:
                          </strong>
                          {game.guestMods.length > 0 ? (
                            <ul className='ml-4 list-inside list-disc font-mono text-xs'>
                              {game.guestMods.map((mod, i) => (
                                <li key={i}>{mod}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className='text-gray-500 italic'>
                              None detected
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  )
}

// --- Helper Functions ---

// Simple component for the shop spending table
function ShopSpendingTable({ game }: { game: Game }) {
  const maxShops = Math.max(
    game.moneySpentPerShop.length,
    game.moneySpentPerShopOpponent.length
  )

  if (
    maxShops === 0 &&
    game.moneySpent === 0 &&
    game.opponentMoneySpent === 0
  ) {
    return (
      <p className='text-gray-500 text-sm italic'>
        No shop spending data recorded.
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className='w-[60px] text-right font-mono'>Shop</TableHead>
          <TableHead className='text-right font-mono'>You</TableHead>
          <TableHead className='text-right font-mono'>Opponent</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: maxShops }).map((_, j) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: Simple table rendering
          <TableRow key={j}>
            <TableCell className='text-right font-mono'>{j + 1}</TableCell>
            <TableCell className='text-right font-mono'>
              {game.moneySpentPerShop[j] === null
                ? 'Skipped'
                : game.moneySpentPerShop[j] !== undefined
                  ? `$${game.moneySpentPerShop[j]}`
                  : '-'}
            </TableCell>
            <TableCell className='text-right font-mono'>
              {game.moneySpentPerShopOpponent[j] === null
                ? 'Skipped'
                : game.moneySpentPerShopOpponent[j] !== undefined
                  ? `$${game.moneySpentPerShopOpponent[j]}`
                  : '-'}
            </TableCell>
          </TableRow>
        ))}
        <TableRow className='font-bold'>
          <TableCell>Total Reported</TableCell>
          <TableCell className='text-right font-mono'>
            $
            {game.moneySpentPerShop
              .filter((v): v is number => v !== null)
              .reduce((a, b) => a + b, 0)}
          </TableCell>
          <TableCell className='text-right font-mono'>
            $
            {game.moneySpentPerShopOpponent
              .filter((v): v is number => v !== null)
              .reduce((a, b) => a + b, 0)}
          </TableCell>
        </TableRow>
        <TableRow className='border-t-2 font-bold'>
          <TableCell>Total Actual</TableCell>
          <TableCell className='text-right font-mono'>
            ${game.moneySpent}
          </TableCell>
          <TableCell className='text-right font-mono'>
            ${game.opponentMoneySpent}
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}

// Helper to parse lobby options string
function parseLobbyOptions(optionsStr: string): GameOptions {
  const options: GameOptions = {}
  const params = optionsStr.split(',')
  for (const param of params) {
    const [key, value] = param.split(':')
    const trimmedKey = key?.trim()
    const trimmedValue = value?.trim()
    if (!trimmedKey || !trimmedValue) continue

    switch (trimmedKey) {
      case 'back':
        options.back = trimmedValue
        break
      case 'custom_seed':
        options.custom_seed = trimmedValue
        break
      case 'ruleset':
        options.ruleset = trimmedValue
        break
      case 'different_decks':
      case 'different_seeds':
      case 'death_on_round_loss':
      case 'gold_on_life_loss':
      case 'no_gold_on_round_loss':
        options[trimmedKey] = trimmedValue.toLowerCase() === 'true'
        break
      case 'starting_lives':
      case 'stake':
        const numValue = Number.parseInt(trimmedValue, 10)
        if (!isNaN(numValue)) {
          options[trimmedKey] = numValue
        }
        break
    }
  }
  return options
}

// Helper to format location codes
function formatLocation(locCode: string): string {
  if (locCode === 'loc_shop') {
    return 'Shop'
  }
  if (locCode.startsWith('loc_playing-')) {
    const subcode = locCode.slice('loc_playing-'.length)
    if (subcode.startsWith('bl_')) {
      const blindName = subcode
        .slice(3)
        .replace(/_/g, ' ')
        .replace(
          /\w\S*/g,
          (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        )
      return `${blindName} Blind`
    }
    {
      const readable = subcode
        .replace(/_/g, ' ')
        .replace(
          /\w\S*/g,
          (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        )
      return `Playing ${readable}`
    }
  }
  return locCode
    .replace(/_/g, ' ')
    .replace(
      /\w\S*/g,
      (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    )
}

// Helper to get color class based on event type
function getEventColor(type: LogEvent['type']): string {
  switch (type) {
    case 'event':
      return 'text-blue-400'
    case 'status':
      return 'text-green-400'
    case 'system':
      return 'text-purple-400'
    case 'shop':
      return 'text-yellow-400'
    case 'action':
      return 'text-cyan-400'
    case 'info':
      return 'text-gray-400'
    case 'error':
      return 'text-red-500'
    default:
      return 'text-gray-500'
  }
}

// --- Log Pre-processing Helpers ---

// Simplified structure for lobby info parsing result
type ParsedLobbyInfo = {
  timestamp: Date
  host: string | null
  guest: string | null
  hostHash: string[]
  guestHash: string[]
  isHost: boolean | null
  // Add other fields if needed from parseLobbyInfo
}

// Structure to hold info related to a game start
type GameStartInfo = {
  lobbyInfo: ParsedLobbyInfo | null
  seed: string | null
}

// Function to extract lobby info and seeds associated with game starts
function extractGameStartInfo(lines: string[]): GameStartInfo[] {
  const gameInfos: GameStartInfo[] = []
  let latestLobbyInfo: ParsedLobbyInfo | null = null
  let nextGameSeed: string | null = null // Seed often appears *after* start

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineLower = line.toLowerCase()

    // Capture the latest lobby info seen
    if (line.includes('Client got lobbyInfo message')) {
      try {
        latestLobbyInfo = parseLobbyInfoLine(line) // Use a dedicated parser
      } catch (e) {
        console.warn('Could not parse lobbyInfo line:', line, e)
        latestLobbyInfo = null // Reset if parsing fails
      }
    }

    // Capture seed from endgame message (often relates to the *next* game's seed if custom)
    // Or seed from the startGame message itself
    if (line.includes('Client got receiveEndGameJokers message')) {
      const seedMatch = line.match(/seed: ([A-Z0-9]+)/)
      if (seedMatch?.[1]) {
        // This seed might belong to the game that just ended,
        // or potentially the *next* one if using custom seeds?
        // Let's tentatively store it for the *next* game start.
        // A more robust logic might be needed depending on exact log behavior.
        // nextGameSeed = seedMatch[1]; // Let's disable this for now, seed on start is more reliable
      }
    }

    // When a game starts, associate the latest lobby info and potentially the seed
    if (lineLower.includes('startgame message')) {
      const seedMatch = line.match(/seed:\s*([^) ]+)/)
      const startGameSeed = seedMatch?.[1] || null

      gameInfos.push({
        lobbyInfo: latestLobbyInfo,
        seed: startGameSeed ?? nextGameSeed, // Prefer seed from start message
      })
      // Reset for the next game
      latestLobbyInfo = null
      nextGameSeed = null
    }
  }
  return gameInfos
}

// Parses a single lobbyInfo log line (adapt your original parseLobbyInfo)
function parseLobbyInfoLine(line: string): ParsedLobbyInfo | null {
  // Basic parsing, adjust regex/logic based on your exact log format
  const timeMatch = line.match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/)
  const timestamp = timeMatch?.[1] ? new Date(timeMatch[1]) : new Date()

  const hostMatch = line.match(/host: ([^ )]+)/)
  const guestMatch = line.match(/guest: ([^ )]+)/)
  const hostHashMatch = line.match(/hostHash: ([^)]+)/) // Capture content within parenthesis potentially
  const guestHashMatch = line.match(/guestHash: ([^)]+)/)
  const isHostMatch = line.includes('isHost: true')

  // Clean up hash strings (remove parenthesis if captured, split by ';')
  const cleanHash = (hashStr: string | null | undefined) => {
    if (!hashStr) return []
    return hashStr
      .replace(/[()]/g, '')
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
  }

  return {
    timestamp,
    host: hostMatch?.[1] || null,
    guest: guestMatch?.[1] || null,
    hostHash: cleanHash(hostHashMatch?.[1]),
    guestHash: cleanHash(guestHashMatch?.[1]),
    isHost: isHostMatch,
  }
}

// Original boolStrToText - kept for reference if needed elsewhere
// function boolStrToText(str: string | undefined | null) {
//   if (!str) {
//     return 'Unknown'
//   }
//   if (str === 'true') {
//     return 'Yes'
//   }
//   if (str === 'false') {
//     return 'No'
//   }
//   return str
// }

// Original getGamesConfigs - replaced by extractGameStartInfo
// function getGamesConfigs(lines: string[]) { ... }

// Original parseLobbyInfo - replaced by parseLobbyInfoLine
// function parseLobbyInfo(line: string) { ... }
