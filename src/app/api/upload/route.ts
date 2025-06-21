import { auth } from '@/server/auth'
import { uploadFile } from '@/server/minio'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    // Check if user is authenticated and is an admin
    const session = await auth()
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse the multipart form data
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Check if the file is a zip file
    if (!file.name.endsWith('.zip')) {
      return NextResponse.json(
        { error: 'Only zip files are allowed' },
        { status: 400 }
      )
    }

    // Convert the file to a buffer
    const buffer = Buffer.from(await file.arrayBuffer())

    // Upload the file to MinIO
    const fileUrl = await uploadFile(buffer, file.name, file.type)

    // Return the URL of the uploaded file
    return NextResponse.json({ url: fileUrl })
  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    )
  }
}