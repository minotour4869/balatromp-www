'use client'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { api } from '@/trpc/react'
import { useState } from 'react'
import { BarChart, CartesianGrid, XAxis, YAxis, Bar } from 'recharts'

const chartConfig = {
  count: {
    label: 'Games',
    color: 'var(--color-violet-500)',
  },
} satisfies ChartConfig

type GroupByOption = 'hour' | 'day' | 'week' | 'month'

export function GamesPerHourChart() {
  const [groupBy, setGroupBy] = useState<GroupByOption>('hour')

  // Fetch games data with the selected grouping
  const [gamesData] = api.history.games_per_hour.useSuspenseQuery({
    groupBy,
  })

  // Format the title and description based on the grouping
  const getTitleText = () => {
    switch (groupBy) {
      case 'hour':
        return 'Games Played Per Hour'
      case 'day':
        return 'Games Played Per Day'
      case 'week':
        return 'Games Played Per Week'
      case 'month':
        return 'Games Played Per Month'
      default:
        return 'Games Played'
    }
  }

  // Format the X-axis labels based on the grouping
  const formatXAxisTick = (value: string) => {
    const date = new Date(value)

    switch (groupBy) {
      case 'hour':
        return `${date.toLocaleDateString()} ${date.getHours()}:00`
      case 'day':
        return date.toLocaleDateString()
      case 'week':
        return value // Already formatted as "Week of YYYY-MM-DD"
      case 'month':
        return `${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`
      default:
        return value
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{getTitleText()}</CardTitle>
          <CardDescription>Number of games played over time</CardDescription>
        </div>
        <Select value={groupBy} onValueChange={(value) => setGroupBy(value as GroupByOption)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select grouping" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hour">Group by Hour</SelectItem>
            <SelectItem value="day">Group by Day</SelectItem>
            <SelectItem value="week">Group by Week</SelectItem>
            <SelectItem value="month">Group by Month</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="w-full h-[500px] p-2">
        <ChartContainer config={chartConfig} className="w-full h-full">
          <BarChart
            data={gamesData}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 60,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="timeUnit"
              angle={-45}
              textAnchor="end"
              height={60}
              tickFormatter={formatXAxisTick}
            />
            <YAxis />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => `${value} games`}
                />
              }
            />
            <Bar dataKey="count" fill="var(--color-count)" />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
