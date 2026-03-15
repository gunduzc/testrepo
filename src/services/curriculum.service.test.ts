/**
 * CurriculumService Tests
 * Tests curriculum management, DAG validation, and authorization
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { curriculumService } from "./curriculum.service";
import prisma from "@/lib/prisma";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  default: {
    curriculum: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    subject: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    curriculumSubject: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    cardSubject: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      updateMany: vi.fn(),
      aggregate: vi.fn(),
    },
    card: {
      findUnique: vi.fn(),
    },
    subjectPrerequisite: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    userCurriculumEnrollment: {
      upsert: vi.fn(),
    },
    classEnrollment: {
      count: vi.fn(),
    },
    curriculumAssignment: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn((fn) => fn(prisma)),
  },
}));

// Mock instance config
vi.mock("@/lib/instance-config", () => ({
  getInstanceMode: vi.fn(() => "community"),
  canBrowseLibrary: vi.fn(() => true),
}));

describe("CurriculumService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createCurriculum", () => {
    it("should create curriculum with name and description", async () => {
      vi.mocked(prisma.curriculum.create).mockResolvedValue({
        id: "curr-1",
        name: "Math 101",
        description: "Basic math",
        authorId: "user-1",
      } as any);

      const result = await curriculumService.createCurriculum(
        { name: "Math 101", description: "Basic math" },
        "user-1"
      );

      expect(result.id).toBe("curr-1");
      expect(result.name).toBe("Math 101");
      expect(prisma.curriculum.create).toHaveBeenCalledWith({
        data: {
          name: "Math 101",
          description: "Basic math",
          authorId: "user-1",
        },
      });
    });

    it("should create curriculum without description", async () => {
      vi.mocked(prisma.curriculum.create).mockResolvedValue({
        id: "curr-1",
        name: "Science",
        authorId: "user-1",
      } as any);

      const result = await curriculumService.createCurriculum(
        { name: "Science" },
        "user-1"
      );

      expect(result.name).toBe("Science");
    });
  });

  describe("updateCurriculum", () => {
    it("should update curriculum if user is author", async () => {
      vi.mocked(prisma.curriculum.findUnique).mockResolvedValue({
        authorId: "user-1",
      } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        role: "EDUCATOR",
      } as any);
      vi.mocked(prisma.curriculum.update).mockResolvedValue({
        id: "curr-1",
        name: "Updated Name",
      } as any);

      const result = await curriculumService.updateCurriculum(
        "curr-1",
        { name: "Updated Name" },
        "user-1"
      );

      expect(result.name).toBe("Updated Name");
    });

    it("should allow admin to update any curriculum", async () => {
      vi.mocked(prisma.curriculum.findUnique).mockResolvedValue({
        authorId: "other-user",
      } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        role: "ADMIN",
      } as any);
      vi.mocked(prisma.curriculum.update).mockResolvedValue({
        id: "curr-1",
        name: "Admin Updated",
      } as any);

      const result = await curriculumService.updateCurriculum(
        "curr-1",
        { name: "Admin Updated" },
        "admin-user"
      );

      expect(result.name).toBe("Admin Updated");
    });

    it("should throw if curriculum not found", async () => {
      vi.mocked(prisma.curriculum.findUnique).mockResolvedValue(null);

      await expect(
        curriculumService.updateCurriculum("nonexistent", { name: "Test" }, "user-1")
      ).rejects.toThrow("Curriculum not found");
    });

    it("should throw if user is not authorized", async () => {
      vi.mocked(prisma.curriculum.findUnique).mockResolvedValue({
        authorId: "other-user",
      } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        role: "EDUCATOR",
      } as any);

      await expect(
        curriculumService.updateCurriculum("curr-1", { name: "Test" }, "user-1")
      ).rejects.toThrow("Not authorized to update this curriculum");
    });
  });

  describe("deleteCurriculum", () => {
    it("should soft-delete curriculum", async () => {
      vi.mocked(prisma.curriculum.findUnique).mockResolvedValue({
        authorId: "user-1",
      } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        role: "EDUCATOR",
      } as any);
      vi.mocked(prisma.curriculum.update).mockResolvedValue({} as any);

      await curriculumService.deleteCurriculum("curr-1", "user-1");

      expect(prisma.curriculum.update).toHaveBeenCalledWith({
        where: { id: "curr-1" },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it("should throw if curriculum already deleted", async () => {
      vi.mocked(prisma.curriculum.findUnique).mockResolvedValue(null);

      await expect(
        curriculumService.deleteCurriculum("curr-1", "user-1")
      ).rejects.toThrow("Curriculum not found");
    });
  });

  describe("addSubject", () => {
    it("should add subject to curriculum", async () => {
      vi.mocked(prisma.curriculum.findUnique).mockResolvedValue({
        authorId: "user-1",
      } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        role: "EDUCATOR",
      } as any);
      vi.mocked(prisma.subject.create).mockResolvedValue({
        id: "subj-1",
        name: "Algebra",
      } as any);
      vi.mocked(prisma.curriculumSubject.create).mockResolvedValue({} as any);

      const result = await curriculumService.addSubject(
        "curr-1",
        { name: "Algebra", description: "Linear algebra basics" },
        "user-1"
      );

      expect(result.id).toBe("subj-1");
      expect(result.name).toBe("Algebra");
    });

    it("should throw if curriculum not found", async () => {
      vi.mocked(prisma.curriculum.findUnique).mockResolvedValue(null);

      await expect(
        curriculumService.addSubject("nonexistent", { name: "Test" }, "user-1")
      ).rejects.toThrow("Curriculum not found");
    });
  });

  describe("addPrerequisite", () => {
    it("should reject self-prerequisite", async () => {
      await expect(
        curriculumService.addPrerequisite("subj-1", "subj-1", "user-1")
      ).rejects.toThrow("A subject cannot be its own prerequisite");
    });

    it("should reject if prerequisite already exists", async () => {
      vi.mocked(prisma.curriculumSubject.findFirst).mockResolvedValue({
        curriculumId: "curr-1",
        curriculum: { authorId: "user-1" },
      } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        role: "EDUCATOR",
      } as any);
      vi.mocked(prisma.subjectPrerequisite.findUnique).mockResolvedValue({
        id: "existing",
      } as any);

      await expect(
        curriculumService.addPrerequisite("subj-1", "subj-2", "user-1")
      ).rejects.toThrow("Prerequisite relationship already exists");
    });

    it("should reject if prerequisite not in same curriculum", async () => {
      vi.mocked(prisma.curriculumSubject.findFirst)
        .mockResolvedValueOnce({
          curriculumId: "curr-1",
          curriculum: { authorId: "user-1" },
        } as any)
        .mockResolvedValueOnce(null); // prereq not in curriculum
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        role: "EDUCATOR",
      } as any);
      vi.mocked(prisma.subjectPrerequisite.findUnique).mockResolvedValue(null);

      await expect(
        curriculumService.addPrerequisite("subj-1", "subj-2", "user-1")
      ).rejects.toThrow("Prerequisite subject not in same curriculum");
    });
  });

  describe("addCardToSubject", () => {
    it("should add card to subject", async () => {
      vi.mocked(prisma.curriculumSubject.findFirst).mockResolvedValue({
        curriculumId: "curr-1",
        curriculum: { authorId: "user-1" },
      } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        role: "EDUCATOR",
      } as any);
      vi.mocked(prisma.card.findUnique).mockResolvedValue({
        id: "card-1",
      } as any);
      vi.mocked(prisma.cardSubject.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.cardSubject.aggregate).mockResolvedValue({
        _max: { position: 2 },
      } as any);
      vi.mocked(prisma.cardSubject.create).mockResolvedValue({} as any);

      await curriculumService.addCardToSubject("subj-1", "card-1", "user-1");

      expect(prisma.cardSubject.create).toHaveBeenCalledWith({
        data: {
          cardId: "card-1",
          subjectId: "subj-1",
          position: 3, // max + 1
        },
      });
    });

    it("should reject if card already in subject", async () => {
      vi.mocked(prisma.curriculumSubject.findFirst).mockResolvedValue({
        curriculumId: "curr-1",
        curriculum: { authorId: "user-1" },
      } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        role: "EDUCATOR",
      } as any);
      vi.mocked(prisma.card.findUnique).mockResolvedValue({
        id: "card-1",
      } as any);
      vi.mocked(prisma.cardSubject.findUnique).mockResolvedValue({
        id: "existing",
      } as any);

      await expect(
        curriculumService.addCardToSubject("subj-1", "card-1", "user-1")
      ).rejects.toThrow("Card already in subject");
    });

    it("should reject if card not found", async () => {
      vi.mocked(prisma.curriculumSubject.findFirst).mockResolvedValue({
        curriculumId: "curr-1",
        curriculum: { authorId: "user-1" },
      } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        role: "EDUCATOR",
      } as any);
      vi.mocked(prisma.card.findUnique).mockResolvedValue(null);

      await expect(
        curriculumService.addCardToSubject("subj-1", "nonexistent", "user-1")
      ).rejects.toThrow("Card not found");
    });
  });

  describe("validateDAG", () => {
    it("should return valid for curriculum without cycles", async () => {
      vi.mocked(prisma.curriculum.findUnique).mockResolvedValue({
        id: "curr-1",
        curriculumSubjects: [
          {
            subjectId: "subj-1",
            subject: { prerequisites: [] },
          },
          {
            subjectId: "subj-2",
            subject: { prerequisites: [{ prerequisiteId: "subj-1" }] },
          },
          {
            subjectId: "subj-3",
            subject: { prerequisites: [{ prerequisiteId: "subj-2" }] },
          },
        ],
      } as any);

      const result = await curriculumService.validateDAG("curr-1");

      expect(result.valid).toBe(true);
    });

    it("should detect simple cycle", async () => {
      vi.mocked(prisma.curriculum.findUnique).mockResolvedValue({
        id: "curr-1",
        curriculumSubjects: [
          {
            subjectId: "subj-1",
            subject: { prerequisites: [{ prerequisiteId: "subj-2" }] },
          },
          {
            subjectId: "subj-2",
            subject: { prerequisites: [{ prerequisiteId: "subj-1" }] },
          },
        ],
      } as any);

      const result = await curriculumService.validateDAG("curr-1");

      expect(result.valid).toBe(false);
      expect(result.cyclePath).toBeDefined();
    });

    it("should return invalid for nonexistent curriculum", async () => {
      vi.mocked(prisma.curriculum.findUnique).mockResolvedValue(null);

      const result = await curriculumService.validateDAG("nonexistent");

      expect(result.valid).toBe(false);
    });
  });

  describe("listByAuthor", () => {
    it("should return curricula with pagination", async () => {
      vi.mocked(prisma.curriculum.findMany).mockResolvedValue([
        { id: "curr-1", name: "Math", description: null },
        { id: "curr-2", name: "Science", description: "Physics" },
      ] as any);
      vi.mocked(prisma.curriculum.count).mockResolvedValue(2);

      const result = await curriculumService.listByAuthor("user-1", {
        limit: 10,
        offset: 0,
      });

      expect(result.curricula).toHaveLength(2);
      expect(result.total).toBe(2);
    });
  });

  describe("enrollUser", () => {
    it("should enroll user in curriculum", async () => {
      vi.mocked(prisma.curriculum.findUnique).mockResolvedValue({
        id: "curr-1",
      } as any);
      vi.mocked(prisma.userCurriculumEnrollment.upsert).mockResolvedValue({} as any);

      await curriculumService.enrollUser("curr-1", "user-1");

      expect(prisma.userCurriculumEnrollment.upsert).toHaveBeenCalled();
    });

    it("should throw if curriculum not found", async () => {
      vi.mocked(prisma.curriculum.findUnique).mockResolvedValue(null);

      await expect(
        curriculumService.enrollUser("nonexistent", "user-1")
      ).rejects.toThrow("Curriculum not found");
    });
  });
});
