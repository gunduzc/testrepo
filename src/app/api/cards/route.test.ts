/**
 * Integration Tests for Cards API
 * Maps to FR-01: User can create flashcards with JavaScript code
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST, GET } from "./route";

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// Mock card service
vi.mock("@/services", () => ({
  cardService: {
    create: vi.fn(),
    getByAuthor: vi.fn(),
    search: vi.fn(),
  },
}));

// Mock instance config
vi.mock("@/lib/instance-config", () => ({
  canCreateContent: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { cardService } from "@/services";
import { canCreateContent } from "@/lib/instance-config";

describe("Cards API - POST /api/cards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // TC-01: Card creation with valid data
  it("TC-01: should create card with valid JavaScript function", async () => {
    const mockUser = { id: "user-1", role: "EDUCATOR" };
    vi.mocked(auth).mockResolvedValue({ user: mockUser } as any);
    vi.mocked(canCreateContent).mockReturnValue(true);
    vi.mocked(cardService.create).mockResolvedValue({
      id: "card-1",
      name: "Addition Practice",
      functionSource: 'function generate() { return { question: "2+2", answer: { correct: "4", type: "INTEGER" }, solution: "4" }; }',
      answerType: "INTEGER",
      authorId: "user-1",
    } as any);

    const request = new NextRequest("http://localhost/api/cards", {
      method: "POST",
      body: JSON.stringify({
        name: "Addition Practice",
        description: "Practice basic addition",
        functionSource: 'function generate() { return { question: "2+2", answer: { correct: "4", type: "INTEGER" }, solution: "4" }; }',
        answerType: "INTEGER",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.id).toBe("card-1");
    expect(cardService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Addition Practice",
        functionSource: expect.any(String),
      }),
      "user-1"
    );
  });

  // TC-02: Reject unauthenticated requests
  it("TC-02: should reject unauthenticated requests", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/cards", {
      method: "POST",
      body: JSON.stringify({
        name: "Test Card",
        description: "Test",
        functionSource: "function generate() {}",
        answerType: "INTEGER",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error.code).toBe("UNAUTHORIZED");
  });

  // TC-03: Reject users without permission
  it("TC-03: should reject users without content creation permission", async () => {
    const mockUser = { id: "user-1", role: "STUDENT" };
    vi.mocked(auth).mockResolvedValue({ user: mockUser } as any);
    vi.mocked(canCreateContent).mockReturnValue(false);

    const request = new NextRequest("http://localhost/api/cards", {
      method: "POST",
      body: JSON.stringify({
        name: "Test Card",
        description: "Test",
        functionSource: "function generate() {}",
        answerType: "INTEGER",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error.code).toBe("FORBIDDEN");
  });

  // TC-04: Validate required fields
  it("TC-04: should reject card with missing required fields", async () => {
    const mockUser = { id: "user-1", role: "EDUCATOR" };
    vi.mocked(auth).mockResolvedValue({ user: mockUser } as any);
    vi.mocked(canCreateContent).mockReturnValue(true);

    const request = new NextRequest("http://localhost/api/cards", {
      method: "POST",
      body: JSON.stringify({
        name: "", // Empty name - invalid
        description: "Test",
        functionSource: "function generate() {}",
        answerType: "INTEGER",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("VALIDATION_ERROR");
  });

  // TC-05: Validate answer type
  it("TC-05: should reject invalid answer type", async () => {
    const mockUser = { id: "user-1", role: "EDUCATOR" };
    vi.mocked(auth).mockResolvedValue({ user: mockUser } as any);
    vi.mocked(canCreateContent).mockReturnValue(true);

    const request = new NextRequest("http://localhost/api/cards", {
      method: "POST",
      body: JSON.stringify({
        name: "Test Card",
        description: "Test",
        functionSource: "function generate() {}",
        answerType: "INVALID_TYPE",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("VALIDATION_ERROR");
  });

  // TC-06: Create card with custom step settings
  it("TC-06: should create card with custom learning/review steps", async () => {
    const mockUser = { id: "user-1", role: "EDUCATOR" };
    vi.mocked(auth).mockResolvedValue({ user: mockUser } as any);
    vi.mocked(canCreateContent).mockReturnValue(true);
    vi.mocked(cardService.create).mockResolvedValue({
      id: "card-1",
      learningSteps: 3,
      relearningSteps: 2,
      reviewSteps: 2,
    } as any);

    const request = new NextRequest("http://localhost/api/cards", {
      method: "POST",
      body: JSON.stringify({
        name: "Custom Steps Card",
        description: "Card with custom step counts",
        functionSource: "function generate() { return { question: 'Q', answer: { correct: '1', type: 'INTEGER' }, solution: 'S' }; }",
        answerType: "INTEGER",
        learningSteps: 3,
        relearningSteps: 2,
        reviewSteps: 2,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(cardService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        learningSteps: 3,
        relearningSteps: 2,
        reviewSteps: 2,
      }),
      "user-1"
    );
  });
});

describe("Cards API - GET /api/cards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // TC-07: List user's cards
  it("TC-07: should list cards created by authenticated user", async () => {
    const mockUser = { id: "user-1", role: "EDUCATOR" };
    vi.mocked(auth).mockResolvedValue({ user: mockUser } as any);
    vi.mocked(cardService.getByAuthor).mockResolvedValue({
      cards: [
        { id: "card-1", name: "Card 1" },
        { id: "card-2", name: "Card 2" },
      ],
      total: 2,
    } as any);

    const request = new NextRequest("http://localhost/api/cards");

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.cards).toHaveLength(2);
    expect(cardService.getByAuthor).toHaveBeenCalledWith("user-1", { limit: 20, offset: 0 });
  });

  // TC-08: Search cards
  it("TC-08: should search cards by query", async () => {
    const mockUser = { id: "user-1", role: "EDUCATOR" };
    vi.mocked(auth).mockResolvedValue({ user: mockUser } as any);
    vi.mocked(cardService.search).mockResolvedValue({
      cards: [{ id: "card-1", name: "Math Addition" }],
      total: 1,
    } as any);

    const request = new NextRequest("http://localhost/api/cards?search=math");

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(cardService.search).toHaveBeenCalledWith("math", { limit: 20, offset: 0 });
  });
});
