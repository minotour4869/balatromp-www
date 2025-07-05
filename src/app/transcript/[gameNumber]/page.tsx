import { api } from '@/trpc/server'
import type { Metadata } from 'next'

type Props = {
  params: Promise<{
    gameNumber: string
  }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const gameNumber = Number.parseInt((await params).gameNumber, 10)
  return {
    title: `Game Transcript #${gameNumber}`,
  }
}

export default async function TranscriptPage({ params }: Props) {
  const gameNumber = Number.parseInt((await params).gameNumber, 10)

  try {
    // Fetch transcript data server-side
    const transcriptContent = await api.history.getTranscript({
      gameNumber,
    })

    if (!transcriptContent) {
      return (
        <div className='flex h-screen w-screen items-center justify-center'>
          <p>Failed to load transcript. Please try again.</p>
        </div>
      )
    }

    // Return the transcript content directly as HTML
    return (
      <div
        className='transcript-container'
        dangerouslySetInnerHTML={{
          __html: transcriptContent.replace('calc(100% - 126px)', 'auto'),
        }}
      />
    )
  } catch (error) {
    return (
      <div className='flex h-screen w-screen items-center justify-center'>
        <p className='text-red-500'>
          Failed to load transcript: {(error as Error).message}
        </p>
      </div>
    )
  }
}
