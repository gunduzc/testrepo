import { describe, it, expect, beforeEach, vi } from "vitest";
import { studyService } from "./study.service";
import prisma from "@/lib/prisma";
import { sandboxService } from "./sandbox.service";
import { fsrsService } from "./fsrs.service";
import { validationService } from "./validation.service";
import { Rating } from "@/lib/types";

// Mock dependencies
vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      findUnique: vi.fn(),
    },
    activeStudySession: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    generatedContent: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    cardSubject: {
      findFirst: vi.fn(),
    },
    curriculum: {
      findUnique: vi.fn(),
    },
    studentCardState: {
      findFirst: vi.fn(),
    },
    userCurriculumEnrollment: {
      findMany: vi.fn(),
    },
    classEnrollment: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("./sandbox.service", () => ({
  sandboxService: {
    executeCard: vi.fn(),
  },
}));

vi.mock("./fsrs.service", () => ({
  fsrsService: {
    getNextCard: vi.fn(),
    computeRating: vi.fn(),
    capResponseTime: vi.fn(),
    updateCardState: vi.fn(),
    getStudentProgress: vi.fn(),
  },
}));

vi.mock("./validation.service", () => ({
  validationService: {
    validate: vi.fn(),
  },
}));

vi.mock("./llm.service", () => ({
  llmService: {
    themeQuestion: vi.fn(),
  },
}));

