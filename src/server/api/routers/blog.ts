import {
  adminProcedure,
  createTRPCRouter,
  publicProcedure,
} from '@/server/api/trpc'
import { db } from '@/server/db'
import { blogPosts } from '@/server/db/schema'
import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

// Helper function to generate a slug from a title
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with a single hyphen
    .trim()
}

export const blogRouter = createTRPCRouter({
  // Get all published blog posts (public)
  getAllPublished: publicProcedure.query(async () => {
    const posts = await db.query.blogPosts.findMany({
      where: eq(blogPosts.published, true),
      orderBy: (blogPosts, { desc }) => [desc(blogPosts.createdAt)],
      with: {
        author: {
          columns: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    })
    return posts
  }),

  // Get a single blog post by slug (public)
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const post = await db.query.blogPosts.findFirst({
        where: eq(blogPosts.slug, input.slug),
        with: {
          author: {
            columns: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      })

      if (!post || !post.published) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Blog post not found',
        })
      }

      return post
    }),

  // Get all blog posts (admin only)
  getAll: adminProcedure.query(async () => {
    const posts = await db.query.blogPosts.findMany({
      orderBy: (blogPosts, { desc }) => [desc(blogPosts.createdAt)],
      with: {
        author: {
          columns: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    })
    return posts
  }),

  // Create a new blog post (admin only)
  create: adminProcedure
    .input(
      z.object({
        title: z.string().min(1),
        content: z.string().min(1),
        excerpt: z.string().optional(),
        published: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const slug = generateSlug(input.title)

      // Check if slug already exists
      const existingPost = await db.query.blogPosts.findFirst({
        where: eq(blogPosts.slug, slug),
      })

      if (existingPost) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'A post with a similar title already exists',
        })
      }

      const post = await db
        .insert(blogPosts)
        .values({
          title: input.title,
          slug,
          content: input.content,
          excerpt: input.excerpt || null,
          published: input.published,
          authorId: ctx.session.user.id,
        })
        .returning()

      return post[0]
    }),

  // Update a blog post (admin only)
  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1),
        content: z.string().min(1),
        excerpt: z.string().optional(),
        published: z.boolean(),
        updateSlug: z.boolean().default(false),
      })
    )
    .mutation(async ({ input }) => {
      const post = await db.query.blogPosts.findFirst({
        where: eq(blogPosts.id, input.id),
      })

      if (!post) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Blog post not found',
        })
      }

      let slug = post.slug
      if (input.updateSlug) {
        slug = generateSlug(input.title)

        // Check if new slug already exists (and it's not the current post)
        const existingPost = await db.query.blogPosts.findFirst({
          where: eq(blogPosts.slug, slug),
        })

        if (existingPost && existingPost.id !== input.id) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'A post with a similar title already exists',
          })
        }
      }

      const updatedPost = await db
        .update(blogPosts)
        .set({
          title: input.title,
          slug,
          content: input.content,
          excerpt: input.excerpt || null,
          published: input.published,
        })
        .where(eq(blogPosts.id, input.id))
        .returning()

      return updatedPost[0]
    }),

  // Delete a blog post (admin only)
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const post = await db.query.blogPosts.findFirst({
        where: eq(blogPosts.id, input.id),
      })

      if (!post) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Blog post not found',
        })
      }

      await db.delete(blogPosts).where(eq(blogPosts.id, input.id))

      return { success: true }
    }),
})
