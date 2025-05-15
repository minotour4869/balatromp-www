import { ExternalLink } from 'lucide-react'
import Link from 'next/link'

export default async function SupportUsPage() {
  return (
    <div className={'container mx-auto pt-8'}>
      <div className={'prose'}>
        <h1>Support us</h1>
        <p>
          <Link
            target={'_blank'}
            rel={'noopener noreferrer'}
            href={'https://ko-fi.com/virtualized/shop'}
            className={'flex items-center gap-1'}
          >
            Support Multiplayer Mod development{' '}
            <ExternalLink className={'size-4'} />
          </Link>
        </p>
        <p>
          <Link
            target={'_blank'}
            rel={'noopener noreferrer'}
            href={'https://ko-fi.com/andy_balatro'}
            className={'flex items-center gap-1'}
          >
            Support the development of this website{' '}
            <ExternalLink className={'size-4'} />
          </Link>
        </p>
      </div>
    </div>
  )
}
