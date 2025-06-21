import { env } from '@/env'
import { Client } from 'minio'

// Create and configure the MinIO client
export const minioClient = new Client({
  endPoint: env.MINIO_ENDPOINT,
  useSSL: env.MINIO_USE_SSL === 'true',
  accessKey: env.MINIO_ACCESS_KEY,
  secretKey: env.MINIO_SECRET_KEY,
})

// Function to check if bucket exists and create it if it doesn't
export async function ensureBucketExists() {
  const bucketExists = await minioClient.bucketExists(env.MINIO_BUCKET_NAME)
  if (!bucketExists) {
    await minioClient.makeBucket(env.MINIO_BUCKET_NAME, 'us-east-1')
  }
}

// Function to upload a file to MinIO and return the URL
export async function uploadFile(
  file: Buffer,
  fileName: string,
  contentType: string
) {
  await ensureBucketExists()

  // Generate a unique object name to avoid collisions
  const objectName = `${Date.now()}-${fileName}`

  // Upload the file to MinIO
  await minioClient.putObject(
    env.MINIO_BUCKET_NAME,
    objectName,
    file,
    file.length,
    { 'Content-Type': contentType }
  )

  // Construct and return the URL to the uploaded file
  const protocol = env.MINIO_USE_SSL === 'true' ? 'https' : 'http'
  return `${protocol}://${env.MINIO_ENDPOINT}/${env.MINIO_BUCKET_NAME}/${objectName}`
}
