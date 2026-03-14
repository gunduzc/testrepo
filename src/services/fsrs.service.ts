/**
 * FSRSService - Wraps ts-fsrs for spaced repetition scheduling
 *
 * Handles:
 * - Rating computation based on correctness and response time
 * - Card state transitions
 * - Next card selection with prerequisite checking
 * - Progress tracking
 */

import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating as FSRSRating,
  State,
  Card as FSRSCard,
  FSRS,
  type Grade,
} from "ts-fsrs";
import prisma from "@/lib/prisma";
import {
  Rating,
  CardState,
  ValueToRating,
  ProgressSummary,
  ScheduledCard,
  FSRSParameters,
  DEFAULT_FSRS_PARAMETERS,
  AnswerType,
} from "@/lib/types";

// AFK detection: cap response time at 2 minutes
// Anything longer is likely distraction, not actual study time
const MAX_RESPONSE_TIME_MS = 120000;

/**
 * Maps our CardState to ts-fsrs State
 */
function toFSRSState(state: CardState): State {
  switch (state) {
    case "NEW":
      return State.New;
    case "LEARNING":
      return State.Learning;
    case "REVIEW":
      return State.Review;
    case "RELEARNING":
      return State.Relearning;
  }
}

/**
 * Maps ts-fsrs State to our CardState
 */
function fromFSRSState(state: State): CardState {
  switch (state) {
    case State.New:
      return "NEW";
    case State.Learning:
      return "LEARNING";
    case State.Review:
      return "REVIEW";
    case State.Relearning:
      return "RELEARNING";
  }
}

/**
 * Creates FSRS instance with given parameters
 */
function createFSRS(params?: FSRSParameters): FSRS {
  const p = params || DEFAULT_FSRS_PARAMETERS;
  return fsrs(
    generatorParameters({
      request_retention: p.requestRetention,
      maximum_interval: p.maximumInterval,
      w: p.w,
    })
  );
}

export class FSRSService {
  /**
   * Computes rating based on correctness only.
   * Binary rating (AGAIN/GOOD) as recommended by FSRS research.
   * Students never self-rate - the system determines rating from correctness.
   */
  computeRating(correct: boolean): Rating {
    return correct ? Rating.GOOD : Rating.AGAIN;
  }

  /**
   * Caps response time for AFK detection.
   * Returns capped time in ms.
   */
  capResponseTime(responseTimeMs: number): number {
    return Math.min(responseTimeMs, MAX_RESPONSE_TIME_MS);
  }

