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

export class CurriculumService {
  /**
   * Creates a new curriculum
   */
  async createCurriculum(
    data: CreateCurriculumDTO,
    authorId: string
  ): Promise<{ id: string; name: string }> {
    const curriculum = await prisma.curriculum.create({
      data: {
        name: data.name,
        description: data.description,
        isPublic: data.isPublic ?? false,
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
        ...(data.isPublic !== undefined && { isPublic: data.isPublic }),
      },
    });

    return { id: curriculum.id, name: curriculum.name };
  }

  /**
   * Deletes a curriculum
   */
  async deleteCurriculum(curriculumId: string, userId: string): Promise<void> {
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
      throw new Error("Not authorized to delete this curriculum");
    }

    await prisma.curriculum.delete({ where: { id: curriculumId } });
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
    // Check if user can modify any curriculum containing this subject
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
      where: { id: curriculumId },
      include: {
        curriculumSubjects: {
          include: {
            subject: {
              include: {
                cardSubjects: {
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
      isPublic: curriculum.isPublic,
      authorId: curriculum.authorId,
      subjects,
    };
  }

  /**
   * Lists public curricula for the library
   */
  async listPublicCurricula(options?: {
    limit?: number;
    offset?: number;
    search?: string;
  }): Promise<{
    curricula: { id: string; name: string; description: string | null; authorId: string }[];
    total: number;
  }> {
    const where = {
      isPublic: true,
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
    curricula: { id: string; name: string; description: string | null; isPublic: boolean }[];
    total: number;
  }> {
    const [curricula, total] = await Promise.all([
      prisma.curriculum.findMany({
        where: { authorId },
        select: {
          id: true,
          name: true,
          description: true,
          isPublic: true,
        },
        take: options?.limit,
        skip: options?.offset,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.curriculum.count({ where: { authorId } }),
    ]);

    return { curricula, total };
  }

  /**
   * Enrolls a user in a public curriculum
   */
  async enrollUser(curriculumId: string, userId: string): Promise<void> {
    const curriculum = await prisma.curriculum.findUnique({
      where: { id: curriculumId },
      select: { isPublic: true },
    });

    if (!curriculum) {
      throw new Error("Curriculum not found");
    }

    if (!curriculum.isPublic) {
      throw new Error("Cannot enroll in private curriculum");
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
