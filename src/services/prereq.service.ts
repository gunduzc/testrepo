/**
 * PrerequisiteService - Checks and enforces prerequisite requirements
 *
 * Enforces prerequisites based on PREREQ_ENFORCEMENT setting:
 * - hard: Block enrollment/study until prereqs completed
 * - soft: Warning, but allow continuation
 * - none: Informational only
 */

import prisma from "@/lib/prisma";
import { getPrereqEnforcement, PrereqEnforcement } from "@/lib/instance-config";

export interface PrereqStatus {
  subjectId: string;
  subjectName: string;
  isUnlocked: boolean;
  missingPrereqs: {
    subjectId: string;
    subjectName: string;
    completionPercentage: number;
  }[];
}

export interface CurriculumPrereqStatus {
  curriculumId: string;
  enforcement: PrereqEnforcement;
  canEnroll: boolean;
  canStudy: boolean;
  subjects: PrereqStatus[];
  blockedSubjects: PrereqStatus[];
  warningSubjects: PrereqStatus[];
}

// Subject mastery threshold for unlocking dependents
const MASTERY_THRESHOLD = 0.8;
// Stability threshold for considering a card "mastered"
const STABILITY_THRESHOLD = 10;

export class PrerequisiteService {
  /**
   * Gets the current prereq enforcement level
   */
  getEnforcementLevel(): PrereqEnforcement {
    return getPrereqEnforcement();
  }

