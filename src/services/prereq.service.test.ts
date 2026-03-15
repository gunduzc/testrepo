/**
 * PrerequisiteService Tests
 * Tests prerequisite checking, mastery calculation, and enforcement levels
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { prereqService } from "./prereq.service";
import prisma from "@/lib/prisma";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  default: {
    subject: {
      findUnique: vi.fn(),
    },
    curriculum: {
      findUnique: vi.fn(),
    },
    studentCardState: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

// Mock instance config
vi.mock("@/lib/instance-config", () => ({
  getPrereqEnforcement: vi.fn(() => "hard"),
}));

import { getPrereqEnforcement } from "@/lib/instance-config";

describe("PrerequisiteService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getEnforcementLevel", () => {
    it("should return enforcement level from config", () => {
      vi.mocked(getPrereqEnforcement).mockReturnValue("soft");

      const level = prereqService.getEnforcementLevel();

      expect(level).toBe("soft");
    });
  });

  describe("getSubjectMastery", () => {
    it("should return 1 for empty subject (no cards)", async () => {
      vi.mocked(prisma.subject.findUnique).mockResolvedValue({
        id: "subj-1",
        cardSubjects: [],
      } as any);

      const mastery = await prereqService.getSubjectMastery("user-1", "subj-1");

      expect(mastery).toBe(1); // Empty subjects are considered mastered
    });

    it("should return 0 for subject with no mastered cards", async () => {
      vi.mocked(prisma.subject.findUnique).mockResolvedValue({
        id: "subj-1",
        cardSubjects: [
          { cardId: "card-1" },
          { cardId: "card-2" },
        ],
      } as any);
      vi.mocked(prisma.studentCardState.count).mockResolvedValue(0);

      const mastery = await prereqService.getSubjectMastery("user-1", "subj-1");

      expect(mastery).toBe(0);
    });

    it("should calculate correct mastery percentage", async () => {
      vi.mocked(prisma.subject.findUnique).mockResolvedValue({
        id: "subj-1",
        cardSubjects: [
          { cardId: "card-1" },
          { cardId: "card-2" },
          { cardId: "card-3" },
          { cardId: "card-4" },
        ],
      } as any);
      vi.mocked(prisma.studentCardState.count).mockResolvedValue(3); // 3 out of 4 mastered

      const mastery = await prereqService.getSubjectMastery("user-1", "subj-1");

      expect(mastery).toBe(0.75);
    });

    it("should return 1 for nonexistent subject", async () => {
      vi.mocked(prisma.subject.findUnique).mockResolvedValue(null);

      const mastery = await prereqService.getSubjectMastery("user-1", "nonexistent");

      expect(mastery).toBe(1);
    });

    it("should only count cards in REVIEW state with high stability", async () => {
      vi.mocked(prisma.subject.findUnique).mockResolvedValue({
        id: "subj-1",
        cardSubjects: [{ cardId: "card-1" }],
      } as any);

      await prereqService.getSubjectMastery("user-1", "subj-1");

      expect(prisma.studentCardState.count).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          cardId: { in: ["card-1"] },
          state: "REVIEW",
          stability: { gt: 10 }, // STABILITY_THRESHOLD
        },
      });
    });
  });

  describe("checkSubjectPrereqs", () => {
    it("should throw for nonexistent subject", async () => {
      vi.mocked(prisma.subject.findUnique).mockResolvedValue(null);

      await expect(
        prereqService.checkSubjectPrereqs("user-1", "nonexistent")
      ).rejects.toThrow("Subject not found");
    });

    it("should return unlocked if no prerequisites", async () => {
      vi.mocked(prisma.subject.findUnique).mockResolvedValue({
        id: "subj-1",
        name: "Basics",
        prerequisites: [],
      } as any);

      const status = await prereqService.checkSubjectPrereqs("user-1", "subj-1");

      expect(status.isUnlocked).toBe(true);
      expect(status.missingPrereqs).toHaveLength(0);
    });

    it("should return locked if prerequisites not met", async () => {
      vi.mocked(prisma.subject.findUnique)
        .mockResolvedValueOnce({
          id: "subj-2",
          name: "Advanced",
          prerequisites: [
            {
              prerequisiteId: "subj-1",
              prerequisite: { name: "Basics" },
            },
          ],
        } as any)
        .mockResolvedValueOnce({
          id: "subj-1",
          cardSubjects: [{ cardId: "card-1" }],
        } as any);

      vi.mocked(prisma.studentCardState.count).mockResolvedValue(0); // Not mastered

      const status = await prereqService.checkSubjectPrereqs("user-1", "subj-2");

      expect(status.isUnlocked).toBe(false);
      expect(status.missingPrereqs).toHaveLength(1);
      expect(status.missingPrereqs[0].subjectName).toBe("Basics");
      expect(status.missingPrereqs[0].completionPercentage).toBe(0);
    });

    it("should return unlocked if prerequisites met (80% mastery)", async () => {
      vi.mocked(prisma.subject.findUnique)
        .mockResolvedValueOnce({
          id: "subj-2",
          name: "Advanced",
          prerequisites: [
            {
              prerequisiteId: "subj-1",
              prerequisite: { name: "Basics" },
            },
          ],
        } as any)
        .mockResolvedValueOnce({
          id: "subj-1",
          cardSubjects: [
            { cardId: "card-1" },
            { cardId: "card-2" },
            { cardId: "card-3" },
            { cardId: "card-4" },
            { cardId: "card-5" },
          ],
        } as any);

      vi.mocked(prisma.studentCardState.count).mockResolvedValue(4); // 80% mastered

      const status = await prereqService.checkSubjectPrereqs("user-1", "subj-2");

      expect(status.isUnlocked).toBe(true);
    });
  });

  describe("validateSubjectAccess", () => {
    beforeEach(() => {
      vi.mocked(prisma.subject.findUnique).mockResolvedValue({
        id: "subj-1",
        name: "Test Subject",
        prerequisites: [],
      } as any);
    });

    it("should allow access when unlocked", async () => {
      const result = await prereqService.validateSubjectAccess("user-1", "subj-1");

      expect(result.allowed).toBe(true);
    });

    it("should block access with hard enforcement", async () => {
      vi.mocked(getPrereqEnforcement).mockReturnValue("hard");
      vi.mocked(prisma.subject.findUnique)
        .mockResolvedValueOnce({
          id: "subj-2",
          name: "Advanced",
          prerequisites: [
            {
              prerequisiteId: "subj-1",
              prerequisite: { name: "Basics" },
            },
          ],
        } as any)
        .mockResolvedValueOnce({
          id: "subj-1",
          cardSubjects: [{ cardId: "card-1" }],
        } as any);
      vi.mocked(prisma.studentCardState.count).mockResolvedValue(0);

      const result = await prereqService.validateSubjectAccess("user-1", "subj-2");

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Complete prerequisites first");
      expect(result.enforcement).toBe("hard");
    });

    it("should allow access with warning in soft enforcement", async () => {
      vi.mocked(getPrereqEnforcement).mockReturnValue("soft");
      vi.mocked(prisma.subject.findUnique)
        .mockResolvedValueOnce({
          id: "subj-2",
          name: "Advanced",
          prerequisites: [
            {
              prerequisiteId: "subj-1",
              prerequisite: { name: "Basics" },
            },
          ],
        } as any)
        .mockResolvedValueOnce({
          id: "subj-1",
          cardSubjects: [{ cardId: "card-1" }],
        } as any);
      vi.mocked(prisma.studentCardState.count).mockResolvedValue(0);

      const result = await prereqService.validateSubjectAccess("user-1", "subj-2");

      expect(result.allowed).toBe(true);
      expect(result.reason).toContain("Recommended prerequisites not completed");
      expect(result.enforcement).toBe("soft");
    });

    it("should allow access without warning in none enforcement", async () => {
      vi.mocked(getPrereqEnforcement).mockReturnValue("none");
      vi.mocked(prisma.subject.findUnique)
        .mockResolvedValueOnce({
          id: "subj-2",
          name: "Advanced",
          prerequisites: [
            {
              prerequisiteId: "subj-1",
              prerequisite: { name: "Basics" },
            },
          ],
        } as any)
        .mockResolvedValueOnce({
          id: "subj-1",
          cardSubjects: [{ cardId: "card-1" }],
        } as any);
      vi.mocked(prisma.studentCardState.count).mockResolvedValue(0);

      const result = await prereqService.validateSubjectAccess("user-1", "subj-2");

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(result.enforcement).toBe("none");
    });
  });

  describe("getCurriculumPrereqStatus", () => {
    it("should throw for nonexistent curriculum", async () => {
      vi.mocked(prisma.curriculum.findUnique).mockResolvedValue(null);

      await expect(
        prereqService.getCurriculumPrereqStatus("user-1", "nonexistent")
      ).rejects.toThrow("Curriculum not found");
    });

    it("should categorize blocked vs warning subjects based on enforcement", async () => {
      vi.mocked(getPrereqEnforcement).mockReturnValue("hard");
      vi.mocked(prisma.curriculum.findUnique).mockResolvedValue({
        id: "curr-1",
        curriculumSubjects: [
          {
            subject: {
              id: "subj-1",
              name: "Basics",
              prerequisites: [],
              cardSubjects: [{ cardId: "card-1" }],
            },
          },
          {
            subject: {
              id: "subj-2",
              name: "Advanced",
              prerequisites: [
                { prerequisiteId: "subj-1", prerequisite: { name: "Basics" } },
              ],
              cardSubjects: [{ cardId: "card-2" }],
            },
          },
        ],
      } as any);
      vi.mocked(prisma.studentCardState.findMany).mockResolvedValue([]);

      const status = await prereqService.getCurriculumPrereqStatus("user-1", "curr-1");

      expect(status.enforcement).toBe("hard");
      expect(status.blockedSubjects).toHaveLength(1);
      expect(status.blockedSubjects[0].subjectName).toBe("Advanced");
    });

    it("should handle subjects with no cards as mastered", async () => {
      vi.mocked(getPrereqEnforcement).mockReturnValue("hard");
      vi.mocked(prisma.curriculum.findUnique).mockResolvedValue({
        id: "curr-1",
        curriculumSubjects: [
          {
            subject: {
              id: "subj-1",
              name: "Empty Subject",
              prerequisites: [],
              cardSubjects: [], // No cards
            },
          },
          {
            subject: {
              id: "subj-2",
              name: "Depends on Empty",
              prerequisites: [
                { prerequisiteId: "subj-1", prerequisite: { name: "Empty Subject" } },
              ],
              cardSubjects: [{ cardId: "card-1" }],
            },
          },
        ],
      } as any);
      vi.mocked(prisma.studentCardState.findMany).mockResolvedValue([]);

      const status = await prereqService.getCurriculumPrereqStatus("user-1", "curr-1");

      // The subject depending on empty subject should be unlocked
      expect(status.subjects[1].isUnlocked).toBe(true);
    });
  });

  describe("getUnlockedSubjects", () => {
    it("should return only unlocked subject IDs", async () => {
      vi.mocked(getPrereqEnforcement).mockReturnValue("hard");
      vi.mocked(prisma.curriculum.findUnique).mockResolvedValue({
        id: "curr-1",
        curriculumSubjects: [
          {
            subject: {
              id: "subj-1",
              name: "Basics",
              prerequisites: [],
              cardSubjects: [],
            },
          },
          {
            subject: {
              id: "subj-2",
              name: "Advanced",
              prerequisites: [
                { prerequisiteId: "subj-1", prerequisite: { name: "Basics" } },
              ],
              cardSubjects: [{ cardId: "card-1" }],
            },
          },
        ],
      } as any);
      vi.mocked(prisma.studentCardState.findMany).mockResolvedValue([]);

      const unlocked = await prereqService.getUnlockedSubjects("user-1", "curr-1");

      // subj-1 is unlocked (no prereqs), subj-2 is unlocked (prereq is empty subject = mastered)
      expect(unlocked).toContain("subj-1");
      expect(unlocked).toContain("subj-2");
    });
  });
});
