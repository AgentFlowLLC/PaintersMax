/**
 * crew.test.ts — Vitest tests for the crew tRPC router
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  getDb: vi.fn(),
  seedDefaultTemplates: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./routes/stripeWebhook", () => ({
  registerStripeWebhook: vi.fn(),
}));

vi.mock("./services/crew", () => ({
  listCrewMembers: vi.fn(),
  getCrewMember: vi.fn(),
  createCrewMember: vi.fn(),
  updateCrewMember: vi.fn(),
  deactivateCrewMember: vi.fn(),
  reactivateCrewMember: vi.fn(),
}));

import {
  listCrewMembers,
  getCrewMember,
  createCrewMember,
  updateCrewMember,
  deactivateCrewMember,
  reactivateCrewMember,
} from "./services/crew";

const MOCK_USER = {
  id: 1,
  openId: "test-open-id",
  name: "Test User",
  email: "test@example.com",
  role: "admin" as const,
  loginMethod: "oauth",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
  subscriptionStatus: "active",
};

const MOCK_MEMBER = {
  id: 1,
  name: "Marcus Johnson",
  phone: "555-1234",
  email: "marcus@example.com",
  role: "Lead Painter",
  status: "active" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeCaller() {
  return appRouter.createCaller({
    user: MOCK_USER,
    req: {} as any,
    res: {} as any,
  } as TrpcContext);
}

describe("crew router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("crew.list", () => {
    it("returns list of crew members", async () => {
      vi.mocked(listCrewMembers).mockResolvedValue([MOCK_MEMBER]);
      const caller = makeCaller();
      const result = await caller.crew.list({ status: "all" });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Marcus Johnson");
    });

    it("filters by active status", async () => {
      vi.mocked(listCrewMembers).mockResolvedValue([MOCK_MEMBER]);
      const caller = makeCaller();
      await caller.crew.list({ status: "active" });
      expect(listCrewMembers).toHaveBeenCalledWith("active", 1);
    });

    it("returns empty array when no crew members", async () => {
      vi.mocked(listCrewMembers).mockResolvedValue([]);
      const caller = makeCaller();
      const result = await caller.crew.list({ status: "all" });
      expect(result).toHaveLength(0);
    });
  });

  describe("crew.get", () => {
    it("returns a single crew member", async () => {
      vi.mocked(getCrewMember).mockResolvedValue(MOCK_MEMBER);
      const caller = makeCaller();
      const result = await caller.crew.get({ id: 1 });
      expect(result?.name).toBe("Marcus Johnson");
    });

    it("returns null for unknown id", async () => {
      vi.mocked(getCrewMember).mockResolvedValue(null);
      const caller = makeCaller();
      const result = await caller.crew.get({ id: 999 });
      expect(result).toBeNull();
    });
  });

  describe("crew.create", () => {
    it("creates a new crew member", async () => {
      vi.mocked(createCrewMember).mockResolvedValue(MOCK_MEMBER);
      const caller = makeCaller();
      const result = await caller.crew.create({
        name: "Marcus Johnson",
        phone: "555-1234",
        email: "marcus@example.com",
        role: "Lead Painter",
        status: "active",
      });
      expect(result?.name).toBe("Marcus Johnson");
      expect(createCrewMember).toHaveBeenCalledOnce();
    });

    it("rejects empty name", async () => {
      const caller = makeCaller();
      await expect(
        caller.crew.create({ name: "", status: "active" })
      ).rejects.toThrow();
    });
  });

  describe("crew.update", () => {
    it("updates a crew member", async () => {
      const updated = { ...MOCK_MEMBER, role: "Foreman" };
      vi.mocked(updateCrewMember).mockResolvedValue(updated);
      const caller = makeCaller();
      const result = await caller.crew.update({ id: 1, data: { role: "Foreman" } });
      expect(result?.role).toBe("Foreman");
    });
  });

  describe("crew.deactivate", () => {
    it("deactivates a crew member", async () => {
      const inactive = { ...MOCK_MEMBER, status: "inactive" as const };
      vi.mocked(deactivateCrewMember).mockResolvedValue(inactive);
      const caller = makeCaller();
      const result = await caller.crew.deactivate({ id: 1 });
      expect(result?.status).toBe("inactive");
      expect(deactivateCrewMember).toHaveBeenCalledWith(1, 1);
    });
  });

  describe("crew.reactivate", () => {
    it("reactivates a crew member", async () => {
      vi.mocked(reactivateCrewMember).mockResolvedValue(MOCK_MEMBER);
      const caller = makeCaller();
      const result = await caller.crew.reactivate({ id: 1 });
      expect(result?.status).toBe("active");
      expect(reactivateCrewMember).toHaveBeenCalledWith(1, 1);
    });
  });
});
