/**
 * CurriculumService - Curriculum and subject management with DAG validation
 */

import prisma from "@/lib/prisma";
import {
  CreateCurriculumDTO,
  UpdateCurriculumDTO,
  CreateSubjectDTO,
  UpdateSubjectDTO,
  CurriculumWithStructure,
  DAGValidationResult,
  SubjectWithDetails,
} from "@/lib/types";
import { getInstanceMode, canBrowseLibrary } from "@/lib/instance-config";

export class CurriculumService {
  /**
   * Creates a new curriculum
   * Note: Visibility is determined by INSTANCE_MODE, not per-curriculum
   */
  async createCurriculum(
    data: CreateCurriculumDTO,
    authorId: string
  ): Promise<{ id: string; name: string }> {
    const curriculum = await prisma.curriculum.create({
      data: {
        name: data.name,
        description: data.description,
        authorId,
      },
    });

    return { id: curriculum.id, name: curriculum.name };
  }

  /**
   * Updates curriculum metadata
   */
  async updateCurriculum(
    curriculumId: string,
    data: UpdateCurriculumDTO,
    userId: string
  ): Promise<{ id: string; name: string }> {
    const existing = await prisma.curriculum.findUnique({
      where: { id: curriculumId },
      select: { authorId: true },
    });

    if (!existing) {
      throw new Error("Curriculum not found");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (existing.authorId !== userId && user?.role !== "ADMIN") {
      throw new Error("Not authorized to update this curriculum");
    }

    const curriculum = await prisma.curriculum.update({
      where: { id: curriculumId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
      },
    });

    return { id: curriculum.id, name: curriculum.name };
  }

  /**
   * Soft-deletes a curriculum
   */
  async deleteCurriculum(curriculumId: string, userId: string): Promise<void> {
    const existing = await prisma.curriculum.findUnique({
      where: { id: curriculumId, deletedAt: null },
      select: { authorId: true },
    });

    if (!existing) {
      throw new Error("Curriculum not found");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (existing.authorId !== userId && user?.role !== "ADMIN") {
      throw new Error("Not authorized to delete this curriculum");
    }

    await prisma.curriculum.update({
      where: { id: curriculumId },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Adds a new subject to a curriculum
   */
  async addSubject(
    curriculumId: string,
    data: CreateSubjectDTO,
    userId: string
  ): Promise<{ id: string; name: string }> {
    // Verify curriculum ownership
    const curriculum = await prisma.curriculum.findUnique({
      where: { id: curriculumId },
      select: { authorId: true },
    });

    if (!curriculum) {
      throw new Error("Curriculum not found");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (curriculum.authorId !== userId && user?.role !== "ADMIN") {
      throw new Error("Not authorized to modify this curriculum");
    }

    // Create subject and link to curriculum
    const subject = await prisma.$transaction(async (tx) => {
      const subject = await tx.subject.create({
        data: {
          name: data.name,
          description: data.description,
          authorId: userId, // Subject author is the user creating it
        },
      });

      await tx.curriculumSubject.create({
        data: {
          curriculumId,
          subjectId: subject.id,
        },
      });

      return subject;
    });

    return { id: subject.id, name: subject.name };
  }

  /**
   * Updates a subject
   */
  async updateSubject(
    subjectId: string,
    data: UpdateSubjectDTO,
    userId: string
  ): Promise<{ id: string; name: string }> {
    const existingSubject = await prisma.subject.findUnique({
      where: { id: subjectId, deletedAt: null },
      select: { authorId: true },
    });

    if (!existingSubject) {
      throw new Error("Subject not found");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (existingSubject.authorId !== userId && user?.role !== "ADMIN") {
      throw new Error("Not authorized to modify this subject");
    }

    const subject = await prisma.subject.update({
      where: { id: subjectId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
      },
    });

    // Handle card reordering if cardIds provided
    if (data.cardIds) {
      await this.reorderCards(subjectId, data.cardIds);
    }

    return { id: subject.id, name: subject.name };
  }

  /**
   * Adds a prerequisite relationship between subjects
   * Validates that no cycle is created
   */
  async addPrerequisite(
    subjectId: string,
    prerequisiteId: string,
    userId: string
  ): Promise<void> {
    if (subjectId === prerequisiteId) {
      throw new Error("A subject cannot be its own prerequisite");
    }

    // Check authorization via any curriculum containing the subject
    const subjectCurricula = await prisma.curriculumSubject.findFirst({
      where: { subjectId },
      include: { curriculum: true },
    });

    if (!subjectCurricula) {
      throw new Error("Subject not found in any curriculum");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (subjectCurricula.curriculum.authorId !== userId && user?.role !== "ADMIN") {
      throw new Error("Not authorized to modify prerequisites");
    }

    // Check if prerequisite exists in same curriculum
    const prereqInCurriculum = await prisma.curriculumSubject.findFirst({
      where: {
        curriculumId: subjectCurricula.curriculumId,
        subjectId: prerequisiteId,
      },
    });

    if (!prereqInCurriculum) {
      throw new Error("Prerequisite subject not in same curriculum");
    }

    // Check for existing relationship
    const existing = await prisma.subjectPrerequisite.findUnique({
      where: {
        subjectId_prerequisiteId: { subjectId, prerequisiteId },
      },
    });

    if (existing) {
      throw new Error("Prerequisite relationship already exists");
    }

    // Validate no cycle would be created
    const wouldCreateCycle = await this.wouldCreateCycle(
      subjectCurricula.curriculumId,
      subjectId,
      prerequisiteId
    );

    if (wouldCreateCycle) {
      throw new Error("Adding this prerequisite would create a cycle");
    }

    await prisma.subjectPrerequisite.create({
      data: { subjectId, prerequisiteId },
    });
  }

  /**
   * Removes a prerequisite relationship
   */
  async removePrerequisite(
    subjectId: string,
    prerequisiteId: string,
    userId: string
  ): Promise<void> {
    const subjectCurricula = await prisma.curriculumSubject.findFirst({
      where: { subjectId },
      include: { curriculum: true },
    });

    if (!subjectCurricula) {
      throw new Error("Subject not found");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (subjectCurricula.curriculum.authorId !== userId && user?.role !== "ADMIN") {
      throw new Error("Not authorized to modify prerequisites");
    }

    await prisma.subjectPrerequisite.delete({
      where: {
        subjectId_prerequisiteId: { subjectId, prerequisiteId },
      },
    });
  }

  /**
   * Reorders cards within a subject
   */
  async reorderCards(subjectId: string, cardIds: string[]): Promise<void> {
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < cardIds.length; i++) {
        await tx.cardSubject.updateMany({
          where: { cardId: cardIds[i], subjectId },
          data: { position: i },
        });
      }
    });
  }

  /**
   * Adds a card to a subject
   */
  async addCardToSubject(
    subjectId: string,
    cardId: string,
    userId: string,
    position?: number
  ): Promise<void> {
    // Check authorization
    const subjectCurricula = await prisma.curriculumSubject.findFirst({
      where: { subjectId },
      include: { curriculum: true },
    });

    if (!subjectCurricula) {
      throw new Error("Subject not found in any curriculum");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (subjectCurricula.curriculum.authorId !== userId && user?.role !== "ADMIN") {
      throw new Error("Not authorized to modify this subject");
    }

    // Check if card exists
    const card = await prisma.card.findUnique({ where: { id: cardId } });
    if (!card) {
      throw new Error("Card not found");
    }

    // Check if already in subject
    const existing = await prisma.cardSubject.findUnique({
      where: { cardId_subjectId: { cardId, subjectId } },
    });

    if (existing) {
      throw new Error("Card already in subject");
    }

    // Get max position if not specified
    const maxPosition = position ?? (
      await prisma.cardSubject.aggregate({
        where: { subjectId },
        _max: { position: true },
      })
    )._max.position ?? -1;

    await prisma.cardSubject.create({
      data: {
        cardId,
        subjectId,
        position: position ?? maxPosition + 1,
      },
    });
  }

  /**
   * Removes a card from a subject
   */
  async removeCardFromSubject(
    subjectId: string,
    cardId: string,
    userId: string
  ): Promise<void> {
    // Check authorization
    const subjectCurricula = await prisma.curriculumSubject.findFirst({
      where: { subjectId },
      include: { curriculum: true },
    });

    if (!subjectCurricula) {
      throw new Error("Subject not found in any curriculum");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (subjectCurricula.curriculum.authorId !== userId && user?.role !== "ADMIN") {
      throw new Error("Not authorized to modify this subject");
    }

    await prisma.cardSubject.delete({
      where: { cardId_subjectId: { cardId, subjectId } },
    });
  }

  /**
   * Soft-deletes a subject
   */
  async deleteSubject(subjectId: string, userId: string): Promise<void> {
    // Check authorization
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId, deletedAt: null },
      select: { authorId: true },
    });

    if (!subject) {
      throw new Error("Subject not found");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (subject.authorId !== userId && user?.role !== "ADMIN") {
      throw new Error("Not authorized to delete this subject");
    }

    // Soft delete the subject
    await prisma.subject.update({
      where: { id: subjectId },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Validates the DAG structure of a curriculum
   * Uses Kahn's algorithm to detect cycles
   */
  async validateDAG(curriculumId: string): Promise<DAGValidationResult> {
    const curriculum = await prisma.curriculum.findUnique({
      where: { id: curriculumId },
      include: {
        curriculumSubjects: {
          include: {
            subject: {
              include: { prerequisites: true },
            },
          },
        },
      },
    });

    if (!curriculum) {
      return { valid: false, cyclePath: [] };
    }

    const subjectIds = curriculum.curriculumSubjects.map((cs) => cs.subjectId);
    const subjectSet = new Set(subjectIds);

    // Build adjacency list and in-degree map
    const adjList = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    for (const id of subjectIds) {
      adjList.set(id, []);
      inDegree.set(id, 0);
    }

    for (const cs of curriculum.curriculumSubjects) {
      for (const prereq of cs.subject.prerequisites) {
        if (subjectSet.has(prereq.prerequisiteId)) {
          adjList.get(prereq.prerequisiteId)!.push(cs.subjectId);
          inDegree.set(cs.subjectId, inDegree.get(cs.subjectId)! + 1);
        }
      }
    }

    // Kahn's algorithm
    const queue: string[] = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) queue.push(id);
    }

    let processed = 0;
    while (queue.length > 0) {
      const current = queue.shift()!;
      processed++;

      for (const neighbor of adjList.get(current)!) {
        const newDegree = inDegree.get(neighbor)! - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) queue.push(neighbor);
      }
    }

    if (processed !== subjectIds.length) {
      // Cycle detected - find the cycle path
      const cyclePath = this.findCyclePath(adjList, inDegree);
      return { valid: false, cyclePath };
    }

    return { valid: true };
  }

  /**
   * Gets curriculum with full structure
   */
  async getCurriculumWithStructure(
    curriculumId: string
  ): Promise<CurriculumWithStructure | null> {
    const curriculum = await prisma.curriculum.findUnique({
      where: { id: curriculumId, deletedAt: null },
      include: {
        curriculumSubjects: {
          where: { subject: { deletedAt: null } },
          include: {
            subject: {
              include: {
                cardSubjects: {
                  where: { card: { deletedAt: null } },
                  include: { card: true },
                  orderBy: { position: "asc" },
                },
                prerequisites: true,
                prerequisiteOf: true,
              },
            },
          },
        },
      },
    });

    if (!curriculum) return null;

    const subjects: SubjectWithDetails[] = curriculum.curriculumSubjects.map((cs) => ({
      id: cs.subject.id,
      name: cs.subject.name,
      description: cs.subject.description,
      cards: cs.subject.cardSubjects.map((ccs) => ({
        cardId: ccs.cardId,
        position: ccs.position,
        card: {
          id: ccs.card.id,
          name: ccs.card.name,
          description: ccs.card.description,
          answerType: ccs.card.answerType,
        },
      })),
      prerequisites: cs.subject.prerequisites.map((p) => p.prerequisiteId),
      dependents: cs.subject.prerequisiteOf.map((p) => p.subjectId),
    }));

    return {
      id: curriculum.id,
      name: curriculum.name,
      description: curriculum.description,
      authorId: curriculum.authorId,
      subjects,
    };
  }

  /**
   * Lists browsable curricula for the library
   * In community/publisher modes: all non-deleted curricula
   * In school mode: only assigned curricula for students
   */
  async listBrowsableCurricula(
    userId: string,
    userRole: string,
    options?: {
      limit?: number;
      offset?: number;
      search?: string;
    }
  ): Promise<{
    curricula: { id: string; name: string; description: string | null; authorId: string }[];
    total: number;
  }> {
    const mode = getInstanceMode();

    // Check if user has class enrollment (for school mode)
    const hasClassEnrollment = await prisma.classEnrollment.count({
      where: { userId },
    }) > 0;

    // In school mode, students only see assigned curricula
    if (mode === "school" && !canBrowseLibrary(userRole, hasClassEnrollment)) {
      // Get curricula assigned to user's classes
      const assignedCurricula = await prisma.curriculum.findMany({
        where: {
          deletedAt: null,
          assignments: {
            some: {
              class: {
                enrollments: {
                  some: { userId },
                },
              },
            },
          },
          ...(options?.search && {
            OR: [
              { name: { contains: options.search } },
              { description: { contains: options.search } },
            ],
          }),
        },
        select: {
          id: true,
          name: true,
          description: true,
          authorId: true,
        },
        take: options?.limit,
        skip: options?.offset,
        orderBy: { createdAt: "desc" },
      });

      const total = await prisma.curriculum.count({
        where: {
          deletedAt: null,
          assignments: {
            some: {
              class: {
                enrollments: {
                  some: { userId },
                },
              },
            },
          },
        },
      });

      return { curricula: assignedCurricula, total };
    }

    // Community/publisher modes: all curricula are browsable
    const where = {
      deletedAt: null,
      ...(options?.search && {
        OR: [
          { name: { contains: options.search } },
          { description: { contains: options.search } },
        ],
      }),
    };

    const [curricula, total] = await Promise.all([
      prisma.curriculum.findMany({
        where,
        select: {
          id: true,
          name: true,
          description: true,
          authorId: true,
        },
        take: options?.limit,
        skip: options?.offset,
        orderBy: { createdAt: "desc" },
      }),
      prisma.curriculum.count({ where }),
    ]);

    return { curricula, total };
  }

  /**
   * Lists curricula by author
   */
  async listByAuthor(
    authorId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<{
    curricula: { id: string; name: string; description: string | null }[];
    total: number;
  }> {
    const [curricula, total] = await Promise.all([
      prisma.curriculum.findMany({
        where: { authorId, deletedAt: null },
        select: {
          id: true,
          name: true,
          description: true,
        },
        take: options?.limit,
        skip: options?.offset,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.curriculum.count({ where: { authorId, deletedAt: null } }),
    ]);

    return { curricula, total };
  }

  /**
   * Enrolls a user in a curriculum
   * In community/publisher modes: anyone can enroll in any curriculum
   * In school mode: students can only enroll in assigned curricula
   */
  async enrollUser(curriculumId: string, userId: string): Promise<void> {
    const curriculum = await prisma.curriculum.findUnique({
      where: { id: curriculumId, deletedAt: null },
    });

    if (!curriculum) {
      throw new Error("Curriculum not found");
    }

    const mode = getInstanceMode();

    // In school mode, verify the curriculum is assigned to user's class
    if (mode === "school") {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      // Educators/admins can enroll in anything
      if (user?.role !== "EDUCATOR" && user?.role !== "ADMIN") {
        const isAssigned = await prisma.curriculumAssignment.findFirst({
          where: {
            curriculumId,
            class: {
              enrollments: {
                some: { userId },
              },
            },
          },
        });

        if (!isAssigned) {
          throw new Error("Curriculum not assigned to your class");
        }
      }
    }

    // Use upsert to handle already enrolled case
    await prisma.userCurriculumEnrollment.upsert({
      where: { userId_curriculumId: { userId, curriculumId } },
      create: { userId, curriculumId },
      update: {}, // No-op if already exists
    });
  }

  // Private helper methods

  private async wouldCreateCycle(
    curriculumId: string,
    subjectId: string,
    newPrereqId: string
  ): Promise<boolean> {
    // DFS to check if adding newPrereqId as prereq of subjectId creates a cycle
    const curriculum = await prisma.curriculum.findUnique({
      where: { id: curriculumId },
      include: {
        curriculumSubjects: {
          include: {
            subject: {
              include: { prerequisites: true },
            },
          },
        },
      },
    });

    if (!curriculum) return true;

    // Build current prerequisite graph
    const prereqMap = new Map<string, Set<string>>();
    for (const cs of curriculum.curriculumSubjects) {
      const prereqs = new Set(cs.subject.prerequisites.map((p) => p.prerequisiteId));
      prereqMap.set(cs.subjectId, prereqs);
    }

    // Add the proposed edge
    prereqMap.get(subjectId)?.add(newPrereqId);

    // DFS from newPrereqId to see if we can reach subjectId (which would mean cycle)
    const visited = new Set<string>();
    const stack = [newPrereqId];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === subjectId) return true;
      if (visited.has(current)) continue;
      visited.add(current);

      const prereqs = prereqMap.get(current);
      if (prereqs) {
        for (const prereq of prereqs) {
          stack.push(prereq);
        }
      }
    }

    return false;
  }

  private findCyclePath(
    adjList: Map<string, string[]>,
    inDegree: Map<string, number>
  ): string[] {
    // Find nodes still in cycle (in-degree > 0 after Kahn's)
    const inCycle = Array.from(inDegree.entries())
      .filter(([_, d]) => d > 0)
      .map(([id]) => id);

    if (inCycle.length === 0) return [];

    // Simple path finding from first cycle node
    const start = inCycle[0];
    const path = [start];
    const visited = new Set([start]);
    let current = start;

    while (true) {
      const neighbors = adjList.get(current) || [];
      const nextInCycle = neighbors.find(
        (n) => inDegree.get(n)! > 0 && !visited.has(n)
      );

      if (!nextInCycle) {
        // Check if we can close the cycle
        if (neighbors.includes(start)) {
          path.push(start);
        }
        break;
      }

      path.push(nextInCycle);
      visited.add(nextInCycle);
      current = nextInCycle;
    }

    return path;
  }
}

// Singleton instance
export const curriculumService = new CurriculumService();
