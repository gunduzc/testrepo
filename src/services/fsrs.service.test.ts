import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fsrsService } from "./fsrs.service";
import { Rating } from "@/lib/types";
import prisma from "@/lib/prisma";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      findUnique: vi.fn(),
    },
    card: {
      findUnique: vi.fn(),
    },
    studentCardState: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
    },
    classEnrollment: {
      findFirst: vi.fn(),
    },
    reviewLog: {
      create: vi.fn(),
      delete: vi.fn(),
    },
    undoableReview: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    curriculum: {
      findUnique: vi.fn(),
    },
  },
}));

describe("FSRSService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("computeRating", () => {
    it("should return GOOD for correct answers", () => {
      expect(fsrsService.computeRating(true)).toBe(Rating.GOOD);
    });

    it("should return AGAIN for incorrect answers", () => {
      expect(fsrsService.computeRating(false)).toBe(Rating.AGAIN);
    });
  });

  describe("capResponseTime", () => {
    it("should not cap response time under 2 minutes", () => {
      expect(fsrsService.capResponseTime(5000)).toBe(5000);
      expect(fsrsService.capResponseTime(60000)).toBe(60000);
      expect(fsrsService.capResponseTime(119999)).toBe(119999);
    });

    it("should cap response time at 2 minutes", () => {
      expect(fsrsService.capResponseTime(120000)).toBe(120000);
    });

    it("should cap response time over 2 minutes", () => {
      expect(fsrsService.capResponseTime(300000)).toBe(120000);
      expect(fsrsService.capResponseTime(1000000)).toBe(120000);
    });

    it("should handle zero response time", () => {
      expect(fsrsService.capResponseTime(0)).toBe(0);
    });

    it("should handle negative response time", () => {
      expect(fsrsService.capResponseTime(-1000)).toBe(-1000);
    });
  });

  describe("updateCardState - Step-based Learning", () => {
    const mockCard = {
      learningSteps: 3,
      relearningSteps: 2,
      reviewSteps: 2,
    };

    const mockUser = {
      fsrsParameters: null,
    };

    beforeEach(() => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.card.findUnique).mockResolvedValue(mockCard as any);
      vi.mocked(prisma.classEnrollment.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.reviewLog.create).mockResolvedValue({ id: "log-1" } as any);
      vi.mocked(prisma.undoableReview.upsert).mockResolvedValue({} as any);
    });

    it("should create LEARNING state for new card", async () => {
      vi.mocked(prisma.studentCardState.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.studentCardState.create).mockResolvedValue({
        id: "state-1",
        state: "LEARNING",
        stability: 0,
        difficulty: 0,
        elapsedDays: 0,
        scheduledDays: 0,
        reps: 0,
        lapses: 0,
        stepIndex: 0,
        due: new Date(),
        lastReview: null,
      } as any);
      vi.mocked(prisma.studentCardState.update).mockResolvedValue({} as any);

      const result = await fsrsService.updateCardState(
        "user-1",
        "card-1",
        Rating.GOOD,
        5000
      );

      expect(prisma.studentCardState.create).toHaveBeenCalled();
      expect(result.newState).toBe("LEARNING");
    });

    it("should increment stepIndex on correct answer in LEARNING", async () => {
      const existingState = {
        id: "state-1",
        state: "LEARNING",
        stability: 0,
        difficulty: 0,
        elapsedDays: 0,
        scheduledDays: 0,
        reps: 0,
        lapses: 0,
        stepIndex: 0, // First step
        due: new Date(),
        lastReview: null,
      };

      vi.mocked(prisma.studentCardState.findUnique).mockResolvedValue(existingState as any);
      vi.mocked(prisma.studentCardState.update).mockResolvedValue({} as any);

      const result = await fsrsService.updateCardState(
        "user-1",
        "card-1",
        Rating.GOOD,
        5000
      );

      // Should still be in LEARNING since stepIndex=1 < learningSteps=3
      expect(result.newState).toBe("LEARNING");
      expect(result.stepsRemaining).toBe(2); // 3 - 1 = 2
    });

    it("should graduate to REVIEW when all learning steps completed", async () => {
      const existingState = {
        id: "state-1",
        state: "LEARNING",
        stability: 0,
        difficulty: 0,
        elapsedDays: 0,
        scheduledDays: 0,
        reps: 0,
        lapses: 0,
        stepIndex: 2, // Last step (0, 1, 2 = 3 steps)
        due: new Date(),
        lastReview: null,
      };

      vi.mocked(prisma.studentCardState.findUnique).mockResolvedValue(existingState as any);
      vi.mocked(prisma.studentCardState.update).mockResolvedValue({} as any);

      const result = await fsrsService.updateCardState(
        "user-1",
        "card-1",
        Rating.GOOD,
        5000
      );

      // Should graduate to REVIEW
      expect(result.newState).toBe("REVIEW");
    });

    it("should reset stepIndex on incorrect answer in LEARNING", async () => {
      const existingState = {
        id: "state-1",
        state: "LEARNING",
        stability: 0,
        difficulty: 0,
        elapsedDays: 0,
        scheduledDays: 0,
        reps: 0,
        lapses: 0,
        stepIndex: 2,
        due: new Date(),
        lastReview: null,
      };

      vi.mocked(prisma.studentCardState.findUnique).mockResolvedValue(existingState as any);
      vi.mocked(prisma.studentCardState.update).mockResolvedValue({} as any);

      const result = await fsrsService.updateCardState(
        "user-1",
        "card-1",
        Rating.AGAIN,
        5000
      );

      // Should stay in LEARNING with reset steps
      expect(result.newState).toBe("LEARNING");
      expect(result.stepsRemaining).toBe(3); // Reset to learningSteps
    });

    it("should move to RELEARNING on lapse (incorrect in REVIEW)", async () => {
      const existingState = {
        id: "state-1",
        state: "REVIEW",
        stability: 10,
        difficulty: 5,
        elapsedDays: 5,
        scheduledDays: 10,
        reps: 5,
        lapses: 0,
        stepIndex: 0,
        due: new Date(),
        lastReview: new Date(),
      };

      vi.mocked(prisma.studentCardState.findUnique).mockResolvedValue(existingState as any);
      vi.mocked(prisma.studentCardState.update).mockResolvedValue({} as any);

      const result = await fsrsService.updateCardState(
        "user-1",
        "card-1",
        Rating.AGAIN,
        5000
      );

      expect(result.newState).toBe("RELEARNING");
      expect(result.stepsRemaining).toBe(2); // relearningSteps
    });

    it("should require reviewSteps correct answers before scheduling next review", async () => {
      const existingState = {
        id: "state-1",
        state: "REVIEW",
        stability: 10,
        difficulty: 5,
        elapsedDays: 5,
        scheduledDays: 10,
        reps: 5,
        lapses: 0,
        stepIndex: 0, // First review step
        due: new Date(),
        lastReview: new Date(),
      };

      vi.mocked(prisma.studentCardState.findUnique).mockResolvedValue(existingState as any);
      vi.mocked(prisma.studentCardState.update).mockResolvedValue({} as any);

      const result = await fsrsService.updateCardState(
        "user-1",
        "card-1",
        Rating.GOOD,
        5000
      );

      // With reviewSteps=2, first correct answer should keep state as REVIEW
      // with 1 step remaining
      expect(result.newState).toBe("REVIEW");
      expect(result.stepsRemaining).toBe(1);
    });

    it("should apply FSRS scheduling after all review steps completed", async () => {
      const existingState = {
        id: "state-1",
        state: "REVIEW",
        stability: 10,
        difficulty: 5,
        elapsedDays: 5,
        scheduledDays: 10,
        reps: 5,
        lapses: 0,
        stepIndex: 1, // Last review step (reviewSteps=2)
        due: new Date(),
        lastReview: new Date(),
      };

      vi.mocked(prisma.studentCardState.findUnique).mockResolvedValue(existingState as any);
      vi.mocked(prisma.studentCardState.update).mockResolvedValue({} as any);

      const result = await fsrsService.updateCardState(
        "user-1",
        "card-1",
        Rating.GOOD,
        5000
      );

      // Should complete review steps and schedule next review
      expect(result.newState).toBe("REVIEW");
      expect(result.stepsRemaining).toBe(2); // Reset for next session
    });

    it("should return to REVIEW after completing relearning steps", async () => {
      const existingState = {
        id: "state-1",
        state: "RELEARNING",
        stability: 5,
        difficulty: 5,
        elapsedDays: 5,
        scheduledDays: 10,
        reps: 5,
        lapses: 1,
        stepIndex: 1, // Last relearning step (relearningSteps=2)
        due: new Date(),
        lastReview: new Date(),
      };

      vi.mocked(prisma.studentCardState.findUnique).mockResolvedValue(existingState as any);
      vi.mocked(prisma.studentCardState.update).mockResolvedValue({} as any);

      const result = await fsrsService.updateCardState(
        "user-1",
        "card-1",
        Rating.GOOD,
        5000
      );

      expect(result.newState).toBe("REVIEW");
    });
  });

  describe("undoLastReview", () => {
    it("should return failure when nothing to undo", async () => {
      vi.mocked(prisma.undoableReview.findUnique).mockResolvedValue(null);

      const result = await fsrsService.undoLastReview("user-1");

      expect(result.success).toBe(false);
      expect(result.message).toBe("Nothing to undo");
    });

    it("should restore previous state on undo", async () => {
      const undoable = {
        id: "undo-1",
        userId: "user-1",
        reviewLogId: "log-1",
        cardId: "card-1",
        prevState: "LEARNING",
        prevStability: 0,
        prevDifficulty: 0,
        prevElapsedDays: 0,
        prevScheduledDays: 0,
        prevReps: 0,
        prevLapses: 0,
        prevStepIndex: 1,
        prevDue: new Date(),
        prevLastReview: null,
        wasNew: false,
      };

      vi.mocked(prisma.undoableReview.findUnique).mockResolvedValue(undoable as any);
      vi.mocked(prisma.reviewLog.delete).mockResolvedValue({} as any);
      vi.mocked(prisma.studentCardState.update).mockResolvedValue({} as any);
      vi.mocked(prisma.undoableReview.delete).mockResolvedValue({} as any);

      const result = await fsrsService.undoLastReview("user-1");

      expect(result.success).toBe(true);
      expect(prisma.studentCardState.update).toHaveBeenCalled();
    });

    it("should delete StudentCardState if wasNew is true", async () => {
      const undoable = {
        id: "undo-1",
        userId: "user-1",
        reviewLogId: "log-1",
        cardId: "card-1",
        prevState: "NEW",
        prevStability: 0,
        prevDifficulty: 0,
        prevElapsedDays: 0,
        prevScheduledDays: 0,
        prevReps: 0,
        prevLapses: 0,
        prevStepIndex: 0,
        prevDue: new Date(),
        prevLastReview: null,
        wasNew: true,
      };

      vi.mocked(prisma.undoableReview.findUnique).mockResolvedValue(undoable as any);
      vi.mocked(prisma.reviewLog.delete).mockResolvedValue({} as any);
      vi.mocked(prisma.studentCardState.delete).mockResolvedValue({} as any);
      vi.mocked(prisma.undoableReview.delete).mockResolvedValue({} as any);

      const result = await fsrsService.undoLastReview("user-1");

      expect(result.success).toBe(true);
      expect(prisma.studentCardState.delete).toHaveBeenCalled();
    });
  });

  describe("getNextCard", () => {
    it("should return null for empty curriculum", async () => {
      vi.mocked(prisma.curriculum.findUnique).mockResolvedValue(null);

      const result = await fsrsService.getNextCard("user-1", "curriculum-1");

      expect(result).toBeNull();
    });

    it("should return new cards before due cards", async () => {
      const mockCurriculum = {
        id: "curriculum-1",
        curriculumSubjects: [
          {
            subject: {
              id: "subject-1",
              name: "Math",
              cardSubjects: [
                {
                  cardId: "card-1",
                  position: 0,
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
                },
              ],
              prerequisites: [],
            },
          },
        ],
      };

      vi.mocked(prisma.curriculum.findUnique).mockResolvedValue(mockCurriculum as any);
      vi.mocked(prisma.studentCardState.findMany).mockResolvedValue([]);

      const result = await fsrsService.getNextCard("user-1", "curriculum-1");

      expect(result).not.toBeNull();
      expect(result?.isNew).toBe(true);
      expect(result?.cardId).toBe("card-1");
    });

    it("should return due cards sorted by due date", async () => {
      const now = new Date();
      const earlier = new Date(now.getTime() - 3600000);
      const later = new Date(now.getTime() - 1800000);

      const mockCurriculum = {
        id: "curriculum-1",
        curriculumSubjects: [
          {
            subject: {
              id: "subject-1",
              name: "Math",
              cardSubjects: [
                {
                  cardId: "card-1",
                  position: 0,
                  card: {
                    id: "card-1",
                    name: "Card 1",
                    functionSource: "function generate() {}",
                    answerType: "INTEGER",
                    learningSteps: 5,
                    relearningSteps: 3,
                    reviewSteps: 1,
                    description: "Test",
                  },
                },
                {
                  cardId: "card-2",
                  position: 1,
                  card: {
                    id: "card-2",
                    name: "Card 2",
                    functionSource: "function generate() {}",
                    answerType: "INTEGER",
                    learningSteps: 5,
                    relearningSteps: 3,
                    reviewSteps: 1,
                    description: "Test",
                  },
                },
              ],
              prerequisites: [],
            },
          },
        ],
      };

      const mockStates = [
        { cardId: "card-1", state: "REVIEW", due: later, stepIndex: 0 },
        { cardId: "card-2", state: "REVIEW", due: earlier, stepIndex: 0 },
      ];

      vi.mocked(prisma.curriculum.findUnique).mockResolvedValue(mockCurriculum as any);
      vi.mocked(prisma.studentCardState.findMany).mockResolvedValue(mockStates as any);

      const result = await fsrsService.getNextCard("user-1", "curriculum-1");

      expect(result).not.toBeNull();
      expect(result?.cardId).toBe("card-2"); // Earlier due date comes first
    });

    it("should include step progress information", async () => {
      const mockCurriculum = {
        id: "curriculum-1",
        curriculumSubjects: [
          {
            subject: {
              id: "subject-1",
              name: "Math",
              cardSubjects: [
                {
                  cardId: "card-1",
                  position: 0,
                  card: {
                    id: "card-1",
                    name: "Card 1",
                    functionSource: "function generate() {}",
                    answerType: "INTEGER",
                    learningSteps: 5,
                    relearningSteps: 3,
                    reviewSteps: 2,
                    description: "Test",
                  },
                },
              ],
              prerequisites: [],
            },
          },
        ],
      };

      const mockStates = [
        {
          cardId: "card-1",
          state: "LEARNING",
          due: new Date(Date.now() - 1000),
          stepIndex: 2,
        },
      ];

      vi.mocked(prisma.curriculum.findUnique).mockResolvedValue(mockCurriculum as any);
      vi.mocked(prisma.studentCardState.findMany).mockResolvedValue(mockStates as any);

      const result = await fsrsService.getNextCard("user-1", "curriculum-1");

      expect(result).not.toBeNull();
      expect(result?.currentStep).toBe(2);
      expect(result?.requiredSteps).toBe(5); // learningSteps for LEARNING state
    });
  });
});
