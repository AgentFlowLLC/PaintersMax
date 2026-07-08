import { z } from "zod";
import { router, publicProcedure, paidProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  listAllPosts,
  listPublishedPosts,
  getPostBySlug,
  getPostById,
  createPost,
  updatePost,
  deletePost,
  getPostImages,
  addPostImage,
  deletePostImage,
  getRelatedPosts,
} from "../services/blog";
import { storagePut } from "../storage";

export const blogRouter = router({
  /** Admin: list all posts (all statuses) */
  listAll: paidProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.user.id;
    return listAllPosts(tenantId);
  }),

  /** Public: list published posts */
  listPublished: publicProcedure.query(async () => {
    return listPublishedPosts();
  }),

  /** Public: get a single post by slug */
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const post = await getPostBySlug(input.slug);
      if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "Post not found" });
      return post;
    }),

  /** Admin: get a single post by ID */
  getById: paidProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const tenantId = ctx.user.id;
      const post = await getPostById(input.id, tenantId);
      if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "Post not found" });
      return post;
    }),

  /** Admin: create a new post */
  create: paidProcedure
    .input(
      z.object({
        title: z.string().min(1),
        content: z.string().optional(),
        excerpt: z.string().optional(),
        seoTitle: z.string().optional(),
        seoKeywords: z.string().optional(),
        seoDescription: z.string().optional(),
        featuredImageUrl: z.string().optional(),
        projectAddress: z.string().optional(),
        projectLatitude: z.string().optional(),
        projectLongitude: z.string().optional(),
        status: z.enum(["draft", "published", "archived"]).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.id;
      return createPost({ ...input, tenantId });
    }),

  /** Admin: update an existing post */
  update: paidProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().optional(),
        content: z.string().optional(),
        excerpt: z.string().optional(),
        seoTitle: z.string().optional(),
        seoKeywords: z.string().optional(),
        seoDescription: z.string().optional(),
        featuredImageUrl: z.string().optional(),
        projectAddress: z.string().optional(),
        projectLatitude: z.string().optional(),
        projectLongitude: z.string().optional(),
        status: z.enum(["draft", "published", "archived"]).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.id;
      const { id, ...data } = input;
      await updatePost(id, data, tenantId);
      return { success: true };
    }),

  /** Admin: delete a post */
  delete: paidProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.id;
      await deletePost(input.id, tenantId);
      return { success: true };
    }),

  /** Get images for a post (public) */
  getImages: publicProcedure
    .input(z.object({ postId: z.number() }))
    .query(async ({ input }) => {
      return getPostImages(input.postId);
    }),

  /** Admin: upload an image for a post */
  uploadImage: paidProcedure
    .input(
      z.object({
        postId: z.number(),
        imageBase64: z.string(),
        filename: z.string(),
        mimeType: z.string().default("image/jpeg"),
        caption: z.string().optional(),
        displayOrder: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.id;
      const buffer = Buffer.from(input.imageBase64, "base64");
      const suffix = Math.random().toString(36).substring(2, 10);
      const key = `blog/${input.postId}/${suffix}-${input.filename}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      const result = await addPostImage({
        postId: input.postId,
        imageUrl: url,
        caption: input.caption,
        displayOrder: input.displayOrder,
        tenantId,
      });
      return { id: result.id, imageUrl: url };
    }),

  /** Admin: delete a blog image */
  deleteImage: paidProcedure
    .input(z.object({ imageId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.id;
      await deletePostImage(input.imageId, tenantId);
      return { success: true };
    }),

  /** Public: get related posts */
  getRelated: publicProcedure
    .input(z.object({ postId: z.number() }))
    .query(async ({ input }) => {
      return getRelatedPosts(input.postId);
    }),

  /** Admin: upload featured image */
  uploadFeaturedImage: paidProcedure
    .input(
      z.object({
        imageBase64: z.string(),
        filename: z.string(),
        mimeType: z.string().default("image/jpeg"),
      })
    )
    .mutation(async ({ input }) => {
      const buffer = Buffer.from(input.imageBase64, "base64");
      const suffix = Math.random().toString(36).substring(2, 10);
      const key = `blog/featured/${suffix}-${input.filename}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      return { url };
    }),
});
