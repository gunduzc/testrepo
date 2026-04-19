/**
 * Integration Tests for Study API
 * Maps to:
 * - FR-03: System schedules reviews using spaced repetition (FSRS)
 * - FR-04: User can study cards and submit answers
 * - FR-05: System validates answers correctly
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// Mock study service
vi.mock("@/services", () => ({
  studyService: {
    getNextQuestion: vi.fn(),
    getPreviewQuestion: vi.fn(),
    getNextDueTime: vi.fn(),
    getProgress: vi.fn(),
    submitAnswer: vi.fn(),
  },
}));

import { auth } from "@/lib/auth";
import { studyService } from "@/services";

// Import route handlers
import { GET } from "./[curriculumId]/route";
import { POST as submitAnswer } from "./submit/route";

describe("Study API - GET /api/study/[curriculumId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // TC-16: Get next due card for study
  it("TC-16: should return next due card for study session", async () => {
    const mockUser = { id: "user-1", role: "STUDENT" };
    vi.mocked(auth).mockResolvedValue({ user: mockUser } as any);
    vi.mocked(studyService.getNextQuestion).mockResolvedValue({
      sessionId: "session-1",
      cardId: "card-1",
      question: "What is 5 + 7?",
      answerType: "INTEGER",
      choices: undefined,
      cardName: "Addition",
      currentStep: 0,
      requiredSteps: 5,
    } as any);

    const request = new NextRequest("http://localhost/api/study/curriculum-1");
    const response = await GET(request, { params: Promise.resolve({ curriculumId: "curriculum-1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.sessionId).toBe("session-1");
    expect(data.data.question).toBe("What is 5 + 7?");
    expect(studyService.getNextQuestion).toHaveBeenCalledWith("user-1", "curriculum-1");
  });

  // TC-17: Return null when no cards are due
  it("TC-17: should indicate when no cards are due", async () => {
    const mockUser = { id: "user-1", role: "STUDENT" };
    vi.mocked(auth).mockResolvedValue({ user: mockUser } as any);
    vi.mocked(studyService.getNextQuestion).mockResolvedValue(null);
    vi.mocked(studyService.getNextDueTime).mockResolvedValue(new Date("2024-01-15T10:00:00Z"));

    const request = new NextRequest("http://localhost/api/study/curriculum-1");
    const response = await GET(request, { params: Promise.resolve({ curriculumId: "curriculum-1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toBeNull();
    expect(data.message).toBe("No cards due");
    expect(data.nextDue).toBeDefined();
  });

  // TC-18: Include step progress information
  it("TC-18: should include step progress for learning cards", async () => {
    const mockUser = { id: "user-1", role: "STUDENT" };
    vi.mocked(auth).mockResolvedValue({ user: mockUser } as any);
    vi.mocked(studyService.getNextQuestion).mockResolvedValue({
      sessionId: "session-1",
      cardId: "card-1",
      question: "What is 3 × 4?",
      answerType: "INTEGER",
      choices: undefined,
      cardName: "Multiplication",
      currentStep: 2,
      requiredSteps: 5,
    } as any);

    const request = new NextRequest("http://localhost/api/study/curriculum-1");
    const response = await GET(request, { params: Promise.resolve({ curriculumId: "curriculum-1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.currentStep).toBe(2);
    expect(data.data.requiredSteps).toBe(5);
  });

  // TC-19: Preview mode for educators
  it("TC-19: should allow educators to preview cards", async () => {
    const mockUser = { id: "user-1", role: "EDUCATOR" };
    vi.mocked(auth).mockResolvedValue({ user: mockUser } as any);
    vi.mocked(studyService.getPreviewQuestion).mockResolvedValue({
      sessionId: "preview-1",
      cardId: "card-1",
      question: "Preview question",
      answerType: "TEXT",
      choices: undefined,
      cardName: "Preview Card",
    });

    const request = new NextRequest("http://localhost/api/study/curriculum-1?preview=true");
    const response = await GET(request, { params: Promise.resolve({ curriculumId: "curriculum-1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(studyService.getPreviewQuestion).toHaveBeenCalledWith("curriculum-1");
  });

  // TC-20: Reject preview mode for students
  it("TC-20: should reject preview mode for non-educators", async () => {
    const mockUser = { id: "user-1", role: "STUDENT" };
    vi.mocked(auth).mockResolvedValue({ user: mockUser } as any);

    const request = new NextRequest("http://localhost/api/study/curriculum-1?preview=true");
    const response = await GET(request, { params: Promise.resolve({ curriculumId: "curriculum-1" }) });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error.code).toBe("FORBIDDEN");
  });
});

describe("Study API - POST /api/study/submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // TC-21: Submit correct answer
  it("TC-21: should process correct answer submission", async () => {
    const mockUser = { id: "user-1", role: "STUDENT" };
    vi.mocked(auth).mockResolvedValue({ user: mockUser } as any);
    vi.mocked(studyService.submitAnswer).mockResolvedValue({
      correct: true,
      correctAnswer: "12",
      solution: "5 + 7 = 12",
      nextState: "LEARNING",
      stepsRemaining: 4,
    } as any);

    const request = new NextRequest("http://localhost/api/study/submit", {
      method: "POST",
      body: JSON.stringify({
        sessionId: "session-1",
        answer: "12",
      }),
    });

    const response = await submitAnswer(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.correct).toBe(true);
    expect(data.data.stepsRemaining).toBe(4);
    expect(studyService.submitAnswer).toHaveBeenCalledWith("session-1", "12", "user-1");
  });

  // TC-22: Submit incorrect answer
  it("TC-22: should process incorrect answer and reset steps", async () => {
    const mockUser = { id: "user-1", role: "STUDENT" };
    vi.mocked(auth).mockResolvedValue({ user: mockUser } as any);
    vi.mocked(studyService.submitAnswer).mockResolvedValue({
      correct: false,
      correctAnswer: "12",
      solution: "5 + 7 = 12",
      nextState: "LEARNING",
      stepsRemaining: 5, // Reset to full steps
    } as any);

    const request = new NextRequest("http://localhost/api/study/submit", {
      method: "POST",
      body: JSON.stringify({
        sessionId: "session-1",
        answer: "10", // Wrong answer
      }),
    });

    const response = await submitAnswer(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.correct).toBe(false);
    expect(data.data.correctAnswer).toBe("12");
    expect(data.data.solution).toBeDefined();
  });

  // TC-23: Graduate card after completing all steps
  it("TC-23: should graduate card to REVIEW after all learning steps", async () => {
    const mockUser = { id: "user-1", role: "STUDENT" };
    vi.mocked(auth).mockResolvedValue({ user: mockUser } as any);
    vi.mocked(studyService.submitAnswer).mockResolvedValue({
      correct: true,
      correctAnswer: "42",
      solution: "The answer is 42",
      nextState: "REVIEW", // Graduated!
      stepsRemaining: 1, // Review steps
    } as any);

    const request = new NextRequest("http://localhost/api/study/submit", {
      method: "POST",
      body: JSON.stringify({
        sessionId: "session-1",
        answer: "42",
      }),
    });

    const response = await submitAnswer(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.nextState).toBe("REVIEW");
  });

  // TC-24: Handle expired/invalid session
  it("TC-24: should return error for invalid study session", async () => {
    const mockUser = { id: "user-1", role: "STUDENT" };
    vi.mocked(auth).mockResolvedValue({ user: mockUser } as any);
    vi.mocked(studyService.submitAnswer).mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/study/submit", {
      method: "POST",
      body: JSON.stringify({
        sessionId: "invalid-session",
        answer: "42",
      }),
    });

    const response = await submitAnswer(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error.code).toBe("SESSION_NOT_FOUND");
  });

  // TC-25: Validate request body
  it("TC-25: should reject missing required fields", async () => {
    const mockUser = { id: "user-1", role: "STUDENT" };
    vi.mocked(auth).mockResolvedValue({ user: mockUser } as any);

    const request = new NextRequest("http://localhost/api/study/submit", {
      method: "POST",
      body: JSON.stringify({
        // Missing sessionId and answer
      }),
    });

    const response = await submitAnswer(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("VALIDATION_ERROR");
  });
});
