'use client'

import { api } from '@/trpc/react'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function TranscriptPage() {
  const params = useParams()
  const gameNumber = Number.parseInt(params.gameNumber as string, 10)
  const [error, setError] = useState<string | null>(null)

  // Use the tRPC useQuery hook to fetch the transcript
  const { data: transcriptContent, isLoading } =
    api.history.getTranscript.useQuery(
      { gameNumber },
      {
        // Don't refetch on window focus
        refetchOnWindowFocus: false,
        onError: (err) => {
          setError(`Failed to load transcript: ${err.message}`)
        },
      }
    )

  // Use useEffect to set the document title
  useEffect(() => {
    document.title = `Game Transcript #${gameNumber}`
  }, [gameNumber])

  if (isLoading) {
    return (
      <div className='flex h-screen w-screen items-center justify-center'>
        <div className='text-center'>
          <div className='mb-2 h-6 w-6 animate-spin rounded-full border-gray-900 border-t-2 border-b-2'></div>
          <p>Loading transcript...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className='flex h-screen w-screen items-center justify-center'>
        <p className='text-red-500'>{error}</p>
      </div>
    )
  }

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
      dangerouslySetInnerHTML={{ __html: transcriptContent }}
    />
  )
}
