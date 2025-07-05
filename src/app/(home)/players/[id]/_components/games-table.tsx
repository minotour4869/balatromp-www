'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { SelectGames } from '@/server/db/types'
import { api } from '@/trpc/react'
import {
  type SortingState,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
  ArrowDownCircle,
  ArrowUp,
  ArrowUpCircle,
  MinusCircle,
} from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useFormatter, useTimeZone } from 'next-intl'
import Link from 'next/link'
import { useMemo, useState } from 'react'

const numberFormatter = new Intl.NumberFormat('en-US', {
  signDisplay: 'exceptZero',
})

const columnHelper = createColumnHelper<SelectGames>()
// This function is now moved inside the GamesTable component
const useColumns = (openTranscriptFn?: (gameNumber: number) => void) => {
  const format = useFormatter()
  const timeZone = useTimeZone()
  const session = useSession()
  const isAdmin = session.data?.user.role === 'admin'
  return useMemo(
    () => [
      columnHelper.accessor('opponentName', {
        meta: { className: 'pl-4' },
        header: 'Opponent',
        cell: (info) => (
          <Link
            href={`/players/${info.row.original.opponentId}`}
            className='pl-4 font-medium hover:underline'
          >
            {info.getValue()}
          </Link>
        ),
      }),
      columnHelper.accessor('gameType', {
        header: 'Game Type',
        cell: (info) => {
          const gameType = info.getValue()
          return (
            <Badge
              variant='outline'
              className={cn(
                'font-normal capitalize',
                gameType === 'ranked'
                  ? 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300'
                  : gameType.toLowerCase() === 'vanilla'
                    ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    : 'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-700 dark:text-zinc-300'
              )}
            >
              {info.getValue()}
            </Badge>
          )
        },
      }),
      columnHelper.accessor('opponentMmr', {
        header: 'Opponent MMR',
        meta: { className: 'justify-end' },
        cell: (info) => (
          <span className='flex w-full justify-end font-mono'>
            {Math.trunc(info.getValue())}
          </span>
        ),
      }),
      columnHelper.accessor('playerMmr', {
        header: 'MMR',
        meta: { className: 'justify-end' },
        cell: (info) => (
          <span className='flex w-full justify-end font-mono'>
            {Math.trunc(info.getValue())}
          </span>
        ),
      }),
      columnHelper.accessor('mmrChange', {
        header: 'Result',
        meta: { className: 'justify-end' },
        cell: (info) => {
          const mmrChange = info.getValue()
          return (
            <span
              className={cn(
                'flex items-center justify-end font-medium font-mono',
                mmrChange === 0
                  ? 'text-zink-800 dark:text-zink-200'
                  : mmrChange > 0
                    ? 'text-emerald-500'
                    : 'text-rose-500'
              )}
            >
              {numberFormatter.format(Math.trunc(mmrChange))}
              {mmrChange === 0 ? (
                <MinusCircle className='ml-1 h-4 w-4' />
              ) : mmrChange > 0 ? (
                <ArrowUpCircle className='ml-1 h-4 w-4' />
              ) : (
                <ArrowDownCircle className='ml-1 h-4 w-4' />
              )}
            </span>
          )
        },
      }),
      columnHelper.accessor('gameTime', {
        header: 'Date',
        meta: { className: 'justify-end' },
        cell: (info) => (
          <span
            className={'flex items-center justify-end font-medium font-mono'}
          >
            {format.dateTime(info.getValue(), {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              timeZone,
            })}
          </span>
        ),
      }),
      columnHelper.accessor('gameTime', {
        header: 'Time',
        meta: { className: 'justify-end pr-4' },
        cell: (info) => (
          <span
            className={
              'flex items-center justify-end pr-4 font-medium font-mono'
            }
          >
            {format.dateTime(info.getValue(), {
              hour: '2-digit',
              minute: '2-digit',
              timeZone,
            })}
          </span>
        ),
        id: 'time',
      }),
      ...(isAdmin
        ? [
            columnHelper.accessor('gameNum', {
              header: 'Transcript',
              meta: { className: 'pr-0' },
              cell: (info) => (
                <Button
                  size={'sm'}
                  onClick={() =>
                    openTranscriptFn ? openTranscriptFn(info.getValue()) : null
                  }
                  type={'button'}
                  variant={'ghost'}
                >
                  Transcript
                </Button>
              ),
              id: 'transcript',
            }),
          ]
        : []),
    ],
    [isAdmin, timeZone]
  )
}

export function GamesTable({ games }: { games: SelectGames[] }) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [transcriptGameNumber, setTranscriptGameNumber] = useState<
    number | null
  >(null)

  // Use the tRPC useQuery hook to fetch the transcript
  const { data: transcriptContent, isLoading } = api.history.getTranscript.useQuery(
    { gameNumber: transcriptGameNumber ?? 0 },
    {
      // Only fetch when we have a game number and the dialog is open
      enabled: transcriptGameNumber !== null && isDialogOpen,
      // Don't refetch on window focus
      refetchOnWindowFocus: false,
    }
  )

  // New openTranscript function that sets state instead of opening a new window
  const openTranscript = (gameNumber: number): void => {
    setTranscriptGameNumber(gameNumber)
    setIsDialogOpen(true)
  }

  // Pass the openTranscript function to useColumns
  const columns = useColumns(openTranscript)

  const table = useReactTable({
    data: games,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (originalRow) => originalRow.gameNum.toString(),
  })

  return (
    <>
      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sortDirection = header.column.getIsSorted()
                  return (
                    <TableHead key={header.id} className={'px-0'}>
                      <span
                        className={cn(
                          'flex w-full items-center',
                          (header.column.columnDef.meta as any)?.className
                        )}
                      >
                        <Button
                          className={cn(
                            header.column.getCanSort() &&
                              'cursor-pointer select-none',
                            (
                              header.column.columnDef.meta as any
                            )?.className?.includes('justify-end') &&
                              'flex-row-reverse'
                          )}
                          size={'table'}
                          variant='ghost'
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {sortDirection ? (
                            <ArrowUp
                              className={cn(
                                'transition-transform',
                                sortDirection === 'asc' ? 'rotate-180' : ''
                              )}
                            />
                          ) : (
                            <div className={'h-4 w-4'} />
                          )}
                        </Button>
                      </span>
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Transcript Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className='max-h-[80vh] w-full overflow-y-auto sm:max-w-[calc(100%-2rem)] '>
          <DialogHeader>
            <DialogTitle>
              {transcriptGameNumber
                ? `Game Transcript #${transcriptGameNumber}`
                : 'Game Transcript'}
            </DialogTitle>
          </DialogHeader>
          {/* Use iframe to isolate the transcript content and prevent style leakage */}
          <div className='!h-[60vh] mt-4 w-full'>
            {isLoading ? (
              <div className='flex h-full w-full items-center justify-center'>
                <div className='text-center'>
                  <div className='mb-2 h-6 w-6 animate-spin rounded-full border-b-2 border-t-2 border-gray-900 dark:border-gray-100'></div>
                  <p>Loading transcript...</p>
                </div>
              </div>
            ) : transcriptContent ? (
              <iframe
                srcDoc={transcriptContent}
                title={`Game Transcript #${transcriptGameNumber || ''}`}
                className='h-full w-full border-0'
                sandbox='allow-same-origin'
              />
            ) : (
              <div className='flex h-full w-full items-center justify-center'>
                <p>Failed to load transcript. Please try again.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