  /**
   * Gets mastery percentage for a subject (percentage of cards in REVIEW with high stability)
   */
  async getSubjectMastery(userId: string, subjectId: string): Promise<number> {
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId, deletedAt: null },
      include: {
        cardSubjects: {
          where: { card: { deletedAt: null } },
        },
      },
    });

    if (!subject || subject.cardSubjects.length === 0) {
      return 1; // Empty subjects are considered mastered
    }

    const cardIds = subject.cardSubjects.map((cs) => cs.cardId);
    const masteredCards = await prisma.studentCardState.count({
      where: {
        userId,
        cardId: { in: cardIds },
        state: "REVIEW",
        stability: { gt: STABILITY_THRESHOLD },
      },
    });

    return masteredCards / subject.cardSubjects.length;
  }

  /**
   * Checks if user has completed all prerequisites for a subject
   */
  async checkSubjectPrereqs(
    userId: string,
    subjectId: string
  ): Promise<PrereqStatus> {
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId, deletedAt: null },
      include: {
        prerequisites: {
          include: {
            prerequisite: true,
          },
        },
      },
    });

    if (!subject) {
      throw new Error("Subject not found");
    }

    const missingPrereqs: PrereqStatus["missingPrereqs"] = [];

    for (const prereq of subject.prerequisites) {
      const mastery = await this.getSubjectMastery(userId, prereq.prerequisiteId);

      if (mastery < MASTERY_THRESHOLD) {
        missingPrereqs.push({
          subjectId: prereq.prerequisiteId,
          subjectName: prereq.prerequisite.name,
          completionPercentage: Math.round(mastery * 100),
        });
      }
    }

    return {
      subjectId: subject.id,
      subjectName: subject.name,
      isUnlocked: missingPrereqs.length === 0,
      missingPrereqs,
    };
  }

  /**
   * Gets prerequisite status for all subjects in a curriculum
   */
  async getCurriculumPrereqStatus(
    userId: string,
    curriculumId: string
  ): Promise<CurriculumPrereqStatus> {
    const enforcement = this.getEnforcementLevel();

    const curriculum = await prisma.curriculum.findUnique({
      where: { id: curriculumId, deletedAt: null },
      include: {
        curriculumSubjects: {
          where: { subject: { deletedAt: null } },
          include: {
            subject: {
              include: {
                prerequisites: {
                  include: { prerequisite: true },
                },
                cardSubjects: {
                  where: { card: { deletedAt: null } },
                },
              },
            },
          },
        },
      },
    });

    if (!curriculum) {
      throw new Error("Curriculum not found");
    }

    // Get all card states for this user in this curriculum
    const cardIds = curriculum.curriculumSubjects.flatMap((cs) =>
      cs.subject.cardSubjects.map((ccs) => ccs.cardId)
    );

    const cardStates = await prisma.studentCardState.findMany({
      where: {
        userId,
        cardId: { in: cardIds },
      },
    });

    const stateMap = new Map(cardStates.map((s) => [s.cardId, s]));

    // Calculate mastery for each subject
    const subjectMastery = new Map<string, number>();

    for (const cs of curriculum.curriculumSubjects) {
      const totalCards = cs.subject.cardSubjects.length;
      if (totalCards === 0) {
        subjectMastery.set(cs.subject.id, 1);
        continue;
      }

      const masteredCards = cs.subject.cardSubjects.filter((ccs) => {
        const state = stateMap.get(ccs.cardId);
        return state && state.state === "REVIEW" && state.stability > STABILITY_THRESHOLD;
      }).length;

      subjectMastery.set(cs.subject.id, masteredCards / totalCards);
    }

    // Build status for each subject
    const subjects: PrereqStatus[] = [];
    const blockedSubjects: PrereqStatus[] = [];
    const warningSubjects: PrereqStatus[] = [];

    for (const cs of curriculum.curriculumSubjects) {
      const missingPrereqs: PrereqStatus["missingPrereqs"] = [];

      for (const prereq of cs.subject.prerequisites) {
        const mastery = subjectMastery.get(prereq.prerequisiteId) ?? 0;

        if (mastery < MASTERY_THRESHOLD) {
          missingPrereqs.push({
            subjectId: prereq.prerequisiteId,
            subjectName: prereq.prerequisite.name,
            completionPercentage: Math.round(mastery * 100),
          });
        }
      }

      const status: PrereqStatus = {
        subjectId: cs.subject.id,
        subjectName: cs.subject.name,
        isUnlocked: missingPrereqs.length === 0,
        missingPrereqs,
      };

      subjects.push(status);

      if (missingPrereqs.length > 0) {
        if (enforcement === "hard") {
          blockedSubjects.push(status);
        } else if (enforcement === "soft") {
          warningSubjects.push(status);
        }
        // For "none", we still track but don't categorize as blocked/warning
      }
    }

    // Determine overall enrollment/study permissions
    const hasBlockedSubjects = blockedSubjects.length > 0;
    const hasWarningSubjects = warningSubjects.length > 0;

    let canEnroll = true;
    let canStudy = true;

    if (enforcement === "hard") {
      // Hard enforcement: can enroll but can't study blocked subjects
      // The FSRS service already handles not serving blocked cards
      canStudy = !hasBlockedSubjects || subjects.some((s) => s.isUnlocked);
    }

    return {
      curriculumId,
      enforcement,
      canEnroll,
      canStudy,
      subjects,
      blockedSubjects,
      warningSubjects,
    };
  }

  /**
   * Validates if a user can start studying a specific subject
   * Returns { allowed, reason } based on enforcement level
   */
  async validateSubjectAccess(
    userId: string,
    subjectId: string
  ): Promise<{ allowed: boolean; reason?: string; enforcement: PrereqEnforcement }> {
    const enforcement = this.getEnforcementLevel();
    const status = await this.checkSubjectPrereqs(userId, subjectId);

    if (status.isUnlocked) {
      return { allowed: true, enforcement };
    }

    const prereqNames = status.missingPrereqs.map((p) => p.subjectName).join(", ");

    switch (enforcement) {
      case "hard":
        return {
          allowed: false,
          reason: `Complete prerequisites first: ${prereqNames}`,
          enforcement,
        };
      case "soft":
        return {
          allowed: true,
          reason: `Recommended prerequisites not completed: ${prereqNames}`,
          enforcement,
        };
      case "none":
        return { allowed: true, enforcement };
    }
  }

  /**
   * Gets a summary of which subjects are unlocked for a user in a curriculum
   */
  async getUnlockedSubjects(
    userId: string,
    curriculumId: string
  ): Promise<string[]> {
    const status = await this.getCurriculumPrereqStatus(userId, curriculumId);
    return status.subjects.filter((s) => s.isUnlocked).map((s) => s.subjectId);
  }
}

// Singleton instance
export const prereqService = new PrerequisiteService();
