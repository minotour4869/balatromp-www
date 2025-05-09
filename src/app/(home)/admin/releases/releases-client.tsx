'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api } from '@/trpc/react'
import { useForm } from 'react-hook-form'
export function ReleasesClient() {
  const [releases] = api.releases.getReleases.useSuspenseQuery()
  const addRelease = api.releases.addRelease.useMutation()
  const form = useForm({
    defaultValues: {
      name: '',
      version: '',
      description: '',
      url: '',
    },
  })
  return (
    <div>
      <h1 className={'text-2xl'}>Releases</h1>
      <div className={'mt-4'}>
        <Table className={'w-full table-auto'}>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>URL</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {releases.map((release) => (
              <TableRow key={release.id}>
                <TableCell>{release.name}</TableCell>
                <TableCell>{release.version}</TableCell>
                <TableCell>{release.description}</TableCell>
                <TableCell>
                  <a
                    href={release.url}
                    target={'_blank'}
                    rel={'noopener noreferrer'}
                    className={'hover:underline'}
                  >
                    {release.url}
                  </a>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Card className={'mt-8 max-w-xl'}>
        <CardContent>
          <form
            className={'space-y-4'}
            onSubmit={form.handleSubmit((values) => addRelease.mutate(values))}
          >
            <div className={'grid grid-cols-1 gap-2'}>
              <Label>Title</Label>
              <Input {...form.register('name')} />
            </div>
            <div className={'grid grid-cols-1 gap-2'}>
              <Label>Version</Label>
              <Input {...form.register('version')} />
            </div>
            <div className={'grid grid-cols-1 gap-2'}>
              <Label>Description</Label>
              <Input {...form.register('description')} />
            </div>
            <div className={'grid grid-cols-1 gap-2'}>
              <Label>URL</Label>
              <Input {...form.register('url')} />
            </div>
            <Button type={'submit'}>Add new release</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