describe("StudySessionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getNextQuestion", () => {
    it("should return null when no cards due", async () => {
      vi.mocked(fsrsService.getNextCard).mockResolvedValue(null);

      const result = await studyService.getNextQuestion("user-1", "curriculum-1");

      expect(result).toBeNull();
    });

    it("should return question without correct answer", async () => {
      const mockScheduledCard = {
        cardId: "card-1",
        card: {
          id: "card-1",
          name: "Addition",
          functionSource: "function generate() {}",
          answerType: "INTEGER",
          learningSteps: 5,
          relearningSteps: 3,
          reviewSteps: 1,
          description: "Test",
        },
        state: "NEW",
        due: new Date(),
        isNew: true,
        subjectId: "subject-1",
        subjectName: "Math",
        position: 0,
        currentStep: 0,
        requiredSteps: 5,
      };

      vi.mocked(fsrsService.getNextCard).mockResolvedValue(mockScheduledCard as any);
      vi.mocked(sandboxService.executeCard).mockResolvedValue({
        success: true,
        output: {
          question: "What is 2+2?",
          answer: { correct: "4", type: "INTEGER" },
          solution: "2+2=4",
        },
      });
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "user-1",
        selectedTheme: null,
      } as any);
      vi.mocked(prisma.activeStudySession.deleteMany).mockResolvedValue({ count: 0 });
      vi.mocked(prisma.activeStudySession.create).mockResolvedValue({
        id: "session-1",
        userId: "user-1",
        cardId: "card-1",
        correctAnswer: "4",
        answerType: "INTEGER",
        solution: "2+2=4",
        presentedAt: new Date(),
        expiresAt: new Date(Date.now() + 600000),
      } as any);

      const result = await studyService.getNextQuestion("user-1", "curriculum-1");

      expect(result).not.toBeNull();
      expect(result?.question).toBe("What is 2+2?");
      expect(result?.cardName).toBe("Addition");
      expect(result?.subjectName).toBe("Math");
      expect(result?.sessionId).toBe("session-1");
      // Correct answer should NOT be included
      expect((result as any)?.correctAnswer).toBeUndefined();
    });

    it("should return null when card execution fails", async () => {
      const mockScheduledCard = {
        cardId: "card-1",
        card: {
          id: "card-1",
          name: "Broken Card",
          functionSource: "invalid code",
          answerType: "INTEGER",
          learningSteps: 5,
          relearningSteps: 3,
          reviewSteps: 1,
          description: "Test",
        },
        state: "NEW",
        due: new Date(),
        isNew: true,
        subjectId: "subject-1",
        subjectName: "Math",
        position: 0,
        currentStep: 0,
        requiredSteps: 5,
      };

      vi.mocked(fsrsService.getNextCard).mockResolvedValue(mockScheduledCard as any);
      vi.mocked(sandboxService.executeCard).mockResolvedValue({
        success: false,
        error: { type: "SyntaxError", message: "Unexpected token" },
      });

      const result = await studyService.getNextQuestion("user-1", "curriculum-1");

      expect(result).toBeNull();
    });

    it("should include choices for CHOICE type questions", async () => {
      const mockScheduledCard = {
        cardId: "card-1",
        card: {
          id: "card-1",
          name: "Multiple Choice",
          functionSource: "function generate() {}",
          answerType: "CHOICE",
          learningSteps: 5,
          relearningSteps: 3,
          reviewSteps: 1,
          description: "Test",
        },
        state: "NEW",
        due: new Date(),
        isNew: true,
        subjectId: "subject-1",
        subjectName: "Science",
        position: 0,
        currentStep: 0,
        requiredSteps: 5,
      };

      vi.mocked(fsrsService.getNextCard).mockResolvedValue(mockScheduledCard as any);
      vi.mocked(sandboxService.executeCard).mockResolvedValue({
        success: true,
        output: {
          question: "Which is a mammal?",
          answer: {
            correct: "Dog",
            type: "CHOICE",
            choices: ["Dog", "Fish", "Snake", "Frog"],
          },
          solution: "Dogs are mammals.",
        },
      });
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "user-1",
        selectedTheme: null,
      } as any);
      vi.mocked(prisma.activeStudySession.deleteMany).mockResolvedValue({ count: 0 });
      vi.mocked(prisma.activeStudySession.create).mockResolvedValue({
        id: "session-1",
      } as any);

      const result = await studyService.getNextQuestion("user-1", "curriculum-1");

      expect(result?.choices).toEqual(["Dog", "Fish", "Snake", "Frog"]);
      expect(result?.answerType).toBe("CHOICE");
    });

    it("should clean up expired sessions", async () => {
      const mockScheduledCard = {
        cardId: "card-1",
        card: {
          id: "card-1",
          name: "Test",
          functionSource: "function generate() {}",
          answerType: "INTEGER",
          learningSteps: 5,
          relearningSteps: 3,
          reviewSteps: 1,
          description: "Test",
        },
        state: "NEW",
        due: new Date(),
        isNew: true,
        subjectId: "subject-1",
        subjectName: "Math",
        position: 0,
        currentStep: 0,
        requiredSteps: 5,
      };

      vi.mocked(fsrsService.getNextCard).mockResolvedValue(mockScheduledCard as any);
      vi.mocked(sandboxService.executeCard).mockResolvedValue({
        success: true,
        output: {
          question: "Test?",
          answer: { correct: "1", type: "INTEGER" },
          solution: "test",
        },
      });
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "user-1",
        selectedTheme: null,
      } as any);
      vi.mocked(prisma.activeStudySession.deleteMany).mockResolvedValue({ count: 2 });
      vi.mocked(prisma.activeStudySession.create).mockResolvedValue({
        id: "session-1",
      } as any);

      await studyService.getNextQuestion("user-1", "curriculum-1");

      expect(prisma.activeStudySession.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          expiresAt: { lt: expect.any(Date) },
        },
      });
    });
  });

  describe("submitAnswer", () => {
    it("should return null when session not found", async () => {
      vi.mocked(prisma.activeStudySession.findUnique).mockResolvedValue(null);

      const result = await studyService.submitAnswer("session-1", "4", "user-1");

      expect(result).toBeNull();
    });

    it("should return null when session belongs to different user", async () => {
      vi.mocked(prisma.activeStudySession.findUnique).mockResolvedValue({
        id: "session-1",
        userId: "other-user",
        cardId: "card-1",
        correctAnswer: "4",
        answerType: "INTEGER",
        solution: "test",
        presentedAt: new Date(),
        expiresAt: new Date(Date.now() + 600000),
      } as any);

      const result = await studyService.submitAnswer("session-1", "4", "user-1");

      expect(result).toBeNull();
    });

    it("should return null and delete when session expired", async () => {
      vi.mocked(prisma.activeStudySession.findUnique).mockResolvedValue({
        id: "session-1",
        userId: "user-1",
        cardId: "card-1",
        correctAnswer: "4",
        answerType: "INTEGER",
        solution: "test",
        presentedAt: new Date(Date.now() - 1200000), // 20 mins ago
        expiresAt: new Date(Date.now() - 600000), // Expired 10 mins ago
      } as any);
      vi.mocked(prisma.activeStudySession.delete).mockResolvedValue({} as any);

      const result = await studyService.submitAnswer("session-1", "4", "user-1");

      expect(result).toBeNull();
      expect(prisma.activeStudySession.delete).toHaveBeenCalled();
    });

    it("should return correct result for correct answer", async () => {
      const now = new Date();
      vi.mocked(prisma.activeStudySession.findUnique).mockResolvedValue({
        id: "session-1",
        userId: "user-1",
        cardId: "card-1",
        correctAnswer: "4",
        answerType: "INTEGER",
        solution: "2+2=4",
        validateFnSource: null,
        presentedAt: new Date(now.getTime() - 5000), // 5 seconds ago
        expiresAt: new Date(now.getTime() + 595000),
      } as any);
      vi.mocked(validationService.validate).mockResolvedValue(true);
      vi.mocked(fsrsService.computeRating).mockReturnValue(Rating.GOOD);
      vi.mocked(fsrsService.capResponseTime).mockReturnValue(5000);
      vi.mocked(fsrsService.updateCardState).mockResolvedValue({
        newState: "LEARNING",
        stability: 0,
        difficulty: 0,
        canUndo: true,
        stepsRemaining: 4,
      });
      vi.mocked(prisma.activeStudySession.delete).mockResolvedValue({} as any);
      vi.mocked(prisma.cardSubject.findFirst).mockResolvedValue(null);

      const result = await studyService.submitAnswer("session-1", "4", "user-1");

      expect(result).not.toBeNull();
      expect(result?.correct).toBe(true);
      expect(result?.correctAnswer).toBe("4");
      expect(result?.solution).toBe("2+2=4");
      expect(result?.rating).toBe(Rating.GOOD);
      expect(result?.canUndo).toBe(true);
    });

    it("should return incorrect result for wrong answer", async () => {
      const now = new Date();
      vi.mocked(prisma.activeStudySession.findUnique).mockResolvedValue({
        id: "session-1",
        userId: "user-1",
        cardId: "card-1",
        correctAnswer: "4",
        answerType: "INTEGER",
        solution: "2+2=4",
        validateFnSource: null,
        presentedAt: new Date(now.getTime() - 5000),
        expiresAt: new Date(now.getTime() + 595000),
      } as any);
      vi.mocked(validationService.validate).mockResolvedValue(false);
      vi.mocked(fsrsService.computeRating).mockReturnValue(Rating.AGAIN);
      vi.mocked(fsrsService.capResponseTime).mockReturnValue(5000);
      vi.mocked(fsrsService.updateCardState).mockResolvedValue({
        newState: "LEARNING",
        stability: 0,
        difficulty: 0,
        canUndo: true,
        stepsRemaining: 5,
      });
      vi.mocked(prisma.activeStudySession.delete).mockResolvedValue({} as any);
      vi.mocked(prisma.cardSubject.findFirst).mockResolvedValue(null);

      const result = await studyService.submitAnswer("session-1", "5", "user-1");

      expect(result?.correct).toBe(false);
      expect(result?.correctAnswer).toBe("4"); // Reveals correct answer
      expect(result?.rating).toBe(Rating.AGAIN);
    });

    it("should delete session after submission", async () => {
      const now = new Date();
      vi.mocked(prisma.activeStudySession.findUnique).mockResolvedValue({
        id: "session-1",
        userId: "user-1",
        cardId: "card-1",
        correctAnswer: "4",
        answerType: "INTEGER",
        solution: "test",
        validateFnSource: null,
        presentedAt: new Date(now.getTime() - 5000),
        expiresAt: new Date(now.getTime() + 595000),
      } as any);
      vi.mocked(validationService.validate).mockResolvedValue(true);
      vi.mocked(fsrsService.computeRating).mockReturnValue(Rating.GOOD);
      vi.mocked(fsrsService.capResponseTime).mockReturnValue(5000);
      vi.mocked(fsrsService.updateCardState).mockResolvedValue({
        newState: "LEARNING",
        stability: 0,
        difficulty: 0,
        canUndo: true,
        stepsRemaining: 4,
      });
      vi.mocked(prisma.activeStudySession.delete).mockResolvedValue({} as any);
      vi.mocked(prisma.cardSubject.findFirst).mockResolvedValue(null);

      await studyService.submitAnswer("session-1", "4", "user-1");

      expect(prisma.activeStudySession.delete).toHaveBeenCalledWith({
        where: { id: "session-1" },
      });
    });

    it("should cap response time for AFK detection", async () => {
      const now = new Date();
      vi.mocked(prisma.activeStudySession.findUnique).mockResolvedValue({
        id: "session-1",
        userId: "user-1",
        cardId: "card-1",
        correctAnswer: "4",
        answerType: "INTEGER",
        solution: "test",
        validateFnSource: null,
        presentedAt: new Date(now.getTime() - 300000), // 5 minutes ago
        expiresAt: new Date(now.getTime() + 300000),
      } as any);
      vi.mocked(validationService.validate).mockResolvedValue(true);
      vi.mocked(fsrsService.computeRating).mockReturnValue(Rating.GOOD);
      vi.mocked(fsrsService.capResponseTime).mockReturnValue(120000); // Capped at 2 mins
      vi.mocked(fsrsService.updateCardState).mockResolvedValue({
        newState: "LEARNING",
        stability: 0,
        difficulty: 0,
        canUndo: true,
        stepsRemaining: 4,
      });
      vi.mocked(prisma.activeStudySession.delete).mockResolvedValue({} as any);
      vi.mocked(prisma.cardSubject.findFirst).mockResolvedValue(null);

      await studyService.submitAnswer("session-1", "4", "user-1");

      expect(fsrsService.capResponseTime).toHaveBeenCalled();
    });
  });

  describe("getPreviewQuestion", () => {
    it("should return null for nonexistent curriculum", async () => {
      vi.mocked(prisma.curriculum.findUnique).mockResolvedValue(null);

      const result = await studyService.getPreviewQuestion("curriculum-1");

      expect(result).toBeNull();
    });

    it("should return null for curriculum with no cards", async () => {
      vi.mocked(prisma.curriculum.findUnique).mockResolvedValue({
        id: "curriculum-1",
        curriculumSubjects: [],
      } as any);

      const result = await studyService.getPreviewQuestion("curriculum-1");

      expect(result).toBeNull();
    });

    it("should include correct answer and solution in preview", async () => {
      vi.mocked(prisma.curriculum.findUnique).mockResolvedValue({
        id: "curriculum-1",
        curriculumSubjects: [
          {
            subject: {
              name: "Math",
              cardSubjects: [
                {
                  card: {
                    id: "card-1",
                    name: "Addition",
                    functionSource: "function generate() {}",
                  },
                },
              ],
            },
          },
        ],
      } as any);
      vi.mocked(sandboxService.executeCard).mockResolvedValue({
        success: true,
        output: {
          question: "What is 2+2?",
          answer: { correct: "4", type: "INTEGER" },
          solution: "2+2=4",
        },
      });

      const result = await studyService.getPreviewQuestion("curriculum-1");

      expect(result).not.toBeNull();
      expect(result?.correctAnswer).toBe("4");
      expect(result?.solution).toBe("2+2=4");
    });
  });

  describe("getProgress", () => {
    it("should return progress from fsrsService", async () => {
      const mockProgress = {
        totalCards: 10,
        newCards: 5,
        learningCards: 2,
        reviewCards: 3,
        relearningCards: 0,
        masteredCards: 3,
        dueCards: 5,
        completionPercentage: 30,
        subjectProgress: [],
      };
      vi.mocked(fsrsService.getStudentProgress).mockResolvedValue(mockProgress);

      const result = await studyService.getProgress("user-1", "curriculum-1");

      expect(result).toEqual(mockProgress);
      expect(fsrsService.getStudentProgress).toHaveBeenCalledWith(
        "user-1",
        "curriculum-1"
      );
    });
  });

  describe("getNextDueTime", () => {
    it("should return null for nonexistent curriculum", async () => {
      vi.mocked(prisma.curriculum.findUnique).mockResolvedValue(null);

      const result = await studyService.getNextDueTime("user-1", "curriculum-1");

      expect(result).toBeNull();
    });

    it("should return next due time", async () => {
      const nextDueDate = new Date(Date.now() + 3600000); // 1 hour from now
      vi.mocked(prisma.curriculum.findUnique).mockResolvedValue({
        id: "curriculum-1",
        curriculumSubjects: [
          {
            subject: {
              cardSubjects: [{ cardId: "card-1" }],
            },
          },
        ],
      } as any);
      vi.mocked(prisma.studentCardState.findFirst).mockResolvedValue({
        due: nextDueDate,
      } as any);

      const result = await studyService.getNextDueTime("user-1", "curriculum-1");

      expect(result).toEqual(nextDueDate);
    });

    it("should return null when no cards are scheduled", async () => {
      vi.mocked(prisma.curriculum.findUnique).mockResolvedValue({
        id: "curriculum-1",
        curriculumSubjects: [
          {
            subject: {
              cardSubjects: [{ cardId: "card-1" }],
            },
          },
        ],
      } as any);
      vi.mocked(prisma.studentCardState.findFirst).mockResolvedValue(null);

      const result = await studyService.getNextDueTime("user-1", "curriculum-1");

      expect(result).toBeNull();
    });
  });

  describe("getEnrolledCurricula", () => {
    it("should combine individual and class enrollments", async () => {
      vi.mocked(prisma.userCurriculumEnrollment.findMany).mockResolvedValue([
        { curriculum: { id: "curriculum-1", name: "Math" } },
      ] as any);
      vi.mocked(prisma.classEnrollment.findMany).mockResolvedValue([
        {
          class: {
            curriculumAssignments: [
              { curriculum: { id: "curriculum-2", name: "Science" } },
            ],
          },
        },
      ] as any);
      vi.mocked(fsrsService.getStudentProgress).mockResolvedValue({
        totalCards: 10,
        newCards: 5,
        learningCards: 2,
        reviewCards: 2,
        relearningCards: 1,
        masteredCards: 2,
        dueCards: 3,
        completionPercentage: 20,
        subjectProgress: [],
      });

      const result = await studyService.getEnrolledCurricula("user-1");

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.curriculumName)).toContain("Math");
      expect(result.map((r) => r.curriculumName)).toContain("Science");
    });

    it("should deduplicate curricula enrolled via both methods", async () => {
      vi.mocked(prisma.userCurriculumEnrollment.findMany).mockResolvedValue([
        { curriculum: { id: "curriculum-1", name: "Math" } },
      ] as any);
      vi.mocked(prisma.classEnrollment.findMany).mockResolvedValue([
        {
          class: {
            curriculumAssignments: [
              { curriculum: { id: "curriculum-1", name: "Math" } }, // Same curriculum
            ],
          },
        },
      ] as any);
      vi.mocked(fsrsService.getStudentProgress).mockResolvedValue({
        totalCards: 10,
        newCards: 5,
        learningCards: 2,
        reviewCards: 2,
        relearningCards: 1,
        masteredCards: 2,
        dueCards: 3,
        completionPercentage: 20,
        subjectProgress: [],
      });

      const result = await studyService.getEnrolledCurricula("user-1");

      expect(result).toHaveLength(1);
    });
  });
});
