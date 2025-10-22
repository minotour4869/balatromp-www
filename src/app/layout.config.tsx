import type { LinkItemType } from 'fumadocs-ui/layouts/links'
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared'
import {
  BarChart3,
  BookOpen,
  CircleDollarSign,
  Rss,
  Trophy,
  Upload,
} from 'lucide-react'
import { Header } from './_components/header'

const links = [
  {
    text: 'Documentation',
    url: '/docs',
    icon: <BookOpen />,
  },
  {
    text: 'Leaderboards',
    url: '/leaderboards',
    icon: <Trophy />,
  },
  {
    text: 'Blog',
    url: '/blog',
    icon: <Rss />,
  },
  {
    text: 'Support Us',
    url: '/support-us',
    icon: <CircleDollarSign />,
  },
  {
    text: 'Tools',
    type: 'menu',
    items: [
      {
        text: 'Fix Corrupted Profile',
        url: '/profile-fix',
        icon: <Upload />,
      },
      {
        text: 'Log Parser',
        url: '/log-parser',
        icon: <Upload />,
      },
      {
        text: 'Games Per Hour',
        url: '/games-per-hour',
        icon: <BarChart3 />,
      },
    ],
  },

  // {
  //   text: 'Credits',
  //   url: '/credits',
  //   icon: <Award />,
  // },
] satisfies LinkItemType[]
const nav = {
  title: (
    <div className='flex items-center space-x-2'>
      <img src={'/logo.png'} alt={'Balatro Multiplayer'} className={'size-8'} />
      <span className='inline-block font-bold'>Balatro Multiplayer</span>
    </div>
  ),
}
export const baseOptions: BaseLayoutProps = {
  links,
  nav: {
    ...nav,
    component: <Header finalLinks={links} nav={nav} />,
  },
}
