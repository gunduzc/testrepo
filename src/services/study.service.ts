/**
 * StudySessionService - Orchestrates study: card selection, execution, answer storage, validation
 *
 * Key principle: Correct answers NEVER leave the server.
 * ActiveStudySession stores the correct answer server-side.
 */

import prisma from "@/lib/prisma";
import { sandboxService } from "./sandbox.service";
import { fsrsService } from "./fsrs.service";
import { validationService } from "./validation.service";
import { llmService } from "./llm.service";
import {
  QuestionPresentation,
  SubmissionResult,
  ProgressSummary,
  AnswerType,
} from "@/lib/types";

// Session expiry time (10 minutes)
const SESSION_TTL_MS = 10 * 60 * 1000;

export class StudySessionService {
  /**
   * Gets the next question for a study session
   *
   * 1. Selects next card via FSRS (respecting prerequisites)
   * 2. Executes card in sandbox
   * 3. Optionally themes the question
   * 4. Stores correct answer in ActiveStudySession
   * 5. Returns question WITHOUT correct answer
   */
  async getNextQuestion(
    userId: string,
    curriculumId: string
  ): Promise<QuestionPresentation | null> {
    // Get next card from FSRS
    const scheduledCard = await fsrsService.getNextCard(userId, curriculumId);

    if (!scheduledCard) {
      return null; // No cards due
    }

    // Execute card function in sandbox
    const result = await sandboxService.executeCard(scheduledCard.card.functionSource);

    if (!result.success) {
      // Card execution failed - skip this card and try next
      // In production, we'd want to log this and potentially alert
      console.error(`Card ${scheduledCard.cardId} execution failed:`, result.error);
      // For now, return null - in a full implementation, we'd recurse or handle differently
      return null;
    }

    const cardOutput = result.output;
    let questionText = cardOutput.question;

    // Check if user has a theme selected
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { selectedTheme: true },
    });

    if (user?.selectedTheme) {
      // Check cache first
      const cached = await prisma.generatedContent.findFirst({
        where: {
          cardId: scheduledCard.cardId,
          themeId: user.selectedTheme.id,
          originalQuestion: cardOutput.question,
        },
      });

      if (cached) {
        questionText = cached.themedQuestion;
      } else {
        // Generate themed question
        try {
          const themedQuestion = await llmService.themeQuestion(
            cardOutput.question,
            scheduledCard.card.description,
            user.selectedTheme
          );

          // Cache the result
          await prisma.generatedContent.create({
            data: {
              cardId: scheduledCard.cardId,
              themeId: user.selectedTheme.id,
              originalQuestion: cardOutput.question,
              themedQuestion,
            },
          });

          questionText = themedQuestion;
        } catch {
          // Silent fallback to original question
        }
      }
    }

    // Clean up expired sessions for this user
    await prisma.activeStudySession.deleteMany({
      where: {
        userId,
        expiresAt: { lt: new Date() },
      },
    });

    // Create new session storing the correct answer
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    const session = await prisma.activeStudySession.create({
      data: {
        userId,
        cardId: scheduledCard.cardId,
        correctAnswer: cardOutput.answer.correct,
        answerType: cardOutput.answer.type,
        validateFnSource: cardOutput.answer.validate,
        expiresAt,
      },
    });

    // Return question WITHOUT correct answer
    return {
      sessionId: session.id,
      cardId: scheduledCard.cardId,
      question: questionText,
      answerType: cardOutput.answer.type as AnswerType,
      choices: cardOutput.answer.choices,
      cardName: scheduledCard.card.name,
      subjectName: scheduledCard.subjectName,
    };
  }

  /**
   * Submits an answer for validation
   *
   * 1. Looks up session (gets correct answer server-side)
   * 2. Validates answer
   * 3. Computes FSRS rating
   * 4. Updates card state
   * 5. Deletes session
   * 6. Returns result with correct answer revealed
   */
  async submitAnswer(
    sessionId: string,
    userAnswer: string,
    userId: string
  ): Promise<SubmissionResult | null> {
    // Get session
    const session = await prisma.activeStudySession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return null; // Session not found or expired
    }

    // Verify session belongs to user
    if (session.userId !== userId) {
      return null;
    }

    // Check expiry
    if (session.expiresAt < new Date()) {
      await prisma.activeStudySession.delete({ where: { id: sessionId } });
      return null;
    }

    // Calculate response time (capped for AFK detection)
    const rawResponseTimeMs = Date.now() - session.presentedAt.getTime();
    const responseTimeMs = fsrsService.capResponseTime(rawResponseTimeMs);

    // Validate answer
    const correct = await validationService.validate(
      userAnswer,
      session.correctAnswer,
      session.answerType as AnswerType,
      session.validateFnSource || undefined
    );

    // Compute rating - binary only (AGAIN/GOOD)
    const rating = fsrsService.computeRating(correct);

    // Update FSRS state
    const { newState, canUndo } = await fsrsService.updateCardState(
      userId,
      session.cardId,
      rating,
      responseTimeMs
    );

    // Delete session
    await prisma.activeStudySession.delete({ where: { id: sessionId } });

    // Get curriculum for progress
    // Find curriculum through card's subject
    const cardSubject = await prisma.cardSubject.findFirst({
      where: { cardId: session.cardId },
      include: {
        subject: {
          include: {
            curriculumSubjects: true,
          },
        },
      },
    });

    let progress: ProgressSummary = {
      totalCards: 0,
      newCards: 0,
      learningCards: 0,
      reviewCards: 0,
      relearningCards: 0,
      masteredCards: 0,
      dueCards: 0,
      completionPercentage: 0,
      subjectProgress: [],
    };

    if (cardSubject?.subject.curriculumSubjects[0]) {
      progress = await fsrsService.getStudentProgress(
        userId,
        cardSubject.subject.curriculumSubjects[0].curriculumId
      );
    }

    return {
      correct,
      correctAnswer: session.correctAnswer,
      rating,
      progress,
      nextState: newState,
      canUndo,
    };
  }

  /**
   * Gets a preview question for educators (no session, includes answer)
   */
  async getPreviewQuestion(curriculumId: string): Promise<QuestionPresentation | null> {
    // Get all cards from the curriculum
    const curriculum = await prisma.curriculum.findUnique({
      where: { id: curriculumId },
      include: {
        curriculumSubjects: {
          include: {
            subject: {
              include: {
                cardSubjects: {
                  include: { card: true },
                },
              },
            },
          },
        },
      },
    });

    if (!curriculum) return null;

    // Flatten all cards
    const allCards = curriculum.curriculumSubjects.flatMap((cs) =>
      cs.subject.cardSubjects.map((ccs) => ({
        card: ccs.card,
        subjectName: cs.subject.name,
      }))
    );

    if (allCards.length === 0) return null;

    // Pick a random card
    const randomIndex = Math.floor(Math.random() * allCards.length);
    const { card, subjectName } = allCards[randomIndex];

    // Execute card function in sandbox
    const result = await sandboxService.executeCard(card.functionSource);

    if (!result.success) {
      console.error(`Card ${card.id} execution failed:`, result.error);
      return null;
    }

    const cardOutput = result.output;

    // Return question WITH correct answer for preview
    return {
      sessionId: `preview-${Date.now()}`,
      cardId: card.id,
      question: cardOutput.question,
      answerType: cardOutput.answer.type as AnswerType,
      choices: cardOutput.answer.choices,
      cardName: card.name,
      subjectName,
      correctAnswer: cardOutput.answer.correct,
    };
  }

  /**
   * Gets study progress for a curriculum
   */
  async getProgress(userId: string, curriculumId: string): Promise<ProgressSummary> {
    return fsrsService.getStudentProgress(userId, curriculumId);
  }

  /**
   * Gets next due time for a curriculum (when no cards are currently due)
   */
  async getNextDueTime(userId: string, curriculumId: string): Promise<Date | null> {
    const curriculum = await prisma.curriculum.findUnique({
      where: { id: curriculumId },
      include: {
        curriculumSubjects: {
          include: {
            subject: {
              include: { cardSubjects: true },
            },
          },
        },
      },
    });

    if (!curriculum) return null;

    const cardIds = curriculum.curriculumSubjects.flatMap((cs) =>
      cs.subject.cardSubjects.map((ccs) => ccs.cardId)
    );

    const nextDue = await prisma.studentCardState.findFirst({
      where: {
        userId,
        cardId: { in: cardIds },
        due: { gt: new Date() },
      },
      orderBy: { due: "asc" },
      select: { due: true },
    });

    return nextDue?.due || null;
  }

  /**
   * Gets user's enrolled curricula with study status
   */
  async getEnrolledCurricula(userId: string): Promise<
    {
      curriculumId: string;
      curriculumName: string;
      dueCards: number;
      totalCards: number;
      completionPercentage: number;
    }[]
  > {
    // Get curricula from individual enrollments
    const individualEnrollments = await prisma.userCurriculumEnrollment.findMany({
      where: { userId },
      include: { curriculum: true },
    });

    // Get curricula from class enrollments
    const classEnrollments = await prisma.classEnrollment.findMany({
      where: { userId },
      include: {
        class: {
          include: {
            curriculumAssignments: {
              include: { curriculum: true },
            },
          },
        },
      },
    });

    const curriculaMap = new Map<string, string>();

    for (const e of individualEnrollments) {
      curriculaMap.set(e.curriculum.id, e.curriculum.name);
    }

    for (const ce of classEnrollments) {
      for (const ca of ce.class.curriculumAssignments) {
        curriculaMap.set(ca.curriculum.id, ca.curriculum.name);
      }
    }

    const results = [];
    for (const [curriculumId, curriculumName] of curriculaMap) {
      const progress = await fsrsService.getStudentProgress(userId, curriculumId);
      results.push({
        curriculumId,
        curriculumName,
        dueCards: progress.dueCards,
        totalCards: progress.totalCards,
        completionPercentage: progress.completionPercentage,
      });
    }

    return results;
  }
}

// Singleton instance
export const studyService = new StudySessionService();
