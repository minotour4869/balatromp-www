import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import { auth } from '@/server/auth'
import { api } from '@/trpc/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function AdminBlogPage() {
  const session = await auth()

  // Redirect if not authenticated or not an admin
  if (!session?.user || session.user.role !== 'admin') {
    redirect('/')
  }

  const posts = await api.blog.getAll()

  return (
    <div className='container py-10'>
      <div className='mb-8 flex items-center justify-between'>
        <h1 className='font-bold text-4xl'>Manage Blog Posts</h1>
        <Button asChild>
          <Link href='/admin/blog/new'>Create New Post</Link>
        </Button>
      </div>

      {posts.length === 0 ? (
        <p className='text-muted-foreground'>
          No blog posts yet. Create your first post!
        </p>
      ) : (
        <div className='rounded-md border'>
          <table className='w-full'>
            <thead>
              <tr className='border-b bg-muted/50'>
                <th className='p-4 text-left font-medium'>Title</th>
                <th className='p-4 text-left font-medium'>Author</th>
                <th className='p-4 text-left font-medium'>Date</th>
                <th className='p-4 text-left font-medium'>Status</th>
                <th className='p-4 text-left font-medium'>Actions</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.id} className='border-b'>
                  <td className='p-4'>
                    <Link
                      href={`/blog/${post.slug}`}
                      className='font-medium hover:underline'
                    >
                      {post.title}
                    </Link>
                  </td>
                  <td className='p-4'>{post.author?.name || 'Anonymous'}</td>
                  <td className='p-4'>{formatDate(post.createdAt)}</td>
                  <td className='p-4'>
                    <span
                      className={`inline-flex rounded-full px-2 py-1 font-medium text-xs ${post.published ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}
                    >
                      {post.published ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td className='p-4'>
                    <div className='flex gap-2'>
                      <Button variant='outline' size='sm' asChild>
                        <Link href={`/admin/blog/edit/${post.id}`}>Edit</Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
