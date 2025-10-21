'use client'

import type React from 'react'
import {
  type ComponentPropsWithoutRef,
  Fragment,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/mobile-tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import {
  RANKED_QUEUE_ID,
  SMALLWORLD_QUEUE_ID,
  VANILLA_QUEUE_ID,
} from '@/shared/constants'
import {
  type Season,
  SeasonSchema,
  getSeasonDisplayName,
} from '@/shared/seasons'
import { api } from '@/trpc/react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Flame,
  Search,
  TrendingUp,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

const RANK_IMAGES = {
  foil: '/ranks/foil.png',
  glass: '/ranks/glass2.png',
  gold: '/ranks/gold.png',
  holographic: '/ranks/holo.png',
  lucky: '/ranks/lucky.png',
  negative: '/ranks/negative.png',
  polychrome: '/ranks/poly.png',
  steel: '/ranks/steel.png',
  stone: '/ranks/stone.png',
}

const EDITION_THRESHOLD = {
  FOIL: 50,
  HOLOGRAPHIC: 10,
  POLYCHROME: 3,
  NEGATIVE: 1,
}

const ENHANCEMENT_THRESHOLD = {
  STEEL: 250,
  GOLD: 320,
  LUCKY: 460,
  GLASS: 620,
}

const getMedal = (rank: number, mmr: number, isVanilla?: boolean) => {
  if (isVanilla) {
    return null
  }
  let enhancement = RANK_IMAGES.stone
  let tooltip = 'Stone'
  if (mmr >= ENHANCEMENT_THRESHOLD.STEEL) {
    enhancement = RANK_IMAGES.steel
    tooltip = 'Steel'
  }
  if (mmr >= ENHANCEMENT_THRESHOLD.GOLD) {
    enhancement = RANK_IMAGES.gold
    tooltip = 'Gold'
  }
  if (mmr >= ENHANCEMENT_THRESHOLD.LUCKY) {
    enhancement = RANK_IMAGES.lucky
    tooltip = 'Lucky'
  }
  if (mmr >= ENHANCEMENT_THRESHOLD.GLASS) {
    enhancement = RANK_IMAGES.glass
    tooltip = 'Glass'
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className='flex shrink-0 items-center justify-center gap-1.5'>
            <img
              src={enhancement}
              alt={`Rank ${rank}`}
              className='h-5 text-white'
            />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function LeaderboardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Get the leaderboard type from URL or default to 'ranked'
  const leaderboardType = searchParams.get('type') || 'ranked'
  // Get the season from URL or default to 'season4'
  const seasonParam = searchParams.get('season') as Season | null
  const season =
    seasonParam && SeasonSchema.safeParse(seasonParam).success
      ? seasonParam
      : 'season4'
  const [gamesAmount, setGamesAmount] = useState([0, 100])

  // State for search and sorting
  const [searchQuery, setSearchQuery] = useState('')
  const [sortColumn, setSortColumn] = useState(
    ['season2', 'season3'].includes(season) ? 'mmr' : 'rank'
  )
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(
    ['season2', 'season3'].includes(season) ? 'desc' : 'asc'
  )

  // Update sort settings when season changes
  useEffect(() => {
    if (['season2', 'season3'].includes(season)) {
      setSortColumn('mmr')
      setSortDirection('desc')
    } else {
      setSortColumn('rank')
      setSortDirection('asc')
    }
  }, [season])

  // Fetch leaderboard data
  const [rankedLeaderboardResult] =
    api.leaderboard.get_leaderboard.useSuspenseQuery({
      channel_id: RANKED_QUEUE_ID,
      season,
    })

  const [vanillaLeaderboardResult] =
    api.leaderboard.get_leaderboard.useSuspenseQuery({
      channel_id: VANILLA_QUEUE_ID,
      season,
    })
  const [smallWorldLeaderboardResult] =
    api.leaderboard.get_leaderboard.useSuspenseQuery({
      channel_id: SMALLWORLD_QUEUE_ID,
      season,
    })

  // Get the current leaderboard based on selected tab
  const currentLeaderboardResult = useMemo(
    () =>
      leaderboardType === 'ranked'
        ? rankedLeaderboardResult
        : leaderboardType === 'vanilla'
          ? vanillaLeaderboardResult
          : smallWorldLeaderboardResult,
    [
      leaderboardType,
      rankedLeaderboardResult,
      vanillaLeaderboardResult,
      smallWorldLeaderboardResult,
    ]
  )

  const currentLeaderboard = currentLeaderboardResult.data

  const filteredLeaderboard = useMemo(
    () =>
      currentLeaderboard.filter((entry) =>
        entry.name.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [currentLeaderboard, searchQuery]
  )

  const maxGamesAmount = useMemo(
    () => Math.max(...filteredLeaderboard.map((entry) => entry.totalgames)),
    [filteredLeaderboard]
  )

  useEffect(() => {
    if (maxGamesAmount === gamesAmount[1]) return
    setGamesAmount([0, maxGamesAmount])
  }, [maxGamesAmount])

  // Handle tab change
  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams)
    setGamesAmount([0, maxGamesAmount])
    params.set('type', value)
    router.push(`?${params.toString()}`)
  }

  // Handle season change
  const handleSeasonChange = (value: Season) => {
    const params = new URLSearchParams(searchParams)
    params.set('season', value)
    router.push(`?${params.toString()}`)
  }

  const [sliderValue, setSliderValue] = useState([0, maxGamesAmount])
  const handleGamesAmountSliderChange = (value: number[]) => {
    setSliderValue(value)
  }
  const handleGamesAmountSliderCommit = (value: number[]) => {
    setGamesAmount(value)
  }
  // Sort leaderboard
  const sortedLeaderboard = useMemo(
    () =>
      [...filteredLeaderboard].sort((a, b) => {
        // biome-ignore lint/style/useSingleVarDeclarator: <explanation>
        // biome-ignore lint/suspicious/noImplicitAnyLet: <explanation>
        let valueA, valueB

        // Handle special case for rank which is already sorted
        if (sortColumn === 'rank') {
          valueA = a.rank
          valueB = b.rank
        } else if (sortColumn === 'name') {
          valueA = a.name.toLowerCase()
          valueB = b.name.toLowerCase()
          return sortDirection === 'asc'
            ? valueA.localeCompare(valueB)
            : valueB.localeCompare(valueA)
        } else {
          valueA = a[sortColumn as keyof typeof a] as number
          valueB = b[sortColumn as keyof typeof b] as number
        }

        return sortDirection === 'asc' ? valueA - valueB : valueB - valueA
      }),
    [filteredLeaderboard, sortColumn, sortDirection]
  )

  const leaderboardFilteredByGameAmounts = useMemo(
    () =>
      sortedLeaderboard.filter((entry) => {
        if (!gamesAmount) return true

        return (
          entry.totalgames >= (gamesAmount[0] ?? 0) &&
          entry.totalgames <= (gamesAmount[1] ?? Number.MAX_SAFE_INTEGER)
        )
      }),
    [sortedLeaderboard, gamesAmount]
  )

  // Handle column sort
  const handleSort = useCallback(
    (column: string) => {
      if (sortColumn === column) {
        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
      } else {
        setSortColumn(column)
        setSortDirection('asc')
      }
    },
    [sortColumn, sortDirection]
  )

  return (
    <div className='flex flex-1 flex-col overflow-hidden'>
      <div className='mx-auto flex w-[calc(100%-1rem)] max-w-fd-container flex-1 flex-col'>
        <div className='flex flex-1 flex-col overflow-hidden border-none'>
          {currentLeaderboardResult.isStale && (
            <Alert className='my-4 border-amber-500 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300'>
              <AlertTitle>Stale Data</AlertTitle>
              <AlertDescription>
                The leaderboard data is currently stale due to issues with the
                botlatro service. We're showing you the latest available data.
                Please check back later.
              </AlertDescription>
            </Alert>
          )}
          <Tabs
            defaultValue={leaderboardType}
            value={leaderboardType}
            onValueChange={handleTabChange}
            className='flex flex-1 flex-col px-0 py-4 md:py-6'
          >
            <div className='mb-6 flex w-full flex-col items-start justify-between gap-4 md:items-center lg:flex-row'>
              <div className='flex flex-col gap-4 md:flex-row md:items-center'>
                <TabsList className='border border-gray-200 border-b bg-gray-50 dark:border-zinc-800 dark:bg-zinc-800/50'>
                  <TabsTrigger value='ranked'>Ranked</TabsTrigger>
                  <TabsTrigger value='vanilla'>Vanilla</TabsTrigger>
                  <TabsTrigger value='smallworld'>Smallworld</TabsTrigger>
                </TabsList>

                <div className='flex items-center gap-2'>
                  <Label htmlFor='season-select' className='text-sm'>
                    Season:
                  </Label>
                  <Select
                    value={season}
                    onValueChange={(value) =>
                      handleSeasonChange(value as Season)
                    }
                  >
                    <SelectTrigger id='season-select' className='w-[180px]'>
                      <SelectValue placeholder='Select season' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='season4'>
                        {getSeasonDisplayName('season4')}
                      </SelectItem>
                      <SelectItem value='season3'>
                        {getSeasonDisplayName('season3')}
                      </SelectItem>
                      <SelectItem value='season2'>
                        {getSeasonDisplayName('season2')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div
                className={
                  'flex w-full flex-col items-center justify-end gap-2 lg:w-fit lg:flex-row lg:gap-4'
                }
              >
                <div className={'flex w-full flex-col gap-1 md:w-[300px]'}>
                  <Label>Games</Label>
                  <div className='flex w-full items-center gap-2'>
                    <span>{gamesAmount[0]}</span>
                    <Slider
                      value={sliderValue}
                      onValueCommit={handleGamesAmountSliderCommit}
                      max={maxGamesAmount}
                      onValueChange={handleGamesAmountSliderChange}
                      step={1}
                      className={cn('w-full')}
                    />
                    <span>{gamesAmount[1]}</span>
                  </div>
                </div>
                <div className={'flex w-full flex-col gap-1 md:w-[250px]'}>
                  <Label>Search players</Label>
                  <div className='relative w-full sm:w-auto'>
                    <Search className='absolute top-2.5 left-2.5 h-4 w-4 text-gray-400 dark:text-zinc-400' />
                    <Input
                      placeholder='Search players...'
                      className='w-full border-gray-200 bg-white pl-9 dark:border-zinc-700 dark:bg-zinc-900'
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className='m-0 flex flex-1 flex-col'>
              <LeaderboardTable
                leaderboard={leaderboardFilteredByGameAmounts}
                isVanilla={leaderboardType !== 'ranked'}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSort={handleSort}
                getMedal={getMedal}
              />
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  )
}

interface LeaderboardTableProps {
  leaderboard: any[]
  sortColumn: string
  isVanilla?: boolean
  sortDirection: 'asc' | 'desc'
  onSort: (column: string) => void
  getMedal: (rank: number, mmr: number, isVanilla?: boolean) => React.ReactNode
}

function RawLeaderboardTable({
  leaderboard,
  isVanilla,
  sortColumn,
  sortDirection,
  onSort,
  getMedal,
}: LeaderboardTableProps) {
  const tableContainerRef = useRef<HTMLDivElement>(null)

  // Set a fixed row height for virtualization
  const ROW_HEIGHT = 39 // Adjust based on your actual row height
  // Create virtualizer instance
  const rowVirtualizer = useVirtualizer({
    count: leaderboard.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12, // Number of items to render before/after the visible area
  })

  // Get the virtualized rows
  const virtualRows = rowVirtualizer.getVirtualItems()
  const paddingTop = virtualRows.length > 0 ? (virtualRows?.[0]?.start ?? 0) : 0
  const paddingBottom =
    virtualRows.length > 0
      ? rowVirtualizer.getTotalSize() -
        (virtualRows?.[virtualRows.length - 1]?.end ?? 0)
      : 0
  return (
    <div className='flex flex-1 flex-col overflow-hidden rounded-lg border'>
      <div
        ref={tableContainerRef}
        className='flex-1 overflow-auto overflow-x-auto'
        style={{ maxHeight: 'calc(100vh - 200px)' }}
      >
        <Table>
          <TableHeader className='sticky top-0 z-10 bg-white dark:bg-zinc-900'>
            <TableRow className='bg-gray-50 dark:bg-zinc-800/50'>
              <TableHead className='w-[40px] text-right'>#</TableHead>
              <TableHead className='w-[80px]'>
                <SortableHeader
                  className='w-full justify-end'
                  column='rank'
                  label='Rank'
                  currentSort={sortColumn}
                  direction={sortDirection}
                  onSort={onSort}
                />
              </TableHead>
              <TableHead>
                <SortableHeader
                  column='name'
                  label='Player'
                  currentSort={sortColumn}
                  direction={sortDirection}
                  onSort={onSort}
                />
              </TableHead>
              <TableHead className='text-right'>
                <SortableHeader
                  className='w-full justify-end'
                  column='mmr'
                  label='MMR'
                  currentSort={sortColumn}
                  direction={sortDirection}
                  onSort={onSort}
                />
              </TableHead>
              <TableHead className='text-right' align={'right'}>
                <SortableHeader
                  className='w-full justify-end'
                  column='peak_mmr'
                  label='Peak MMR'
                  currentSort={sortColumn}
                  direction={sortDirection}
                  onSort={onSort}
                />
              </TableHead>
              <TableHead className='text-right'>
                <SortableHeader
                  className='w-full justify-end'
                  column='winrate'
                  label='Win Rate'
                  currentSort={sortColumn}
                  direction={sortDirection}
                  onSort={onSort}
                />
              </TableHead>
              <TableHead className='text-right'>
                <SortableHeader
                  className='w-full justify-end'
                  column='wins'
                  label='Wins'
                  currentSort={sortColumn}
                  direction={sortDirection}
                  onSort={onSort}
                />
              </TableHead>
              <TableHead className='text-right'>
                <SortableHeader
                  className='w-full justify-end'
                  column='losses'
                  label='Losses'
                  currentSort={sortColumn}
                  direction={sortDirection}
                  onSort={onSort}
                />
              </TableHead>
              <TableHead className='text-right'>
                <SortableHeader
                  className='w-full justify-end'
                  column='totalgames'
                  label='Games'
                  currentSort={sortColumn}
                  direction={sortDirection}
                  onSort={onSort}
                />
              </TableHead>
              <TableHead className='text-right'>
                <SortableHeader
                  className='w-full justify-end'
                  column='streak'
                  label='Streak'
                  currentSort={sortColumn}
                  direction={sortDirection}
                  onSort={onSort}
                />
              </TableHead>
              <TableHead className='text-right'>
                <SortableHeader
                  className='w-full justify-end'
                  column='peak_streak'
                  label='Peak Streak'
                  currentSort={sortColumn}
                  direction={sortDirection}
                  onSort={onSort}
                />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paddingTop > 0 && (
              <tr>
                <td style={{ height: `${paddingTop}px` }} colSpan={9} />
              </tr>
            )}
            {leaderboard.length > 0 ? (
              virtualRows.map((virtualRow) => {
                const entry = leaderboard[virtualRow.index]
                const winrate = entry.winrate * 100
                return (
                  <Fragment key={entry.id}>
                    {/* Add padding to the top to push content into view */}

                    <TableRow
                      className={cn(
                        'transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800/70'
                      )}
                    >
                      <TableCell className='w-10 text-right font-medium'>
                        {virtualRow.index + 1}
                      </TableCell>
                      <TableCell className='w-28 font-medium'>
                        <div className='flex items-center justify-end gap-1.5 pr-4.5 font-mono'>
                          <span className={cn(entry.rank < 10 && 'ml-[1ch]')}>
                            {entry.rank}
                          </span>
                          {getMedal(entry.rank, entry.mmr, isVanilla)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link
                          prefetch={false}
                          href={`/players/${entry.id}`}
                          className='group flex items-center gap-2'
                        >
                          <span className='font-medium group-hover:underline'>
                            {entry.name}
                          </span>
                          {entry.streak >= 3 && (
                            <Badge className='bg-orange-500 text-white hover:no-underline'>
                              <Flame className='h-3 w-3' />
                            </Badge>
                          )}
                        </Link>
                      </TableCell>
                      <TableCell className='pr-7 text-right font-medium font-mono'>
                        {Math.round(entry.mmr)}
                      </TableCell>
                      <TableCell className='text-right font-mono'>
                        <div className='flex items-center justify-end gap-1'>
                          {Math.round(entry.peak_mmr)}
                          <TrendingUp className='h-3.5 w-3.5 text-violet-400' />
                        </div>
                      </TableCell>
                      <TableCell className='text-right'>
                        <Badge
                          variant='outline'
                          className={cn(
                            'font-normal ',
                            winrate > 60
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : winrate < 40
                                ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                : 'border-gray-200 bg-gray-50 text-gray-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                          )}
                        >
                          {Math.round(winrate)}%
                        </Badge>
                      </TableCell>
                      <TableCell className='text-right text-emerald-600 dark:text-emerald-400'>
                        {entry.wins}
                      </TableCell>
                      <TableCell className='text-right text-rose-600 dark:text-rose-400'>
                        {entry.losses}
                      </TableCell>
                      <TableCell className='text-right font-mono text-slate-600 dark:text-slate-400'>
                        {entry.totalgames}
                      </TableCell>
                      <TableCell className='text-right font-mono'>
                        {entry.streak > 0 ? (
                          <span className='flex items-center justify-end text-emerald-600 dark:text-emerald-400'>
                            <ArrowUp className='mr-1 h-3.5 w-3.5' />
                            {entry.streak}
                          </span>
                        ) : entry.streak < 0 ? (
                          <span className='flex items-center justify-end font-mono text-rose-600 dark:text-rose-400'>
                            <ArrowDown className='mr-1 h-3.5 w-3.5' />
                            <span className={'w-[2ch]'}>
                              {Math.abs(entry.streak)}
                            </span>
                          </span>
                        ) : (
                          <span>0</span>
                        )}
                      </TableCell>
                      <TableCell className='text-right'>
                        <span className='flex items-center justify-end font-mono'>
                          {entry.peak_streak}
                        </span>
                      </TableCell>
                    </TableRow>
                  </Fragment>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={9} className='h-24 text-center'>
                  <p className='text-gray-500 dark:text-zinc-400'>
                    No players found
                  </p>
                </TableCell>
              </TableRow>
            )}
            {paddingBottom > 0 && (
              <tr>
                <td style={{ height: `${paddingBottom}px` }} colSpan={9} />
              </tr>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

interface SortableHeaderProps extends ComponentPropsWithoutRef<'button'> {
  column: string
  label: string
  currentSort: string
  direction: 'asc' | 'desc'
  onSort: (column: string) => void
}

function SortableHeader({
  column,
  label,
  currentSort,
  direction,
  onSort,
  className,
  ...rest
}: SortableHeaderProps) {
  const isActive = currentSort === column

  return (
    <button
      type={'button'}
      className={cn(
        'flex items-center gap-1 transition-colors hover:text-violet-500 dark:hover:text-violet-400',
        className
      )}
      {...rest}
      onClick={() => onSort(column)}
    >
      {label}
      <span className={'flex w-4 items-center justify-center'}>
        {isActive ? (
          direction === 'asc' ? (
            <ArrowUp className='h-3.5 w-3.5' />
          ) : (
            <ArrowDown className='h-3.5 w-3.5' />
          )
        ) : (
          <ArrowUpDown className='h-3.5 w-3.5 opacity-50' />
        )}
      </span>
    </button>
  )
}

export const LeaderboardTable = memo(RawLeaderboardTable)
LeaderboardTable.displayName = 'LeaderboardTable'