  /**
   * Updates card state after a review
   * Enforces custom step counts (learningSteps, relearningSteps, reviewSteps)
   * Only applies FSRS scheduling when steps are completed
   */
  async updateCardState(
    userId: string,
    cardId: string,
    rating: Rating,
    responseTimeMs: number
  ): Promise<{
    newState: CardState;
    stability: number;
    difficulty: number;
    canUndo: boolean;
    stepsRemaining: number;
  }> {
    // Get user's FSRS parameters (or use global default)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fsrsParameters: true },
    });

    const params = user?.fsrsParameters
      ? (JSON.parse(user.fsrsParameters) as FSRSParameters)
      : DEFAULT_FSRS_PARAMETERS;

    const f = createFSRS(params);

    // Get the card's step settings
    const card = await prisma.card.findUnique({
      where: { id: cardId },
      select: { learningSteps: true, relearningSteps: true, reviewSteps: true },
    });

    if (!card) {
      throw new Error("Card not found");
    }

    // Get step overrides for this card if in a class
    const enrollment = await prisma.classEnrollment.findFirst({
      where: { userId },
      include: {
        class: {
          include: {
            stepOverrides: { where: { cardId } },
          },
        },
      },
    });

    const stepOverride = enrollment?.class?.stepOverrides?.[0];
    const learningSteps = stepOverride?.learningSteps ?? card.learningSteps;
    const relearningSteps = stepOverride?.relearningSteps ?? card.relearningSteps;
    const reviewSteps = card.reviewSteps ?? 1;

    // Get or create student card state
    let cardState = await prisma.studentCardState.findUnique({
      where: { userId_cardId: { userId, cardId } },
    });

    const now = new Date();
    const wasNew = !cardState;

    if (!cardState) {
      // Create new state for first review
      cardState = await prisma.studentCardState.create({
        data: {
          userId,
          cardId,
          state: "LEARNING", // Start in LEARNING, not NEW
          stability: 0,
          difficulty: 0,
          elapsedDays: 0,
          scheduledDays: 0,
          reps: 0,
          lapses: 0,
          stepIndex: 0,
          due: now,
        },
      });
    }

    // Store previous state for undo
    const prevState = {
      state: cardState.state,
      stability: cardState.stability,
      difficulty: cardState.difficulty,
      elapsedDays: cardState.elapsedDays,
      scheduledDays: cardState.scheduledDays,
      reps: cardState.reps,
      lapses: cardState.lapses,
      stepIndex: cardState.stepIndex,
      due: cardState.due,
      lastReview: cardState.lastReview,
    };

    const correct = rating !== Rating.AGAIN;
    const currentState = cardState.state as CardState;

    // Determine required steps based on current state
    const getRequiredSteps = (state: CardState): number => {
      switch (state) {
        case "NEW":
        case "LEARNING":
          return learningSteps;
        case "RELEARNING":
          return relearningSteps;
        case "REVIEW":
          return reviewSteps;
      }
    };

    const requiredSteps = getRequiredSteps(currentState);
    let newStepIndex = cardState.stepIndex;
    let newState: CardState = currentState;
    let applyFSRS = false;

    if (correct) {
      // Increment step counter
      newStepIndex = cardState.stepIndex + 1;

      if (newStepIndex >= requiredSteps) {
        // Steps completed - transition state
        if (currentState === "LEARNING" || currentState === "NEW") {
          newState = "REVIEW";
          newStepIndex = 0; // Reset for reviewSteps
          applyFSRS = true;
        } else if (currentState === "RELEARNING") {
          newState = "REVIEW";
          newStepIndex = 0;
          applyFSRS = true;
        } else if (currentState === "REVIEW") {
          // All reviewSteps completed - apply FSRS for next review scheduling
          newStepIndex = 0;
          applyFSRS = true;
        }
      }
      // If steps not complete, stay in same state but due immediately for next step
    } else {
      // Incorrect answer - reset steps
      newStepIndex = 0;

      if (currentState === "REVIEW") {
        // Lapse: REVIEW -> RELEARNING
        newState = "RELEARNING";
      }
      // LEARNING/RELEARNING stay in same state, just reset stepIndex
    }

    // Build FSRS card from our state (only used if applyFSRS)
    let newDue = now; // Default: due immediately for next step
    let newStability = cardState.stability;
    let newDifficulty = cardState.difficulty;
    let newElapsedDays = cardState.elapsedDays;
    let newScheduledDays = cardState.scheduledDays;
    let newReps = cardState.reps;

    if (applyFSRS) {
      // Apply FSRS algorithm for scheduling
      const fsrsCard: FSRSCard = {
        due: cardState.due,
        stability: cardState.stability,
        difficulty: cardState.difficulty,
        elapsed_days: cardState.elapsedDays,
        scheduled_days: cardState.scheduledDays,
        learning_steps: 0, // We handle steps ourselves
        reps: cardState.reps,
        lapses: cardState.lapses,
        state: toFSRSState(currentState),
        last_review: cardState.lastReview || undefined,
      };

      const gradeMap: Record<Rating, Grade> = {
        [Rating.AGAIN]: FSRSRating.Again,
        [Rating.HARD]: FSRSRating.Hard,
        [Rating.GOOD]: FSRSRating.Good,
        [Rating.EASY]: FSRSRating.Easy,
      };
      const fsrsGrade = gradeMap[rating];
      const result = f.next(fsrsCard, now, fsrsGrade);
      const newFsrsCard = result.card;

      newDue = newFsrsCard.due;
      newStability = newFsrsCard.stability;
      newDifficulty = newFsrsCard.difficulty;
      newElapsedDays = newFsrsCard.elapsed_days;
      newScheduledDays = newFsrsCard.scheduled_days;
      newReps = newFsrsCard.reps;
    }

    const isLapse = !correct && currentState === "REVIEW";

    // Create review log
    const reviewLog = await prisma.reviewLog.create({
      data: {
        userId,
        cardId,
        rating,
        correct,
        responseTimeMs,
        stateBeforeReview: cardState.state,
        stabilityBefore: cardState.stability,
        difficultyBefore: cardState.difficulty,
      },
    });

    // Update card state
    await prisma.studentCardState.update({
      where: { id: cardState.id },
      data: {
        state: newState,
        stability: newStability,
        difficulty: newDifficulty,
        elapsedDays: newElapsedDays,
        scheduledDays: newScheduledDays,
        stepIndex: newStepIndex,
        reps: newReps,
        lapses: isLapse ? cardState.lapses + 1 : cardState.lapses,
        due: newDue,
        lastReview: now,
      },
    });

    // Store undo information (replace any existing undo for this user)
    await prisma.undoableReview.upsert({
      where: { userId },
      create: {
        userId,
        reviewLogId: reviewLog.id,
        cardId,
        prevState: prevState.state,
        prevStability: prevState.stability,
        prevDifficulty: prevState.difficulty,
        prevElapsedDays: prevState.elapsedDays,
        prevScheduledDays: prevState.scheduledDays,
        prevReps: prevState.reps,
        prevLapses: prevState.lapses,
        prevStepIndex: prevState.stepIndex,
        prevDue: prevState.due,
        prevLastReview: prevState.lastReview,
        wasNew,
      },
      update: {
        reviewLogId: reviewLog.id,
        cardId,
        prevState: prevState.state,
        prevStability: prevState.stability,
        prevDifficulty: prevState.difficulty,
        prevElapsedDays: prevState.elapsedDays,
        prevScheduledDays: prevState.scheduledDays,
        prevReps: prevState.reps,
        prevLapses: prevState.lapses,
        prevStepIndex: prevState.stepIndex,
        prevDue: prevState.due,
        prevLastReview: prevState.lastReview,
        wasNew,
      },
    });

    const stepsRemaining = correct
      ? Math.max(0, getRequiredSteps(newState) - newStepIndex)
      : getRequiredSteps(newState);

    return {
      newState,
      stability: newStability,
      difficulty: newDifficulty,
      canUndo: true,
      stepsRemaining,
    };
  }

  /**
   * Undoes the last review for a user
   * Restores previous FSRS state and deletes the review log
   */
  async undoLastReview(userId: string): Promise<{ success: boolean; message: string }> {
    const undoable = await prisma.undoableReview.findUnique({
      where: { userId },
    });

    if (!undoable) {
      return { success: false, message: "Nothing to undo" };
    }

    // Delete the review log
    await prisma.reviewLog.delete({
      where: { id: undoable.reviewLogId },
    }).catch(() => {
      // Review log might already be deleted, that's okay
    });

    if (undoable.wasNew) {
      // Card was new, delete the StudentCardState entirely
      await prisma.studentCardState.delete({
        where: { userId_cardId: { userId, cardId: undoable.cardId } },
      }).catch(() => {
        // Might not exist, that's okay
      });
    } else {
      // Restore previous state
      await prisma.studentCardState.update({
        where: { userId_cardId: { userId, cardId: undoable.cardId } },
        data: {
          state: undoable.prevState,
          stability: undoable.prevStability,
          difficulty: undoable.prevDifficulty,
          elapsedDays: undoable.prevElapsedDays,
          scheduledDays: undoable.prevScheduledDays,
          reps: undoable.prevReps,
          lapses: undoable.prevLapses,
          stepIndex: undoable.prevStepIndex,
          due: undoable.prevDue,
          lastReview: undoable.prevLastReview,
        },
      });
    }

    // Delete the undo record
    await prisma.undoableReview.delete({
      where: { userId },
    });

    return { success: true, message: "Review undone" };
  }

  /**
   * Gets the next card for study
   * Considers due dates, prerequisites, and card ordering
   */
  async getNextCard(
    userId: string,
    curriculumId: string
  ): Promise<ScheduledCard | null> {
    const now = new Date();

    // Get curriculum structure with subjects, cards, and prerequisites
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

    if (!curriculum) {
      return null;
    }

    // Get all user's card states for this curriculum
    const cardIds = curriculum.curriculumSubjects.flatMap((cs) =>
      cs.subject.cardSubjects.map((ccs) => ccs.cardId)
    );

    const cardStates = await prisma.studentCardState.findMany({
      where: { userId, cardId: { in: cardIds } },
    });

    const stateMap = new Map(cardStates.map((s) => [s.cardId, s]));

    // Check which subjects are unlocked (prerequisites mastered)
    const subjectMastery = new Map<string, boolean>();

    for (const cs of curriculum.curriculumSubjects) {
      const subject = cs.subject;
      const totalCards = subject.cardSubjects.length;

      if (totalCards === 0) {
        subjectMastery.set(subject.id, true);
        continue;
      }

      // Count mastered cards (state = REVIEW with stability > threshold)
      const masteredCards = subject.cardSubjects.filter((ccs) => {
        const state = stateMap.get(ccs.cardId);
        return state && state.state === "REVIEW" && state.stability > 10;
      }).length;

      // Subject is mastered if 80%+ cards are in REVIEW state
      subjectMastery.set(subject.id, masteredCards / totalCards >= 0.8);
    }

    // Find subjects that are unlocked
    const unlockedSubjects: typeof curriculum.curriculumSubjects = [];

    for (const cs of curriculum.curriculumSubjects) {
      const prereqs = cs.subject.prerequisites;

      // Check if all prerequisites are mastered
      const allPrereqsMastered = prereqs.every((p) =>
        subjectMastery.get(p.prerequisiteId)
      );

      if (allPrereqsMastered || prereqs.length === 0) {
        unlockedSubjects.push(cs);
      }
    }

    // Collect all due cards from unlocked subjects
    const dueCards: ScheduledCard[] = [];
    const newCards: ScheduledCard[] = [];

    for (const cs of unlockedSubjects) {
      for (const ccs of cs.subject.cardSubjects) {
        const state = stateMap.get(ccs.cardId);

        // Helper to get required steps based on state
        const getRequiredSteps = (cardState: CardState, card: typeof ccs.card): number => {
          switch (cardState) {
            case "NEW":
            case "LEARNING":
              return card.learningSteps;
            case "RELEARNING":
              return card.relearningSteps;
            case "REVIEW":
              return card.reviewSteps ?? 1;
          }
        };

        if (!state) {
          // Card never studied - it's new
          newCards.push({
            cardId: ccs.cardId,
            card: {
              id: ccs.card.id,
              name: ccs.card.name,
              functionSource: ccs.card.functionSource,
              answerType: ccs.card.answerType as AnswerType,
              learningSteps: ccs.card.learningSteps,
              relearningSteps: ccs.card.relearningSteps,
              reviewSteps: ccs.card.reviewSteps ?? 1,
              description: ccs.card.description,
            },
            state: "NEW",
            due: now,
            isNew: true,
            subjectId: cs.subject.id,
            subjectName: cs.subject.name,
            position: ccs.position,
            currentStep: 0,
            requiredSteps: ccs.card.learningSteps,
          });
        } else if (state.due <= now) {
          // Card is due
          const cardState = state.state as CardState;
          dueCards.push({
            cardId: ccs.cardId,
            card: {
              id: ccs.card.id,
              name: ccs.card.name,
              functionSource: ccs.card.functionSource,
              answerType: ccs.card.answerType as AnswerType,
              learningSteps: ccs.card.learningSteps,
              relearningSteps: ccs.card.relearningSteps,
              reviewSteps: ccs.card.reviewSteps ?? 1,
              description: ccs.card.description,
            },
            state: cardState,
            due: state.due,
            isNew: false,
            subjectId: cs.subject.id,
            subjectName: cs.subject.name,
            position: ccs.position,
            currentStep: state.stepIndex,
            requiredSteps: getRequiredSteps(cardState, ccs.card),
          });
        }
      }
    }

    // Priority: Overdue cards first (sorted by due date), then new cards (by position)
    if (dueCards.length > 0) {
      dueCards.sort((a, b) => a.due.getTime() - b.due.getTime());
      return dueCards[0];
    }

    if (newCards.length > 0) {
      // Sort by subject order in curriculum, then by position within subject
      newCards.sort((a, b) => {
        if (a.subjectId !== b.subjectId) {
          // For simplicity, use the subject's first card position
          return a.position - b.position;
        }
        return a.position - b.position;
      });
      return newCards[0];
    }

    return null;
  }

  /**
   * Gets progress summary for a curriculum
   */
  async getStudentProgress(
    userId: string,
    curriculumId: string
  ): Promise<ProgressSummary> {
    const curriculum = await prisma.curriculum.findUnique({
      where: { id: curriculumId },
      include: {
        curriculumSubjects: {
          include: {
            subject: {
              include: {
                cardSubjects: { include: { card: true } },
                prerequisites: true,
              },
            },
          },
        },
      },
    });

    if (!curriculum) {
      return {
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
    }

    const now = new Date();
    const cardIds = curriculum.curriculumSubjects.flatMap((cs) =>
      cs.subject.cardSubjects.map((ccs) => ccs.cardId)
    );

    const cardStates = await prisma.studentCardState.findMany({
      where: { userId, cardId: { in: cardIds } },
    });

    const stateMap = new Map(cardStates.map((s) => [s.cardId, s]));

    let totalCards = 0;
    let newCards = 0;
    let learningCards = 0;
    let reviewCards = 0;
    let relearningCards = 0;
    let masteredCards = 0;
    let dueCards = 0;

    const subjectProgress: ProgressSummary["subjectProgress"] = [];

    // Check subject mastery for unlocking
    const subjectMastery = new Map<string, number>();
    for (const cs of curriculum.curriculumSubjects) {
      const total = cs.subject.cardSubjects.length;
      const mastered = cs.subject.cardSubjects.filter((ccs) => {
        const state = stateMap.get(ccs.cardId);
        return state && state.state === "REVIEW" && state.stability > 10;
      }).length;
      subjectMastery.set(cs.subject.id, total > 0 ? mastered / total : 1);
    }

    for (const cs of curriculum.curriculumSubjects) {
      const subject = cs.subject;
      const subjectCardCount = subject.cardSubjects.length;
      totalCards += subjectCardCount;

      let subjectMastered = 0;
      let subjectDue = 0;

      for (const ccs of subject.cardSubjects) {
        const state = stateMap.get(ccs.cardId);

        if (!state) {
          newCards++;
          subjectDue++;
        } else {
          switch (state.state) {
            case "NEW":
              newCards++;
              subjectDue++;
              break;
            case "LEARNING":
              learningCards++;
              if (state.due <= now) subjectDue++;
              break;
            case "REVIEW":
              reviewCards++;
              if (state.stability > 10) {
                subjectMastered++;
                masteredCards++;
              }
              if (state.due <= now) {
                dueCards++;
                subjectDue++;
              }
              break;
            case "RELEARNING":
              relearningCards++;
              if (state.due <= now) subjectDue++;
              break;
          }
        }
      }

      // Check if subject is unlocked
      const prereqs = subject.prerequisites;
      const isUnlocked =
        prereqs.length === 0 ||
        prereqs.every((p) => (subjectMastery.get(p.prerequisiteId) || 0) >= 0.8);

      subjectProgress.push({
        subjectId: subject.id,
        subjectName: subject.name,
        totalCards: subjectCardCount,
        masteredCards: subjectMastered,
        dueCards: subjectDue,
        isUnlocked,
        completionPercentage:
          subjectCardCount > 0 ? (subjectMastered / subjectCardCount) * 100 : 100,
      });
    }

    return {
      totalCards,
      newCards,
      learningCards,
      reviewCards,
      relearningCards,
      masteredCards,
      dueCards,
      completionPercentage: totalCards > 0 ? (masteredCards / totalCards) * 100 : 0,
      subjectProgress,
    };
  }
}

// Singleton instance
export const fsrsService = new FSRSService();
