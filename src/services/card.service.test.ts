import { describe, it, expect, beforeEach, vi } from "vitest";
import { cardService } from "./card.service";
import prisma from "@/lib/prisma";
import { sandboxService } from "./sandbox.service";

// Mock dependencies
vi.mock("@/lib/prisma", () => ({
  default: {
    card: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    cardAuthoringHistory: {
      create: vi.fn(),
    },
    cardSubject: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("./sandbox.service", () => ({
  sandboxService: {
    executeCard: vi.fn(),
    testCard: vi.fn(),
  },
}));

describe("CardService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("create", () => {
    const validSource = `
      function generate() {
        return {
          question: "What is 2+2?",
          answer: { correct: "4", type: "INTEGER" },
          solution: "2+2=4"
        };
      }
    `;

    const createDTO = {
      functionSource: validSource,
      name: "Addition Card",
      description: "Basic addition",
      answerType: "INTEGER" as const,
    };

    it("should create a card with valid source", async () => {
      vi.mocked(sandboxService.executeCard).mockResolvedValue({
        success: true,
        output: {
          question: "What is 2+2?",
          answer: { correct: "4", type: "INTEGER" },
          solution: "2+2=4",
        },
      });

      const mockCard = { id: "card-1", name: "Addition Card" };
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        return fn({
          card: {
            create: vi.fn().mockResolvedValue(mockCard),
          },
          cardAuthoringHistory: {
            create: vi.fn(),
          },
          cardSubject: {
            create: vi.fn(),
            findFirst: vi.fn(),
          },
        });
      });

      const result = await cardService.create(createDTO, "author-1");

      expect(sandboxService.executeCard).toHaveBeenCalledWith(validSource);
      expect(result.id).toBe("card-1");
      expect(result.name).toBe("Addition Card");
    });

    it("should throw error for invalid card source", async () => {
      vi.mocked(sandboxService.executeCard).mockResolvedValue({
        success: false,
        error: {
          type: "SyntaxError",
          message: "Unexpected token",
        },
      });

      await expect(cardService.create(createDTO, "author-1")).rejects.toThrow(
        "Invalid card function"
      );
    });

    it("should use default learningSteps and relearningSteps", async () => {
      vi.mocked(sandboxService.executeCard).mockResolvedValue({
        success: true,
        output: {
          question: "Test",
          answer: { correct: "1", type: "INTEGER" },
          solution: "test",
        },
      });

      let createdData: any;
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        return fn({
          card: {
            create: vi.fn().mockImplementation((args) => {
              createdData = args.data;
              return { id: "card-1", name: "Test" };
            }),
          },
          cardAuthoringHistory: { create: vi.fn() },
          cardSubject: { create: vi.fn(), findFirst: vi.fn() },
        });
      });

      await cardService.create(createDTO, "author-1");

      expect(createdData.learningSteps).toBe(5);
      expect(createdData.relearningSteps).toBe(3);
      expect(createdData.reviewSteps).toBe(1);
    });

    it("should use custom step values when provided", async () => {
      vi.mocked(sandboxService.executeCard).mockResolvedValue({
        success: true,
        output: {
          question: "Test",
          answer: { correct: "1", type: "INTEGER" },
          solution: "test",
        },
      });

      let createdData: any;
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        return fn({
          card: {
            create: vi.fn().mockImplementation((args) => {
              createdData = args.data;
              return { id: "card-1", name: "Test" };
            }),
          },
          cardAuthoringHistory: { create: vi.fn() },
          cardSubject: { create: vi.fn(), findFirst: vi.fn() },
        });
      });

      await cardService.create(
        {
          ...createDTO,
          learningSteps: 10,
          relearningSteps: 5,
          reviewSteps: 3,
        },
        "author-1"
      );

      expect(createdData.learningSteps).toBe(10);
      expect(createdData.relearningSteps).toBe(5);
      expect(createdData.reviewSteps).toBe(3);
    });

    it("should create authoring history when provided", async () => {
      vi.mocked(sandboxService.executeCard).mockResolvedValue({
        success: true,
        output: {
          question: "Test",
          answer: { correct: "1", type: "INTEGER" },
          solution: "test",
        },
      });

      let historyCreated = false;
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        return fn({
          card: {
            create: vi.fn().mockResolvedValue({ id: "card-1", name: "Test" }),
          },
          cardAuthoringHistory: {
            create: vi.fn().mockImplementation(() => {
              historyCreated = true;
            }),
          },
          cardSubject: { create: vi.fn(), findFirst: vi.fn() },
        });
      });

      await cardService.create(
        {
          ...createDTO,
          authoringHistory: [
            { type: "prompt", content: "Create a math card", timestamp: new Date().toISOString() },
          ],
        },
        "author-1"
      );

      expect(historyCreated).toBe(true);
    });

    it("should add card to subject when subjectId provided", async () => {
      vi.mocked(sandboxService.executeCard).mockResolvedValue({
        success: true,
        output: {
          question: "Test",
          answer: { correct: "1", type: "INTEGER" },
          solution: "test",
        },
      });

      let cardSubjectCreated = false;
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        return fn({
          card: {
            create: vi.fn().mockResolvedValue({ id: "card-1", name: "Test" }),
          },
          cardAuthoringHistory: { create: vi.fn() },
          cardSubject: {
            create: vi.fn().mockImplementation(() => {
              cardSubjectCreated = true;
            }),
            findFirst: vi.fn().mockResolvedValue({ position: 5 }),
          },
        });
      });

      await cardService.create(
        {
          ...createDTO,
          subjectId: "subject-1",
        },
        "author-1"
      );

      expect(cardSubjectCreated).toBe(true);
    });
  });

  describe("update", () => {
    it("should update card when user is author", async () => {
      vi.mocked(prisma.card.findUnique).mockResolvedValue({
        authorId: "user-1",
      } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        role: "STUDENT",
      } as any);
      vi.mocked(prisma.card.update).mockResolvedValue({
        id: "card-1",
        name: "Updated Card",
      } as any);

      const result = await cardService.update(
        "card-1",
        { name: "Updated Card" },
        "user-1"
      );

      expect(result.name).toBe("Updated Card");
    });

    it("should update card when user is admin", async () => {
      vi.mocked(prisma.card.findUnique).mockResolvedValue({
        authorId: "other-user",
      } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        role: "ADMIN",
      } as any);
      vi.mocked(prisma.card.update).mockResolvedValue({
        id: "card-1",
        name: "Updated Card",
      } as any);

      const result = await cardService.update(
        "card-1",
        { name: "Updated Card" },
        "admin-user"
      );

      expect(result.name).toBe("Updated Card");
    });

    it("should throw error when card not found", async () => {
      vi.mocked(prisma.card.findUnique).mockResolvedValue(null);

      await expect(
        cardService.update("card-1", { name: "Updated" }, "user-1")
      ).rejects.toThrow("Card not found");
    });

    it("should throw error when user not authorized", async () => {
      vi.mocked(prisma.card.findUnique).mockResolvedValue({
        authorId: "other-user",
      } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        role: "STUDENT",
      } as any);

      await expect(
        cardService.update("card-1", { name: "Updated" }, "user-1")
      ).rejects.toThrow("Not authorized");
    });

    it("should validate new source when updating functionSource", async () => {
      vi.mocked(prisma.card.findUnique).mockResolvedValue({
        authorId: "user-1",
      } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        role: "STUDENT",
      } as any);
      vi.mocked(sandboxService.executeCard).mockResolvedValue({
        success: false,
        error: { type: "SyntaxError", message: "Invalid" },
      });

      await expect(
        cardService.update(
          "card-1",
          { functionSource: "invalid code" },
          "user-1"
        )
      ).rejects.toThrow("Invalid card function");
    });

    it("should update reviewSteps", async () => {
      vi.mocked(prisma.card.findUnique).mockResolvedValue({
        authorId: "user-1",
      } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        role: "STUDENT",
      } as any);

      let updatedData: any;
      vi.mocked(prisma.card.update).mockImplementation((args: any) => {
        updatedData = args.data;
        return Promise.resolve({ id: "card-1", name: "Test" } as any);
      });

      await cardService.update("card-1", { reviewSteps: 5 }, "user-1");

      expect(updatedData.reviewSteps).toBe(5);
    });
  });

  describe("delete", () => {
    it("should delete card when user is author", async () => {
      vi.mocked(prisma.card.findUnique).mockResolvedValue({
        authorId: "user-1",
      } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        role: "STUDENT",
      } as any);
      vi.mocked(prisma.card.delete).mockResolvedValue({} as any);

      await cardService.delete("card-1", "user-1");

      expect(prisma.card.delete).toHaveBeenCalledWith({
        where: { id: "card-1" },
      });
    });

    it("should delete card when user is admin", async () => {
      vi.mocked(prisma.card.findUnique).mockResolvedValue({
        authorId: "other-user",
      } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        role: "ADMIN",
      } as any);
      vi.mocked(prisma.card.delete).mockResolvedValue({} as any);

      await cardService.delete("card-1", "admin-user");

      expect(prisma.card.delete).toHaveBeenCalled();
    });

    it("should throw error when card not found", async () => {
      vi.mocked(prisma.card.findUnique).mockResolvedValue(null);

      await expect(cardService.delete("card-1", "user-1")).rejects.toThrow(
        "Card not found"
      );
    });

    it("should throw error when user not authorized", async () => {
      vi.mocked(prisma.card.findUnique).mockResolvedValue({
        authorId: "other-user",
      } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        role: "STUDENT",
      } as any);

      await expect(cardService.delete("card-1", "user-1")).rejects.toThrow(
        "Not authorized"
      );
    });
  });

  describe("getById", () => {
    it("should return card with parsed tags", async () => {
      vi.mocked(prisma.card.findUnique).mockResolvedValue({
        id: "card-1",
        name: "Test Card",
        description: "A test card",
        functionSource: "function generate() {}",
        answerType: "INTEGER",
        learningSteps: 5,
        relearningSteps: 3,
        reviewSteps: 1,
        tags: '["math", "addition"]',
        authorId: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const result = await cardService.getById("card-1");

      expect(result).not.toBeNull();
      expect(result?.tags).toEqual(["math", "addition"]);
    });

    it("should return null when card not found", async () => {
      vi.mocked(prisma.card.findUnique).mockResolvedValue(null);

      const result = await cardService.getById("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("testFunction", () => {
    it("should return sandbox test results", async () => {
      const mockResults = [
        {
          success: true,
          output: {
            question: "Q1",
            answer: { correct: "1", type: "INTEGER" },
            solution: "s1",
          },
        },
        {
          success: true,
          output: {
            question: "Q2",
            answer: { correct: "2", type: "INTEGER" },
            solution: "s2",
          },
        },
      ];

      vi.mocked(sandboxService.testCard).mockResolvedValue(mockResults as any);

      const results = await cardService.testFunction("function generate() {}", 2);

      expect(sandboxService.testCard).toHaveBeenCalledWith(
        "function generate() {}",
        2
      );
      expect(results).toHaveLength(2);
    });
  });

  describe("getByAuthor", () => {
    it("should return cards by author with pagination", async () => {
      vi.mocked(prisma.card.findMany).mockResolvedValue([
        { id: "card-1", name: "Card 1", description: "Desc 1", answerType: "INTEGER" },
        { id: "card-2", name: "Card 2", description: "Desc 2", answerType: "TEXT" },
      ] as any);
      vi.mocked(prisma.card.count).mockResolvedValue(10);

      const result = await cardService.getByAuthor("user-1", {
        limit: 2,
        offset: 0,
      });

      expect(result.cards).toHaveLength(2);
      expect(result.total).toBe(10);
    });
  });

  describe("search", () => {
    it("should search cards by query", async () => {
      vi.mocked(prisma.card.findMany).mockResolvedValue([
        { id: "card-1", name: "Math Card", description: "Addition", authorId: "user-1" },
      ] as any);
      vi.mocked(prisma.card.count).mockResolvedValue(1);

      const result = await cardService.search("math", { limit: 10, offset: 0 });

      expect(result.cards).toHaveLength(1);
      expect(result.cards[0].name).toBe("Math Card");
    });
  });
});
