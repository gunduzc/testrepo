/**
 * Integration Tests for Card Test API
 * Maps to FR-02: System executes card code securely in sandbox
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// Mock card service
vi.mock("@/services", () => ({
  cardService: {
    testFunction: vi.fn(),
  },
}));

import { auth } from "@/lib/auth";
import { cardService } from "@/services";

describe("Card Test API - POST /api/cards/test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // TC-09: Execute valid card function
  it("TC-09: should execute valid card function and return results", async () => {
    const mockUser = { id: "user-1", role: "EDUCATOR" };
    vi.mocked(auth).mockResolvedValue({ user: mockUser } as any);
    vi.mocked(cardService.testFunction).mockResolvedValue([
      {
        success: true,
        output: {
          question: "What is 2 + 3?",
          answer: { correct: "5", type: "INTEGER" },
          solution: "2 + 3 = 5",
        },
      },
      {
        success: true,
        output: {
          question: "What is 4 + 1?",
          answer: { correct: "5", type: "INTEGER" },
          solution: "4 + 1 = 5",
        },
      },
    ]);

    const request = new NextRequest("http://localhost/api/cards/test", {
      method: "POST",
      body: JSON.stringify({
        source: `function generate() {
          const a = Math.floor(Math.random() * 10);
          const b = Math.floor(Math.random() * 10);
          return {
            question: \`What is \${a} + \${b}?\`,
            answer: { correct: String(a + b), type: "INTEGER" },
            solution: \`\${a} + \${b} = \${a + b}\`
          };
        }`,
        count: 2,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(2);
    expect(data.data[0].success).toBe(true);
    expect(data.data[0].output.question).toBeDefined();
  });

  // TC-10: Detect syntax errors in card code
  it("TC-10: should return error for invalid JavaScript syntax", async () => {
    const mockUser = { id: "user-1", role: "EDUCATOR" };
    vi.mocked(auth).mockResolvedValue({ user: mockUser } as any);
    vi.mocked(cardService.testFunction).mockResolvedValue([
      {
        success: false,
        error: {
          type: "SyntaxError",
          message: "Unexpected token",
          line: 2,
        },
      },
    ]);

    const request = new NextRequest("http://localhost/api/cards/test", {
      method: "POST",
      body: JSON.stringify({
        source: "function generate() { return { ",
        count: 1,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data[0].success).toBe(false);
    expect(data.data[0].error.type).toBe("SyntaxError");
  });

  // TC-11: Detect runtime errors
  it("TC-11: should return error for runtime exceptions", async () => {
    const mockUser = { id: "user-1", role: "EDUCATOR" };
    vi.mocked(auth).mockResolvedValue({ user: mockUser } as any);
    vi.mocked(cardService.testFunction).mockResolvedValue([
      {
        success: false,
        error: {
          type: "RuntimeError",
          message: "undefined is not a function",
        },
      },
    ]);

    const request = new NextRequest("http://localhost/api/cards/test", {
      method: "POST",
      body: JSON.stringify({
        source: "function generate() { return nonExistent(); }",
        count: 1,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data[0].success).toBe(false);
    expect(data.data[0].error.type).toBe("RuntimeError");
  });

  // TC-12: Enforce timeout on infinite loops
  it("TC-12: should timeout on infinite loops", async () => {
    const mockUser = { id: "user-1", role: "EDUCATOR" };
    vi.mocked(auth).mockResolvedValue({ user: mockUser } as any);
    vi.mocked(cardService.testFunction).mockResolvedValue([
      {
        success: false,
        error: {
          type: "TimeoutError",
          message: "Execution timed out after 1 second",
        },
      },
    ]);

    const request = new NextRequest("http://localhost/api/cards/test", {
      method: "POST",
      body: JSON.stringify({
        source: "function generate() { while(true) {} }",
        count: 1,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data[0].success).toBe(false);
    expect(data.data[0].error.type).toBe("TimeoutError");
  });

  // TC-13: Enforce memory limits
  it("TC-13: should detect memory limit exceeded", async () => {
    const mockUser = { id: "user-1", role: "EDUCATOR" };
    vi.mocked(auth).mockResolvedValue({ user: mockUser } as any);
    vi.mocked(cardService.testFunction).mockResolvedValue([
      {
        success: false,
        error: {
          type: "MemoryError",
          message: "Memory limit exceeded (8 MB)",
        },
      },
    ]);

    const request = new NextRequest("http://localhost/api/cards/test", {
      method: "POST",
      body: JSON.stringify({
        source: "function generate() { const arr = []; while(true) arr.push(new Array(1000000)); }",
        count: 1,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data[0].success).toBe(false);
    expect(data.data[0].error.type).toBe("MemoryError");
  });

  // TC-14: Restrict to educators only
  it("TC-14: should reject non-educator users", async () => {
    const mockUser = { id: "user-1", role: "STUDENT" };
    vi.mocked(auth).mockResolvedValue({ user: mockUser } as any);

    const request = new NextRequest("http://localhost/api/cards/test", {
      method: "POST",
      body: JSON.stringify({
        source: "function generate() { return { question: 'Q', answer: { correct: '1', type: 'INTEGER' }, solution: 'S' }; }",
        count: 1,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error.code).toBe("FORBIDDEN");
  });

  // TC-15: Validate output shape
  it("TC-15: should detect invalid card output shape", async () => {
    const mockUser = { id: "user-1", role: "EDUCATOR" };
    vi.mocked(auth).mockResolvedValue({ user: mockUser } as any);
    vi.mocked(cardService.testFunction).mockResolvedValue([
      {
        success: false,
        error: {
          type: "ShapeError",
          message: "Invalid card output shape",
        },
      },
    ]);

    const request = new NextRequest("http://localhost/api/cards/test", {
      method: "POST",
      body: JSON.stringify({
        source: "function generate() { return { wrong: 'shape' }; }",
        count: 1,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data[0].success).toBe(false);
    expect(data.data[0].error.type).toBe("ShapeError");
  });
});
