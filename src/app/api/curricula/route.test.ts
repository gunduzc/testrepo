/**
 * Integration Tests for Curricula API
 * Maps to FR-06: User can create and manage curricula
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST, GET } from "./route";

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// Mock curriculum service
vi.mock("@/services", () => ({
  curriculumService: {
    createCurriculum: vi.fn(),
    listByAuthor: vi.fn(),
  },
}));

// Mock instance config
vi.mock("@/lib/instance-config", () => ({
  canCreateContent: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { curriculumService } from "@/services";
import { canCreateContent } from "@/lib/instance-config";

describe("Curricula API - POST /api/curricula", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // TC-26: Create curriculum
  it("TC-26: should create curriculum with valid data", async () => {
    const mockUser = { id: "user-1", role: "EDUCATOR" };
    vi.mocked(auth).mockResolvedValue({ user: mockUser } as any);
    vi.mocked(canCreateContent).mockReturnValue(true);
    vi.mocked(curriculumService.createCurriculum).mockResolvedValue({
      id: "curriculum-1",
      name: "Basic Math",
      description: "Elementary mathematics curriculum",
      authorId: "user-1",
    } as any);

    const request = new NextRequest("http://localhost/api/curricula", {
      method: "POST",
      body: JSON.stringify({
        name: "Basic Math",
        description: "Elementary mathematics curriculum",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.id).toBe("curriculum-1");
    expect(data.data.name).toBe("Basic Math");
    expect(curriculumService.createCurriculum).toHaveBeenCalledWith(
      { name: "Basic Math", description: "Elementary mathematics curriculum" },
      "user-1"
    );
  });

  // TC-27: Reject empty curriculum name
  it("TC-27: should reject curriculum with empty name", async () => {
    const mockUser = { id: "user-1", role: "EDUCATOR" };
    vi.mocked(auth).mockResolvedValue({ user: mockUser } as any);
    vi.mocked(canCreateContent).mockReturnValue(true);

    const request = new NextRequest("http://localhost/api/curricula", {
      method: "POST",
      body: JSON.stringify({
        name: "",
        description: "Test description",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("VALIDATION_ERROR");
  });

  // TC-28: Reject unauthorized users
  it("TC-28: should reject students from creating curricula", async () => {
    const mockUser = { id: "user-1", role: "STUDENT" };
    vi.mocked(auth).mockResolvedValue({ user: mockUser } as any);
    vi.mocked(canCreateContent).mockReturnValue(false);

    const request = new NextRequest("http://localhost/api/curricula", {
      method: "POST",
      body: JSON.stringify({
        name: "Test Curriculum",
        description: "Test",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error.code).toBe("FORBIDDEN");
  });
});

describe("Curricula API - GET /api/curricula", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // TC-29: List user's curricula
  it("TC-29: should list curricula created by user", async () => {
    const mockUser = { id: "user-1", role: "EDUCATOR" };
    vi.mocked(auth).mockResolvedValue({ user: mockUser } as any);
    vi.mocked(curriculumService.listByAuthor).mockResolvedValue({
      curricula: [
        { id: "curriculum-1", name: "Math 101" },
        { id: "curriculum-2", name: "Science 101" },
      ],
      total: 2,
    } as any);

    const request = new NextRequest("http://localhost/api/curricula");

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.curricula).toHaveLength(2);
    expect(curriculumService.listByAuthor).toHaveBeenCalledWith("user-1", { limit: 20, offset: 0 });
  });

  // TC-30: Pagination support
  it("TC-30: should support pagination parameters", async () => {
    const mockUser = { id: "user-1", role: "EDUCATOR" };
    vi.mocked(auth).mockResolvedValue({ user: mockUser } as any);
    vi.mocked(curriculumService.listByAuthor).mockResolvedValue({
      curricula: [],
      total: 0,
    } as any);

    const request = new NextRequest("http://localhost/api/curricula?limit=10&offset=20");

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(curriculumService.listByAuthor).toHaveBeenCalledWith("user-1", { limit: 10, offset: 20 });
  });
});
