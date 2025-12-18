'use client'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'

type LogFile = {
  id: number
  fileName: string
  fileUrl: string
  createdAt: string
  userId: string | null
  userName: string | null
  userEmail: string | null
}

export function LogsClient() {
  const [logs, setLogs] = useState<LogFile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  const fetchLogs = async () => {
    try {
      const response = await fetch('/api/logs')
      if (!response.ok) {
        throw new Error('Failed to fetch logs')
      }
      const data = await response.json()
      // Sort logs by creation time
      const sortedLogs = data.sort((a: LogFile, b: LogFile) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      setLogs(sortedLogs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [])

  const handleViewInParser = (id: number) => {
    // Navigate to the log parser page with the log ID as a query parameter
    router.push(`/log-parser?logId=${id}`)
  }

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this log file?')) {
      setIsDeleting(true)
      try {
        const response = await fetch(`/api/logs?id=${id}`, {
          method: 'DELETE',
        })

        if (!response.ok) {
          throw new Error('Failed to delete log file')
        }

        // Refresh the logs list
        await fetchLogs()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred while deleting')
      } finally {
        setIsDeleting(false)
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Log Files</CardTitle>
        <CardDescription>
          View and manage uploaded log files
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p>Loading logs...</p>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : logs.length === 0 ? (
          <p>No logs found</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File Name</TableHead>
                <TableHead>Uploaded By</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{log.fileName}</TableCell>
                  <TableCell>
                    {log.userName || log.userEmail || 'Anonymous'}
                  </TableCell>
                  <TableCell>
                    {new Date(log.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleViewInParser(log.id)}
                    >
                      View in Parser
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => handleDelete(log.id)}
                      disabled={isDeleting}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
