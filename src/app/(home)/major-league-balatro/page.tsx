import {TimeZoneProvider} from '@/components/timezone-provider'
import Link from 'next/link'
import {Competitors} from './_components/competitors'
import {HeroSection} from './_components/hero'
import {NextMatchInfo} from './_components/next-match-info'
import {Organizer} from './_components/organizer'
import {PrizePool} from './_components/prize-pool'
import {MlbSchedule} from './_components/schedule'
import {StayUpdated} from './_components/stay-updated'
import {TournamentFormat} from './_components/tournament-format'
import {matches} from './_constants/matches'

export default function MLBPage() {
  const currentDate = new Date()

  // Update the next match calculation to filter out completed matches
  const nextMatch = matches
    .filter((match) => !match.completed && match.datetime > currentDate)
    .sort((a, b) => a.datetime.getTime() - b.datetime.getTime())[0]

  return (
    <div className='flex min-h-screen flex-col'>
      <main className='flex-1'>
        <HeroSection/>
        {nextMatch && (
          <TimeZoneProvider>
            <NextMatchInfo nextMatch={nextMatch}/>
          </TimeZoneProvider>
        )}
        {/*<Standings />*/}

        <TournamentFormat/>

        <Competitors/>

        <MlbSchedule matches={matches}/>

        <PrizePool/>

        <Organizer/>

        <StayUpdated/>
      </main>

      <footer className='border-t py-6 md:py-0'>
        <div className='container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row'>
          <p className='text-center text-muted-foreground text-sm leading-loose md:text-left'>
            &copy; {new Date().getFullYear()} Major League Balatro. All rights
            reserved.
          </p>
          <div className='flex gap-4'>
            <Link
              href='/'
              className='text-muted-foreground text-sm underline-offset-4 hover:underline'
            >
              Balatro Multiplayer
            </Link>
            <Link
              href='/docs'
              className='text-muted-foreground text-sm underline-offset-4 hover:underline'
            >
              Documentation
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
