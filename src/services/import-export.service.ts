/**
 * ImportExportService - JSON serialization/deserialization for cards, subjects, curricula
 */

import prisma from "@/lib/prisma";
import { sandboxService } from "./sandbox.service";
import { curriculumService } from "./curriculum.service";
import {
  CardExportJSON,
  SubjectExportJSON,
  CurriculumExportJSON,
  ImportResult,
  ImportError,
  AnswerType,
} from "@/lib/types";

export class ImportExportService {
  /**
   * Exports a single card to JSON
   */
  async exportCard(cardId: string): Promise<CardExportJSON | null> {
    const card = await prisma.card.findUnique({
      where: { id: cardId },
    });

    if (!card) return null;

    return {
      version: "1.0",
      type: "card",
      data: {
        name: card.name,
        description: card.description,
        functionSource: card.functionSource,
        answerType: card.answerType as AnswerType,
        learningSteps: card.learningSteps,
        relearningSteps: card.relearningSteps,
        tags: JSON.parse(card.tags) as string[],
      },
    };
  }

  /**
   * Exports a subject with all its cards
   */
  async exportSubject(subjectId: string): Promise<SubjectExportJSON | null> {
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
      include: {
        cardSubjects: {
          include: { card: true },
          orderBy: { position: "asc" },
        },
      },
    });

    if (!subject) return null;

    return {
      version: "1.0",
      type: "subject",
      data: {
        name: subject.name,
        description: subject.description || undefined,
        cards: subject.cardSubjects.map((cs) => ({
          name: cs.card.name,
          description: cs.card.description,
          functionSource: cs.card.functionSource,
          answerType: cs.card.answerType as AnswerType,
          learningSteps: cs.card.learningSteps,
          relearningSteps: cs.card.relearningSteps,
          tags: JSON.parse(cs.card.tags) as string[],
        })),
      },
    };
  }

  /**
   * Exports a curriculum with all subjects, cards, and prerequisites
   */
  async exportCurriculum(curriculumId: string): Promise<CurriculumExportJSON | null> {
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
              },
            },
          },
        },
      },
    });

    if (!curriculum) return null;

    const subjects = curriculum.curriculumSubjects.map((cs) => ({
      id: cs.subject.id,
      name: cs.subject.name,
      description: cs.subject.description || undefined,
      cards: cs.subject.cardSubjects.map((ccs) => ({
        name: ccs.card.name,
        description: ccs.card.description,
        functionSource: ccs.card.functionSource,
        answerType: ccs.card.answerType as AnswerType,
        learningSteps: ccs.card.learningSteps,
        relearningSteps: ccs.card.relearningSteps,
        tags: JSON.parse(ccs.card.tags) as string[],
      })),
    }));

    const prerequisites: { subjectId: string; prerequisiteId: string }[] = [];
    for (const cs of curriculum.curriculumSubjects) {
      for (const prereq of cs.subject.prerequisites) {
        prerequisites.push({
          subjectId: cs.subject.id,
          prerequisiteId: prereq.prerequisiteId,
        });
      }
    }

    return {
      version: "1.0",
      type: "curriculum",
      data: {
        name: curriculum.name,
        description: curriculum.description || undefined,
        subjects,
        prerequisites,
      },
    };
  }

  /**
   * Imports a card into a subject
   */
  async importCard(
    data: CardExportJSON,
    subjectId: string,
    position: number,
    authorId: string
  ): Promise<ImportResult<{ cardId: string }>> {
    const errors: ImportError[] = [];

    // Validate JSON structure
    if (data.version !== "1.0" || data.type !== "card") {
      errors.push({
        path: "",
        message: "Invalid card export format",
        code: "INVALID_JSON",
      });
      return { success: false, errors };
    }

    // Validate required fields
    if (!data.data.name || !data.data.functionSource || !data.data.answerType) {
      errors.push({
        path: "data",
        message: "Missing required fields: name, functionSource, or answerType",
        code: "MISSING_FIELD",
      });
      return { success: false, errors };
    }

    // Validate card function in sandbox
    const testResult = await sandboxService.executeCard(data.data.functionSource);
    if (!testResult.success) {
      errors.push({
        path: "data.functionSource",
        message: `Invalid card function: ${testResult.error.message}`,
        code: "INVALID_CARD",
      });
      return { success: false, errors };
    }

    // Check subject exists
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
    });

    if (!subject) {
      errors.push({
        path: "",
        message: "Target subject not found",
        code: "VALIDATION_ERROR",
      });
      return { success: false, errors };
    }

    // Create card
    const card = await prisma.$transaction(async (tx) => {
      const card = await tx.card.create({
        data: {
          name: data.data.name,
          description: data.data.description,
          functionSource: data.data.functionSource,
          answerType: data.data.answerType,
          learningSteps: data.data.learningSteps,
          relearningSteps: data.data.relearningSteps,
          tags: JSON.stringify(data.data.tags || []),
          authorId,
        },
      });

      await tx.cardSubject.create({
        data: {
          cardId: card.id,
          subjectId,
          position,
        },
      });

      return card;
    });

    return { success: true, data: { cardId: card.id } };
  }

  /**
   * Imports a subject with all cards into a curriculum
   */
  async importSubject(
    data: SubjectExportJSON,
    curriculumId: string,
    authorId: string
  ): Promise<ImportResult<{ subjectId: string }>> {
    const errors: ImportError[] = [];

    if (data.version !== "1.0" || data.type !== "subject") {
      errors.push({
        path: "",
        message: "Invalid subject export format",
        code: "INVALID_JSON",
      });
      return { success: false, errors };
    }

    if (!data.data.name) {
      errors.push({
        path: "data.name",
        message: "Subject name is required",
        code: "MISSING_FIELD",
      });
      return { success: false, errors };
    }

    // Validate all card functions
    for (let i = 0; i < data.data.cards.length; i++) {
      const card = data.data.cards[i];
      const testResult = await sandboxService.executeCard(card.functionSource);
      if (!testResult.success) {
        errors.push({
          path: `data.cards[${i}].functionSource`,
          message: `Invalid card function: ${testResult.error.message}`,
          code: "INVALID_CARD",
        });
      }
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    // Check curriculum exists
    const curriculum = await prisma.curriculum.findUnique({
      where: { id: curriculumId },
    });

    if (!curriculum) {
      errors.push({
        path: "",
        message: "Target curriculum not found",
        code: "VALIDATION_ERROR",
      });
      return { success: false, errors };
    }

    // Create subject and cards
    const subject = await prisma.$transaction(async (tx) => {
      const subject = await tx.subject.create({
        data: {
          name: data.data.name,
          description: data.data.description,
          authorId,
        },
      });

      await tx.curriculumSubject.create({
        data: {
          curriculumId,
          subjectId: subject.id,
        },
      });

      for (let i = 0; i < data.data.cards.length; i++) {
        const cardData = data.data.cards[i];
        const card = await tx.card.create({
          data: {
            name: cardData.name,
            description: cardData.description,
            functionSource: cardData.functionSource,
            answerType: cardData.answerType,
            learningSteps: cardData.learningSteps,
            relearningSteps: cardData.relearningSteps,
            tags: JSON.stringify(cardData.tags || []),
            authorId,
          },
        });

        await tx.cardSubject.create({
          data: {
            cardId: card.id,
            subjectId: subject.id,
            position: i,
          },
        });
      }

      return subject;
    });

    return { success: true, data: { subjectId: subject.id } };
  }

  /**
   * Imports a full curriculum with subjects, cards, and prerequisites
   */
  async importCurriculum(
    data: CurriculumExportJSON,
    authorId: string
  ): Promise<ImportResult<{ curriculumId: string }>> {
    const errors: ImportError[] = [];

    if (data.version !== "1.0" || data.type !== "curriculum") {
      errors.push({
        path: "",
        message: "Invalid curriculum export format",
        code: "INVALID_JSON",
      });
      return { success: false, errors };
    }

    if (!data.data.name) {
      errors.push({
        path: "data.name",
        message: "Curriculum name is required",
        code: "MISSING_FIELD",
      });
      return { success: false, errors };
    }

    // Validate all card functions
    for (let i = 0; i < data.data.subjects.length; i++) {
      const subject = data.data.subjects[i];
      for (let j = 0; j < subject.cards.length; j++) {
        const card = subject.cards[j];
        const testResult = await sandboxService.executeCard(card.functionSource);
        if (!testResult.success) {
          errors.push({
            path: `data.subjects[${i}].cards[${j}].functionSource`,
            message: `Invalid card function: ${testResult.error.message}`,
            code: "INVALID_CARD",
          });
        }
      }
    }

    // Validate DAG (no cycles in prerequisites)
    const subjectIds = new Set(data.data.subjects.map((s) => s.id));
    const adjList = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    for (const id of subjectIds) {
      adjList.set(id, []);
      inDegree.set(id, 0);
    }

    for (const prereq of data.data.prerequisites) {
      if (!subjectIds.has(prereq.subjectId) || !subjectIds.has(prereq.prerequisiteId)) {
        errors.push({
          path: "data.prerequisites",
          message: `Invalid prerequisite reference: ${prereq.prerequisiteId} -> ${prereq.subjectId}`,
          code: "VALIDATION_ERROR",
        });
        continue;
      }
      adjList.get(prereq.prerequisiteId)!.push(prereq.subjectId);
      inDegree.set(prereq.subjectId, inDegree.get(prereq.subjectId)! + 1);
    }

    // Kahn's algorithm for cycle detection
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

    if (processed !== subjectIds.size) {
      errors.push({
        path: "data.prerequisites",
        message: "Prerequisite graph contains a cycle",
        code: "DAG_CYCLE",
      });
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    // Create curriculum with all content
    const curriculum = await prisma.$transaction(async (tx) => {
      const curriculum = await tx.curriculum.create({
        data: {
          name: data.data.name,
          description: data.data.description,
          authorId,
        },
      });

      // Map old subject IDs to new IDs
      const subjectIdMap = new Map<string, string>();

      for (const subjectData of data.data.subjects) {
        const subject = await tx.subject.create({
          data: {
            name: subjectData.name,
            description: subjectData.description,
            authorId,
          },
        });

        subjectIdMap.set(subjectData.id, subject.id);

        await tx.curriculumSubject.create({
          data: {
            curriculumId: curriculum.id,
            subjectId: subject.id,
          },
        });

        for (let i = 0; i < subjectData.cards.length; i++) {
          const cardData = subjectData.cards[i];
          const card = await tx.card.create({
            data: {
              name: cardData.name,
              description: cardData.description,
              functionSource: cardData.functionSource,
              answerType: cardData.answerType,
              learningSteps: cardData.learningSteps,
              relearningSteps: cardData.relearningSteps,
              tags: JSON.stringify(cardData.tags || []),
              authorId,
            },
          });

          await tx.cardSubject.create({
            data: {
              cardId: card.id,
              subjectId: subject.id,
              position: i,
            },
          });
        }
      }

      // Create prerequisites with mapped IDs
      for (const prereq of data.data.prerequisites) {
        const newSubjectId = subjectIdMap.get(prereq.subjectId);
        const newPrereqId = subjectIdMap.get(prereq.prerequisiteId);

        if (newSubjectId && newPrereqId) {
          await tx.subjectPrerequisite.create({
            data: {
              subjectId: newSubjectId,
              prerequisiteId: newPrereqId,
            },
          });
        }
      }

      return curriculum;
    });

    return { success: true, data: { curriculumId: curriculum.id } };
  }
}

// Singleton instance
export const importExportService = new ImportExportService();
