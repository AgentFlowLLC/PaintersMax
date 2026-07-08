import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
  seedDefaultTemplates: vi.fn().mockResolvedValue(undefined),
}));

// Mock stripeWebhook
vi.mock("./routes/stripeWebhook", () => ({
  registerStripeWebhook: vi.fn(),
}));

// Mock storage
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://cdn.example.com/test.jpg", key: "test.jpg" }),
}));

import { appRouter } from "./routers";

function createCaller(user?: { id: number; name: string; openId: string; role: string }) {
  return appRouter.createCaller({
    user: user ?? null,
    req: {} as any,
    res: { clearCookie: vi.fn() } as any,
  });
}

describe("blog router", () => {
  const adminUser = { id: 1, name: "Admin", openId: "admin-1", role: "admin", subscriptionStatus: "active" };

  describe("listPublished", () => {
    it("returns empty array when db is unavailable", async () => {
      const caller = createCaller();
      const result = await caller.blog.listPublished();
      expect(result).toEqual([]);
    });
  });

  describe("listAll", () => {
    it("requires authentication", async () => {
      const caller = createCaller();
      await expect(caller.blog.listAll()).rejects.toThrow();
    });

    it("returns empty array when db is unavailable (authenticated)", async () => {
      const caller = createCaller(adminUser);
      const result = await caller.blog.listAll();
      expect(result).toEqual([]);
    });
  });

  describe("getBySlug", () => {
    it("throws NOT_FOUND when post does not exist", async () => {
      const caller = createCaller();
      await expect(caller.blog.getBySlug({ slug: "nonexistent" })).rejects.toThrow("Post not found");
    });
  });

  describe("getById", () => {
    it("requires authentication", async () => {
      const caller = createCaller();
      await expect(caller.blog.getById({ id: 1 })).rejects.toThrow();
    });

    it("throws NOT_FOUND when post does not exist (authenticated)", async () => {
      const caller = createCaller(adminUser);
      await expect(caller.blog.getById({ id: 999 })).rejects.toThrow("Post not found");
    });
  });

  describe("create", () => {
    it("requires authentication", async () => {
      const caller = createCaller();
      await expect(caller.blog.create({ title: "Test" })).rejects.toThrow();
    });

    it("throws when db is unavailable", async () => {
      const caller = createCaller(adminUser);
      await expect(caller.blog.create({ title: "Test Post" })).rejects.toThrow("Database not available");
    });

    it("validates title is required", async () => {
      const caller = createCaller(adminUser);
      await expect(caller.blog.create({ title: "" })).rejects.toThrow();
    });
  });

  describe("update", () => {
    it("requires authentication", async () => {
      const caller = createCaller();
      await expect(caller.blog.update({ id: 1, title: "Updated" })).rejects.toThrow();
    });
  });

  describe("delete", () => {
    it("requires authentication", async () => {
      const caller = createCaller();
      await expect(caller.blog.delete({ id: 1 })).rejects.toThrow();
    });

    it("throws when db is unavailable", async () => {
      const caller = createCaller(adminUser);
      await expect(caller.blog.delete({ id: 1 })).rejects.toThrow("Database not available");
    });
  });

  describe("getImages", () => {
    it("returns empty array when db is unavailable", async () => {
      const caller = createCaller();
      const result = await caller.blog.getImages({ postId: 1 });
      expect(result).toEqual([]);
    });
  });

  describe("getRelated", () => {
    it("returns empty array when db is unavailable", async () => {
      const caller = createCaller();
      const result = await caller.blog.getRelated({ postId: 1 });
      expect(result).toEqual([]);
    });
  });

  describe("uploadFeaturedImage", () => {
    it("requires authentication", async () => {
      const caller = createCaller();
      await expect(
        caller.blog.uploadFeaturedImage({
          imageBase64: "dGVzdA==",
          filename: "test.jpg",
          mimeType: "image/jpeg",
        })
      ).rejects.toThrow();
    });
  });

  describe("uploadImage", () => {
    it("requires authentication", async () => {
      const caller = createCaller();
      await expect(
        caller.blog.uploadImage({
          postId: 1,
          imageBase64: "dGVzdA==",
          filename: "test.jpg",
          mimeType: "image/jpeg",
        })
      ).rejects.toThrow();
    });
  });

  describe("deleteImage", () => {
    it("requires authentication", async () => {
      const caller = createCaller();
      await expect(caller.blog.deleteImage({ imageId: 1 })).rejects.toThrow();
    });
  });
});

describe("blog service - slugify", () => {
  it("generates URL-friendly slugs", async () => {
    const { slugify } = await import("./services/blog");
    expect(slugify("Hello World")).toBe("hello-world");
    expect(slugify("My Amazing Project!")).toBe("my-amazing-project");
    expect(slugify("  Spaces & Special #Chars  ")).toBe("spaces-special-chars");
    expect(slugify("123 Number Start")).toBe("123-number-start");
  });
});
