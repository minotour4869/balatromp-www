'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/trpc/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { MarkdownEditor } from '@/components/markdown-editor'
import { toast } from 'sonner'

export default function NewBlogPostPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [published, setPublished] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const createPost = api.blog.create.useMutation({
    onSuccess: () => {
      toast.success('Blog post created successfully')
      router.push('/admin/blog')
      router.refresh()
    },
    onError: (error) => {
      toast.error(`Error creating blog post: ${error.message}`)
      setIsSubmitting(false)
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title.trim()) {
      toast.error('Title is required')
      return
    }
    
    if (!content.trim()) {
      toast.error('Content is required')
      return
    }
    
    setIsSubmitting(true)
    
    createPost.mutate({
      title,
      content,
      excerpt: excerpt || undefined,
      published,
    })
  }

  return (
    <div className="container py-10">
      <h1 className="mb-8 text-4xl font-bold">Create New Blog Post</h1>
      
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter post title"
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="excerpt">Excerpt (optional)</Label>
          <Textarea
            id="excerpt"
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            placeholder="Brief summary of the post"
            className="h-24"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="content">Content</Label>
          <MarkdownEditor
            value={content}
            onChange={setContent}
            placeholder="Write your blog post content here..."
            minHeight="500px"
          />
        </div>
        
        <div className="flex items-center space-x-2">
          <Switch
            id="published"
            checked={published}
            onCheckedChange={setPublished}
          />
          <Label htmlFor="published">Publish immediately</Label>
        </div>
        
        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating...' : 'Create Post'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/admin/blog')}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}