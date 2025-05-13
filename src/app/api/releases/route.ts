import { db } from '@/server/db'
import { releases } from '@/server/db/schema'

export async function GET() {
  const res = await db.select().from(releases)

  return Response.json(res)
}
