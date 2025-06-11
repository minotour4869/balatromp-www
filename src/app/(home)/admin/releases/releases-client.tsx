'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/trpc/react'
import { Pencil, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

export function ReleasesClient() {
  const utils = api.useUtils()
  const [releases] = api.releases.getReleases.useSuspenseQuery()
  const addRelease = api.releases.addRelease.useMutation({
    onSuccess: () => {
      utils.releases.getReleases.invalidate()
      toast.success('Release added successfully')
      form.reset()
    },
    onError: (error) => {
      toast.error(`Error adding release: ${error.message}`)
    },
  })
  const updateRelease = api.releases.updateRelease.useMutation({
    onSuccess: () => {
      utils.releases.getReleases.invalidate()
      toast.success('Release updated successfully')
      setEditDialogOpen(false)
    },
    onError: (error) => {
      toast.error(`Error updating release: ${error.message}`)
    },
  })
  const deleteRelease = api.releases.deleteRelease.useMutation({
    onSuccess: () => {
      utils.releases.getReleases.invalidate()
      toast.success('Release deleted successfully')
      setDeleteDialogOpen(false)
    },
    onError: (error) => {
      toast.error(`Error deleting release: ${error.message}`)
    },
  })

  const [smodsVersions, setSmodsVersions] = useState<string[]>(['latest'])
  const [lovelyVersions, setLovelyVersions] = useState<string[]>(['latest'])
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedRelease, setSelectedRelease] = useState<
    (typeof releases)[0] | null
  >(null)

  const SMODS_RELEASES_URL =
    'https://api.github.com/repos/Steamodded/smods/releases'
  const LOVELY_RELEASES_BASE_URL =
    'https://github.com/ethangreen-dev/lovely-injector/releases'

  useEffect(() => {
    // Fetch Steamodded versions
    fetch(SMODS_RELEASES_URL)
      .then((response) => response.json())
      .then((data) => {
        const versions = data.map((release: any) => release.tag_name)
        setSmodsVersions(['latest', ...versions])
      })
      .catch((error) => {
        console.error('Error fetching Steamodded versions:', error)
      })

    // Fetch lovely injector versions
    // Since we don't have a direct API for lovely injector, we'll use GitHub API
    fetch(
      'https://api.github.com/repos/ethangreen-dev/lovely-injector/releases'
    )
      .then((response) => response.json())
      .then((data) => {
        const versions = data.map((release: any) => release.tag_name)
        setLovelyVersions(['latest', ...versions])
      })
      .catch((error) => {
        console.error('Error fetching lovely injector versions:', error)
      })
  }, [])

  const form = useForm({
    defaultValues: {
      name: '',
      version: '',
      description: '',
      url: '',
      smods_version: 'latest',
      lovely_version: 'latest',
    },
  })

  const editForm = useForm({
    defaultValues: {
      id: 0,
      name: '',
      version: '',
      description: '',
      url: '',
      smods_version: 'latest',
      lovely_version: 'latest',
    },
  })

  const handleEditRelease = (release: (typeof releases)[0]) => {
    setSelectedRelease(release)
    editForm.reset({
      id: release.id,
      name: release.name,
      version: release.version,
      description: release.description || '',
      url: release.url,
      smods_version: release.smods_version || 'latest',
      lovely_version: release.lovely_version || 'latest',
    })
    setEditDialogOpen(true)
  }

  const handleDeleteRelease = (release: (typeof releases)[0]) => {
    setSelectedRelease(release)
    setDeleteDialogOpen(true)
  }
  return (
    <div className='space-y-8'>
      <h1 className='font-bold text-3xl'>Releases</h1>
      <div className='overflow-hidden rounded-md border shadow-sm'>
        <Table className='w-full table-auto'>
          <TableHeader>
            <TableRow className='bg-muted/50'>
              <TableHead>Name</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>Steamodded Version</TableHead>
              <TableHead>Lovely Injector Version</TableHead>
              <TableHead className='text-right'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {releases.map((release) => (
              <TableRow key={release.id} className='hover:bg-muted/50'>
                <TableCell className='font-medium'>{release.name}</TableCell>
                <TableCell>{release.version}</TableCell>
                <TableCell className='max-w-xs'>
                  <div className='truncate' title={release.description || ''}>
                    {release.description}
                  </div>
                </TableCell>
                <TableCell className='max-w-xs'>
                  <a
                    href={release.url}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='text-blue-500 hover:underline'
                    title={release.url}
                  >
                    <div className='truncate'>{release.url}</div>
                  </a>
                </TableCell>
                <TableCell>{release.smods_version || 'latest'}</TableCell>
                <TableCell>{release.lovely_version || 'latest'}</TableCell>
                <TableCell className='space-x-2 text-right'>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => handleEditRelease(release)}
                    className='inline-flex items-center'
                  >
                    <Pencil className='mr-1 h-4 w-4' />
                    Edit
                  </Button>
                  <Button
                    variant='destructive'
                    size='sm'
                    onClick={() => handleDeleteRelease(release)}
                    className='inline-flex items-center text-white'
                  >
                    <Trash2 className='mr-1 h-4 w-4' />
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className='mt-8 overflow-hidden rounded-md border bg-card shadow-sm'>
        <div className='p-6'>
          <h2 className='mb-4 font-semibold text-2xl'>Add New Release</h2>
          <form
            className='space-y-4'
            onSubmit={form.handleSubmit((values) => addRelease.mutate(values))}
          >
            <div className='grid grid-cols-1 gap-2'>
              <Label htmlFor='name'>Title</Label>
              <Input id='name' {...form.register('name')} />
            </div>
            <div className='grid grid-cols-1 gap-2'>
              <Label htmlFor='version'>Version</Label>
              <Input id='version' {...form.register('version')} />
            </div>
            <div className='grid grid-cols-1 gap-2'>
              <Label htmlFor='description'>Description</Label>
              <Textarea id='description' {...form.register('description')} />
            </div>
            <div className='grid grid-cols-1 gap-2'>
              <Label htmlFor='url'>URL</Label>
              <Input id='url' {...form.register('url')} />
            </div>
            <div className='grid grid-cols-2 gap-4'>
              <div className='grid grid-cols-1 gap-2'>
                <Label htmlFor='smods_version'>Steamodded Version</Label>
                <Select
                  defaultValue='latest'
                  onValueChange={(value) =>
                    form.setValue('smods_version', value)
                  }
                >
                  <SelectTrigger id='smods_version'>
                    <SelectValue placeholder='Select Steamodded version' />
                  </SelectTrigger>
                  <SelectContent>
                    {smodsVersions.map((version) => (
                      <SelectItem key={version} value={version}>
                        {version}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='grid grid-cols-1 gap-2'>
                <Label htmlFor='lovely_version'>Lovely Injector Version</Label>
                <Select
                  defaultValue='latest'
                  onValueChange={(value) =>
                    form.setValue('lovely_version', value)
                  }
                >
                  <SelectTrigger id='lovely_version'>
                    <SelectValue placeholder='Select Lovely Injector version' />
                  </SelectTrigger>
                  <SelectContent>
                    {lovelyVersions.map((version) => (
                      <SelectItem key={version} value={version}>
                        {version}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type='submit' className='w-full'>
              Add new release
            </Button>
          </form>
        </div>
      </div>

      {/* Edit Release Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className='sm:max-w-[600px]'>
          <DialogHeader>
            <DialogTitle>Edit Release</DialogTitle>
            <DialogDescription>
              Make changes to the release. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={editForm.handleSubmit((values) =>
              updateRelease.mutate(values)
            )}
          >
            <div className='grid gap-4 py-4'>
              <div className='grid grid-cols-1 gap-2'>
                <Label htmlFor='edit-name'>Title</Label>
                <Input id='edit-name' {...editForm.register('name')} />
              </div>
              <div className='grid grid-cols-1 gap-2'>
                <Label htmlFor='edit-version'>Version</Label>
                <Input id='edit-version' {...editForm.register('version')} />
              </div>
              <div className='grid grid-cols-1 gap-2'>
                <Label htmlFor='edit-description'>Description</Label>
                <Textarea
                  id='edit-description'
                  {...editForm.register('description')}
                />
              </div>
              <div className='grid grid-cols-1 gap-2'>
                <Label htmlFor='edit-url'>URL</Label>
                <Input id='edit-url' {...editForm.register('url')} />
              </div>
              <div className='grid grid-cols-2 gap-4'>
                <div className='grid grid-cols-1 gap-2'>
                  <Label htmlFor='edit-smods_version'>Steamodded Version</Label>
                  <Select
                    value={editForm.watch('smods_version')}
                    onValueChange={(value) =>
                      editForm.setValue('smods_version', value)
                    }
                  >
                    <SelectTrigger id='edit-smods_version'>
                      <SelectValue placeholder='Select Steamodded version' />
                    </SelectTrigger>
                    <SelectContent>
                      {smodsVersions.map((version) => (
                        <SelectItem key={version} value={version}>
                          {version}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className='grid grid-cols-1 gap-2'>
                  <Label htmlFor='edit-lovely_version'>
                    Lovely Injector Version
                  </Label>
                  <Select
                    value={editForm.watch('lovely_version')}
                    onValueChange={(value) =>
                      editForm.setValue('lovely_version', value)
                    }
                  >
                    <SelectTrigger id='edit-lovely_version'>
                      <SelectValue placeholder='Select Lovely Injector version' />
                    </SelectTrigger>
                    <SelectContent>
                      {lovelyVersions.map((version) => (
                        <SelectItem key={version} value={version}>
                          {version}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => setEditDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type='submit'>Save changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              release
              {selectedRelease && <strong> "{selectedRelease.name}"</strong>}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className='bg-red-600 text-white hover:bg-red-700'
              onClick={() =>
                selectedRelease &&
                deleteRelease.mutate({ id: selectedRelease.id })
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
