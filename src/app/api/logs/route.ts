import { auth } from '@/server/auth'
import { db } from '@/server/db'
import { logFiles, users } from '@/server/db/schema'
import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    // Get the log file ID from the request
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    // Check if user is authenticated
    const session = await auth()

    if (id) {
      // Fetching a specific log file by ID
      // For specific log files, we allow access to the owner or admins
      const logFile = await db
        .select({
          id: logFiles.id,
          fileName: logFiles.fileName,
          fileUrl: logFiles.fileUrl,
          parsedJson: logFiles.parsedJson,
          createdAt: logFiles.createdAt,
          userId: logFiles.userId,
        })
        .from(logFiles)
        .where(eq(logFiles.id, Number.parseInt(id)))
        .limit(1)

      if (logFile.length === 0) {
        return NextResponse.json(
          { error: 'Log file not found' },
          { status: 404 }
        )
      }

      // Check if user is authorized to access this log file
      // Allow access if user is admin or the owner of the log file
      if (
        !session ||
        (session.user.role !== 'admin' &&
          logFile?.[0]?.userId !== session.user.id)
      ) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      return NextResponse.json(logFile[0])
    }
    // Fetching all log files (admin only)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all log files with user information
    const logs = await db
      .select({
        id: logFiles.id,
        fileName: logFiles.fileName,
        fileUrl: logFiles.fileUrl,
        createdAt: logFiles.createdAt,
        userId: logFiles.userId,
        userName: users.name,
        userEmail: users.email,
      })
      .from(logFiles)
      .leftJoin(users, eq(logFiles.userId, users.id))
      .orderBy(logFiles.createdAt)

    return NextResponse.json(logs)
  } catch (error) {
    console.error('Error fetching log files:', error)
    return NextResponse.json(
      { error: 'Failed to fetch log files' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    // Check if user is authenticated and is an admin
    const session = await auth()
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the log file ID from the request
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Log file ID is required' },
        { status: 400 }
      )
    }

    // Delete the log file from the database
    await db.delete(logFiles).where(eq(logFiles.id, Number.parseInt(id)))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting log file:', error)
    return NextResponse.json(
      { error: 'Failed to delete log file' },
      { status: 500 }
    )
  }
}
