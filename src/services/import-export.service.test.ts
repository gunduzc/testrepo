/**
 * ImportExportService Tests
 * Tests JSON import/export functionality
 *
 * NOTE: Some tests may fail due to edge cases in the current implementation!
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { importExportService } from "./import-export.service";
import prisma from "@/lib/prisma";
import { sandboxService } from "./sandbox.service";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  default: {
    card: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    subject: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    curriculum: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    curriculumSubject: {
      create: vi.fn(),
    },
    cardSubject: {
      create: vi.fn(),
    },
    subjectPrerequisite: {
      create: vi.fn(),
    },
    $transaction: vi.fn((fn) => fn(prisma)),
  },
}));

// Mock sandbox service
vi.mock("./sandbox.service", () => ({
  sandboxService: {
    executeCard: vi.fn(),
  },
}));

describe("ImportExportService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("exportCard", () => {
    it("should export card with valid tags JSON", async () => {
      vi.mocked(prisma.card.findUnique).mockResolvedValue({
        id: "card-1",
        name: "Test Card",
        description: "A test card",
        functionSource: "function generate() {}",
        answerType: "INTEGER",
        learningSteps: 5,
        relearningSteps: 3,
        reviewSteps: 1,
        tags: '["math", "basic"]', // Valid JSON
      } as any);

      const result = await importExportService.exportCard("card-1");

      expect(result).not.toBeNull();
      expect(result!.data.name).toBe("Test Card");
      expect(result!.data.tags).toEqual(["math", "basic"]);
    });

    it("should return null for nonexistent card", async () => {
      vi.mocked(prisma.card.findUnique).mockResolvedValue(null);

      const result = await importExportService.exportCard("nonexistent");

      expect(result).toBeNull();
    });

    // BUG TEST: This test WILL FAIL because exportCard uses JSON.parse
    // without error handling - if tags contains invalid JSON, it throws!
    it("should handle card with invalid tags JSON gracefully", async () => {
      vi.mocked(prisma.card.findUnique).mockResolvedValue({
        id: "card-1",
        name: "Bad Tags Card",
        description: "A card with invalid tags",
        functionSource: "function generate() {}",
        answerType: "INTEGER",
        learningSteps: 5,
        relearningSteps: 3,
        reviewSteps: 1,
        tags: "not valid json", // Invalid JSON - will cause JSON.parse to throw!
      } as any);

      // This SHOULD gracefully handle the error, but currently it throws
      // The test expects it to either return null or return empty tags array
      const result = await importExportService.exportCard("card-1");

      expect(result).not.toBeNull();
      // If we get here without throwing, tags should be empty or handled gracefully
      expect(Array.isArray(result!.data.tags)).toBe(true);
    });

    it("should handle card with null tags", async () => {
      vi.mocked(prisma.card.findUnique).mockResolvedValue({
        id: "card-1",
        name: "Null Tags Card",
        description: "A card with null tags",
        functionSource: "function generate() {}",
        answerType: "INTEGER",
        learningSteps: 5,
        relearningSteps: 3,
        reviewSteps: 1,
        tags: null, // Null tags - JSON.parse(null) throws!
      } as any);

      // This SHOULD handle null gracefully
      const result = await importExportService.exportCard("card-1");

      expect(result).not.toBeNull();
    });
  });

  describe("exportSubject", () => {
    it("should export subject with cards", async () => {
      vi.mocked(prisma.subject.findUnique).mockResolvedValue({
        id: "subj-1",
        name: "Math Basics",
        description: "Basic math",
        cardSubjects: [
          {
            card: {
              name: "Addition",
              description: "Add numbers",
              functionSource: "function generate() {}",
              answerType: "INTEGER",
              learningSteps: 5,
              relearningSteps: 3,
              tags: "[]",
            },
          },
        ],
      } as any);

      const result = await importExportService.exportSubject("subj-1");

      expect(result).not.toBeNull();
      expect(result!.type).toBe("subject");
      expect(result!.data.name).toBe("Math Basics");
      expect(result!.data.cards).toHaveLength(1);
    });

    it("should return null for nonexistent subject", async () => {
      vi.mocked(prisma.subject.findUnique).mockResolvedValue(null);

      const result = await importExportService.exportSubject("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("exportCurriculum", () => {
    it("should export curriculum with subjects and prerequisites", async () => {
      vi.mocked(prisma.curriculum.findUnique).mockResolvedValue({
        id: "curr-1",
        name: "Complete Math",
        description: "Full math curriculum",
        curriculumSubjects: [
          {
            subject: {
              id: "subj-1",
              name: "Basics",
              description: "Fundamentals",
              cardSubjects: [],
              prerequisites: [],
            },
          },
          {
            subject: {
              id: "subj-2",
              name: "Advanced",
              description: "Advanced topics",
              cardSubjects: [],
              prerequisites: [{ prerequisiteId: "subj-1" }],
            },
          },
        ],
      } as any);

      const result = await importExportService.exportCurriculum("curr-1");

      expect(result).not.toBeNull();
      expect(result!.type).toBe("curriculum");
      expect(result!.data.subjects).toHaveLength(2);
      expect(result!.data.prerequisites).toHaveLength(1);
      expect(result!.data.prerequisites[0]).toEqual({
        subjectId: "subj-2",
        prerequisiteId: "subj-1",
      });
    });
  });

  describe("importCard", () => {
    it("should import valid card", async () => {
      vi.mocked(sandboxService.executeCard).mockResolvedValue({
        success: true,
        output: {
          question: "2+2?",
          answer: { correct: "4", type: "INTEGER" },
          solution: "4",
        },
      });
      vi.mocked(prisma.subject.findUnique).mockResolvedValue({ id: "subj-1" } as any);
      vi.mocked(prisma.card.create).mockResolvedValue({ id: "card-new" } as any);
      vi.mocked(prisma.cardSubject.create).mockResolvedValue({} as any);

      const result = await importExportService.importCard(
        {
          version: "1.0",
          type: "card",
          data: {
            name: "Test Card",
            description: "Test",
            functionSource: "function generate() { return { question: '2+2?', answer: { correct: '4', type: 'INTEGER' }, solution: '4' }; }",
            answerType: "INTEGER",
            learningSteps: 5,
            relearningSteps: 3,
            tags: [],
          },
        },
        "subj-1",
        0,
        "user-1"
      );

      expect(result.success).toBe(true);
      expect(result.data?.cardId).toBe("card-new");
    });

    it("should reject invalid version", async () => {
      const result = await importExportService.importCard(
        {
          version: "2.0",
          type: "card",
          data: {} as any,
        },
        "subj-1",
        0,
        "user-1"
      );

      expect(result.success).toBe(false);
      expect(result.errors![0].code).toBe("INVALID_JSON");
    });

    it("should reject invalid card function", async () => {
      vi.mocked(sandboxService.executeCard).mockResolvedValue({
        success: false,
        error: {
          type: "SyntaxError",
          message: "Unexpected token",
        },
      });

      const result = await importExportService.importCard(
        {
          version: "1.0",
          type: "card",
          data: {
            name: "Bad Card",
            description: "Test",
            functionSource: "invalid javascript {{{",
            answerType: "INTEGER",
            learningSteps: 5,
            relearningSteps: 3,
            tags: [],
          },
        },
        "subj-1",
        0,
        "user-1"
      );

      expect(result.success).toBe(false);
      expect(result.errors![0].code).toBe("INVALID_CARD");
    });

    it("should reject missing required fields", async () => {
      const result = await importExportService.importCard(
        {
          version: "1.0",
          type: "card",
          data: {
            name: "",
            description: "Test",
            functionSource: "",
            answerType: "" as any,
            learningSteps: 5,
            relearningSteps: 3,
            tags: [],
          },
        },
        "subj-1",
        0,
        "user-1"
      );

      expect(result.success).toBe(false);
      expect(result.errors![0].code).toBe("MISSING_FIELD");
    });

    it("should reject if target subject not found", async () => {
      vi.mocked(sandboxService.executeCard).mockResolvedValue({
        success: true,
        output: {} as any,
      });
      vi.mocked(prisma.subject.findUnique).mockResolvedValue(null);

      const result = await importExportService.importCard(
        {
          version: "1.0",
          type: "card",
          data: {
            name: "Test",
            description: "Test",
            functionSource: "function generate() {}",
            answerType: "INTEGER",
            learningSteps: 5,
            relearningSteps: 3,
            tags: [],
          },
        },
        "nonexistent",
        0,
        "user-1"
      );

      expect(result.success).toBe(false);
      expect(result.errors![0].code).toBe("VALIDATION_ERROR");
    });
  });

  describe("importCurriculum", () => {
    it("should import valid curriculum", async () => {
      vi.mocked(sandboxService.executeCard).mockResolvedValue({
        success: true,
        output: {} as any,
      });
      vi.mocked(prisma.curriculum.create).mockResolvedValue({ id: "curr-new" } as any);
      vi.mocked(prisma.subject.create).mockResolvedValue({ id: "subj-new" } as any);
      vi.mocked(prisma.curriculumSubject.create).mockResolvedValue({} as any);
      vi.mocked(prisma.card.create).mockResolvedValue({ id: "card-new" } as any);
      vi.mocked(prisma.cardSubject.create).mockResolvedValue({} as any);
      vi.mocked(prisma.subjectPrerequisite.create).mockResolvedValue({} as any);

      const result = await importExportService.importCurriculum(
        {
          version: "1.0",
          type: "curriculum",
          data: {
            name: "Math 101",
            description: "Basic math",
            subjects: [
              {
                id: "old-subj-1",
                name: "Basics",
                description: "Fundamentals",
                cards: [
                  {
                    name: "Addition",
                    description: "Add numbers",
                    functionSource: "function generate() {}",
                    answerType: "INTEGER",
                    learningSteps: 5,
                    relearningSteps: 3,
                    tags: [],
                  },
                ],
              },
            ],
            prerequisites: [],
          },
        },
        "user-1"
      );

      expect(result.success).toBe(true);
      expect(result.data?.curriculumId).toBe("curr-new");
    });

    it("should detect cycles in prerequisites", async () => {
      const result = await importExportService.importCurriculum(
        {
          version: "1.0",
          type: "curriculum",
          data: {
            name: "Cyclic Curriculum",
            subjects: [
              { id: "subj-1", name: "A", cards: [] },
              { id: "subj-2", name: "B", cards: [] },
            ],
            prerequisites: [
              { subjectId: "subj-1", prerequisiteId: "subj-2" },
              { subjectId: "subj-2", prerequisiteId: "subj-1" }, // Creates cycle!
            ],
          },
        },
        "user-1"
      );

      expect(result.success).toBe(false);
      expect(result.errors!.some((e) => e.code === "DAG_CYCLE")).toBe(true);
    });

    it("should reject invalid prerequisite references", async () => {
      const result = await importExportService.importCurriculum(
        {
          version: "1.0",
          type: "curriculum",
          data: {
            name: "Bad Prereqs",
            subjects: [{ id: "subj-1", name: "A", cards: [] }],
            prerequisites: [
              { subjectId: "subj-1", prerequisiteId: "nonexistent" }, // Invalid reference
            ],
          },
        },
        "user-1"
      );

      expect(result.success).toBe(false);
      expect(result.errors![0].code).toBe("VALIDATION_ERROR");
    });

    it("should reject missing curriculum name", async () => {
      const result = await importExportService.importCurriculum(
        {
          version: "1.0",
          type: "curriculum",
          data: {
            name: "", // Empty name
            subjects: [],
            prerequisites: [],
          },
        },
        "user-1"
      );

      expect(result.success).toBe(false);
      expect(result.errors![0].code).toBe("MISSING_FIELD");
    });

    it("should validate all card functions before import", async () => {
      vi.mocked(sandboxService.executeCard)
        .mockResolvedValueOnce({ success: true, output: {} as any })
        .mockResolvedValueOnce({
          success: false,
          error: { type: "SyntaxError", message: "Bad syntax" },
        });

      const result = await importExportService.importCurriculum(
        {
          version: "1.0",
          type: "curriculum",
          data: {
            name: "Mixed Cards",
            subjects: [
              {
                id: "subj-1",
                name: "Subject",
                cards: [
                  {
                    name: "Good Card",
                    description: "Works",
                    functionSource: "function generate() {}",
                    answerType: "INTEGER",
                    learningSteps: 5,
                    relearningSteps: 3,
                    tags: [],
                  },
                  {
                    name: "Bad Card",
                    description: "Broken",
                    functionSource: "broken {{{",
                    answerType: "INTEGER",
                    learningSteps: 5,
                    relearningSteps: 3,
                    tags: [],
                  },
                ],
              },
            ],
            prerequisites: [],
          },
        },
        "user-1"
      );

      expect(result.success).toBe(false);
      expect(result.errors!.some((e) => e.code === "INVALID_CARD")).toBe(true);
    });
  });

  describe("importSubject", () => {
    it("should import valid subject", async () => {
      vi.mocked(sandboxService.executeCard).mockResolvedValue({
        success: true,
        output: {} as any,
      });
      vi.mocked(prisma.curriculum.findUnique).mockResolvedValue({ id: "curr-1" } as any);
      vi.mocked(prisma.subject.create).mockResolvedValue({ id: "subj-new" } as any);
      vi.mocked(prisma.curriculumSubject.create).mockResolvedValue({} as any);
      vi.mocked(prisma.card.create).mockResolvedValue({ id: "card-new" } as any);
      vi.mocked(prisma.cardSubject.create).mockResolvedValue({} as any);

      const result = await importExportService.importSubject(
        {
          version: "1.0",
          type: "subject",
          data: {
            name: "New Subject",
            description: "A new subject",
            cards: [
              {
                name: "Card 1",
                description: "First card",
                functionSource: "function generate() {}",
                answerType: "INTEGER",
                learningSteps: 5,
                relearningSteps: 3,
                tags: [],
              },
            ],
          },
        },
        "curr-1",
        "user-1"
      );

      expect(result.success).toBe(true);
      expect(result.data?.subjectId).toBe("subj-new");
    });

    it("should reject invalid subject format", async () => {
      const result = await importExportService.importSubject(
        {
          version: "1.0",
          type: "card", // Wrong type!
          data: {} as any,
        },
        "curr-1",
        "user-1"
      );

      expect(result.success).toBe(false);
      expect(result.errors![0].code).toBe("INVALID_JSON");
    });

    it("should reject missing subject name", async () => {
      const result = await importExportService.importSubject(
        {
          version: "1.0",
          type: "subject",
          data: {
            name: "", // Empty name
            cards: [],
          },
        },
        "curr-1",
        "user-1"
      );

      expect(result.success).toBe(false);
      expect(result.errors![0].code).toBe("MISSING_FIELD");
    });

    it("should reject if target curriculum not found", async () => {
      vi.mocked(prisma.curriculum.findUnique).mockResolvedValue(null);

      const result = await importExportService.importSubject(
        {
          version: "1.0",
          type: "subject",
          data: {
            name: "Test Subject",
            cards: [],
          },
        },
        "nonexistent",
        "user-1"
      );

      expect(result.success).toBe(false);
      expect(result.errors![0].code).toBe("VALIDATION_ERROR");
    });
  });
});
