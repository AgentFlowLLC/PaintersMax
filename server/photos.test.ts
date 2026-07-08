/**
 * photos.test.ts — Vitest unit tests for the photos tRPC router
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock the photos service ──────────────────────────────────────────────────
vi.mock("./services/photos", () => ({
  uploadPhoto: vi.fn().mockResolvedValue({
    id: 1,
    leadId: 42,
    photoUrl: "https://cdn.example.com/job-photos/42/before/abc123.jpg",
    photoKey: "job-photos/42/before/abc123.jpg",
    type: "before",
    caption: null,
    uploadedBy: 1,
    uploadedAt: new Date("2026-01-01"),
  }),
  listPhotos: vi.fn().mockResolvedValue([
    {
      id: 1,
      leadId: 42,
      photoUrl: "https://cdn.example.com/job-photos/42/before/abc123.jpg",
      photoKey: "job-photos/42/before/abc123.jpg",
      type: "before",
      caption: null,
      uploadedBy: 1,
      uploadedAt: new Date("2026-01-01"),
    },
  ]),
  deletePhoto: vi.fn().mockResolvedValue({ success: true }),
  getPhotosByLead: vi.fn().mockResolvedValue({
    before: [
      {
        id: 1,
        leadId: 42,
        photoUrl: "https://cdn.example.com/job-photos/42/before/abc123.jpg",
        photoKey: "job-photos/42/before/abc123.jpg",
        type: "before",
        caption: null,
        uploadedBy: 1,
        uploadedAt: new Date("2026-01-01"),
      },
    ],
    after: [
      {
        id: 2,
        leadId: 42,
        photoUrl: "https://cdn.example.com/job-photos/42/after/def456.jpg",
        photoKey: "job-photos/42/after/def456.jpg",
        type: "after",
        caption: "Finished result",
        uploadedBy: 1,
        uploadedAt: new Date("2026-01-02"),
      },
    ],
  }),
}));

// ─── Mock db helpers ──────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  seedDefaultTemplates: vi.fn().mockResolvedValue(undefined),
}));

// ─── Mock storage ─────────────────────────────────────────────────────────────
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ key: "test-key", url: "https://cdn.example.com/test.jpg" }),
  storageGet: vi.fn().mockResolvedValue({ key: "test-key", url: "https://cdn.example.com/test.jpg" }),
}));

// ─── Test context helpers ─────────────────────────────────────────────────────
function makeAuthCtx(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      subscriptionStatus: "active",
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function makePublicCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("photos router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("photos.byLead returns grouped before/after photos for authenticated user", async () => {
    const caller = appRouter.createCaller(makeAuthCtx());
    const result = await caller.photos.byLead({ leadId: 42 });

    expect(result).toHaveProperty("before");
    expect(result).toHaveProperty("after");
    expect(result.before).toHaveLength(1);
    expect(result.after).toHaveLength(1);
    expect(result.before[0].type).toBe("before");
    expect(result.after[0].type).toBe("after");
  });

  it("photos.list returns photos for a lead", async () => {
    const caller = appRouter.createCaller(makeAuthCtx());
    const result = await caller.photos.list({ leadId: 42 });

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0].leadId).toBe(42);
  });

  it("photos.list with type filter passes type to service", async () => {
    const { listPhotos } = await import("./services/photos");
    const caller = appRouter.createCaller(makeAuthCtx());
    await caller.photos.list({ leadId: 42, type: "before" });

    expect(listPhotos).toHaveBeenCalledWith(42, "before", 1);
  });

  it("photos.upload calls uploadPhoto with correct params", async () => {
    const { uploadPhoto } = await import("./services/photos");
    const caller = appRouter.createCaller(makeAuthCtx());

    // Create a small valid base64 JPEG stub (1x1 white pixel)
    const base64Stub = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k=";

    const result = await caller.photos.upload({
      leadId: 42,
      type: "before",
      base64Data: base64Stub,
      mimeType: "image/jpeg",
      originalName: "test.jpg",
      caption: "Test caption",
    });

    expect(result.success).toBe(true);
    expect(result.photo).toBeDefined();
    expect(uploadPhoto).toHaveBeenCalledWith(
      expect.objectContaining({
        leadId: 42,
        type: "before",
        mimeType: "image/jpeg",
        originalName: "test.jpg",
        caption: "Test caption",
        uploadedBy: 1,
      })
    );
  });

  it("photos.delete calls deletePhoto with correct id", async () => {
    const { deletePhoto } = await import("./services/photos");
    const caller = appRouter.createCaller(makeAuthCtx());

    const result = await caller.photos.delete({ photoId: 1 });
    expect(result.success).toBe(true);
    expect(deletePhoto).toHaveBeenCalledWith(1, 1);
  });

  it("photos.delete throws NOT_FOUND when photo does not exist", async () => {
    const { deletePhoto } = await import("./services/photos");
    (deletePhoto as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: false });

    const caller = appRouter.createCaller(makeAuthCtx());
    await expect(caller.photos.delete({ photoId: 999 })).rejects.toThrow();
  });

  it("photos.byLeadPublic is accessible without authentication", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.photos.byLeadPublic({ leadId: 42, token: "test-token-abc" });

    expect(result).toHaveProperty("before");
    expect(result).toHaveProperty("after");
  });

  it("photos.byLead requires authentication", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    await expect(caller.photos.byLead({ leadId: 42 })).rejects.toThrow();
  });
});
