/**
 * Class Analytics API
 * GET /api/classes/[id]/analytics
 *
 * Returns student progress analytics for a class
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

interface StudentProgress {
  userId: string;
  userName: string | null;
  userEmail: string;
  curricula: {
    curriculumId: string;
    curriculumName: string;
    totalCards: number;
    cardsStudied: number;
    cardsMastered: number;
    totalReviews: number;
    correctReviews: number;
    accuracy: number;
    lastActivity: Date | null;
    completionPercentage: number;
  }[];
  overallStats: {
    totalReviews: number;
    accuracy: number;
    lastActivity: Date | null;
  };
}

interface ClassAnalytics {
  classId: string;
  className: string;
  totalStudents: number;
  totalCurricula: number;
  students: StudentProgress[];
  classAverages: {
    averageAccuracy: number;
    averageCompletion: number;
    totalReviews: number;
    activeStudents: number; // Students with activity in last 7 days
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    // Only educators and admins can view analytics
    if (!["EDUCATOR", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied" } },
        { status: 403 }
      );
    }

    const { id: classId } = await params;

    // Get class with enrollments and curricula
    const classData = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        enrollments: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        curriculumAssignments: {
          include: {
            curriculum: {
              include: {
                curriculumSubjects: {
                  where: { subject: { deletedAt: null } },
                  include: {
                    subject: {
                      include: {
                        cardSubjects: {
                          where: { card: { deletedAt: null } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!classData) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Class not found" } },
        { status: 404 }
      );
    }

    // Verify ownership (unless admin)
    if (classData.educatorId !== session.user.id && session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied" } },
        { status: 403 }
      );
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const students: StudentProgress[] = [];

    // Calculate card counts per curriculum
    const curriculumCardCounts = new Map<string, number>();
    for (const ca of classData.curriculumAssignments) {
      const totalCards = ca.curriculum.curriculumSubjects.reduce(
        (sum, cs) => sum + cs.subject.cardSubjects.length,
        0
      );
      curriculumCardCounts.set(ca.curriculum.id, totalCards);
    }

    // Get all card IDs across all curricula
    const allCardIds = classData.curriculumAssignments.flatMap((ca) =>
      ca.curriculum.curriculumSubjects.flatMap((cs) =>
        cs.subject.cardSubjects.map((ccs) => ccs.cardId)
      )
    );

    // Batch queries instead of per-student loops (avoids N+1 problem)
    const allStudentIds = classData.enrollments.map((e) => e.user.id);

    // Build card-to-curriculum lookup
    const cardToCurriculum = new Map<string, string[]>();
    for (const ca of classData.curriculumAssignments) {
      for (const cs of ca.curriculum.curriculumSubjects) {
        for (const ccs of cs.subject.cardSubjects) {
          const existing = cardToCurriculum.get(ccs.cardId) || [];
          existing.push(ca.curriculum.id);
          cardToCurriculum.set(ccs.cardId, existing);
        }
      }
    }

    const [allCardStates, reviewCountsByUser, correctCountsByUser, reviewCountsByUserCard, correctCountsByUserCard, lastActivityByUser] = await Promise.all([
      // All card states for all students
      prisma.studentCardState.findMany({
        where: { userId: { in: allStudentIds }, cardId: { in: allCardIds } },
      }),
      // Total reviews per student
      prisma.reviewLog.groupBy({
        by: ["userId"],
        where: { userId: { in: allStudentIds }, cardId: { in: allCardIds } },
        _count: { id: true },
      }),
      // Correct reviews per student
      prisma.reviewLog.groupBy({
        by: ["userId"],
        where: { userId: { in: allStudentIds }, cardId: { in: allCardIds }, correct: true },
        _count: { id: true },
      }),
      // Total reviews per student+card (for per-curriculum breakdown)
      prisma.reviewLog.groupBy({
        by: ["userId", "cardId"],
        where: { userId: { in: allStudentIds }, cardId: { in: allCardIds } },
        _count: { id: true },
      }),
      // Correct reviews per student+card
      prisma.reviewLog.groupBy({
        by: ["userId", "cardId"],
        where: { userId: { in: allStudentIds }, cardId: { in: allCardIds }, correct: true },
        _count: { id: true },
      }),
      // Last activity per student
      prisma.reviewLog.groupBy({
        by: ["userId"],
        where: { userId: { in: allStudentIds }, cardId: { in: allCardIds } },
        _max: { createdAt: true },
      }),
    ]);

    // Build lookup maps
    const cardStatesByUser = new Map<string, Map<string, (typeof allCardStates)[0]>>();
    for (const state of allCardStates) {
      if (!cardStatesByUser.has(state.userId)) cardStatesByUser.set(state.userId, new Map());
      cardStatesByUser.get(state.userId)!.set(state.cardId, state);
    }

    const totalReviewsByUser = new Map(reviewCountsByUser.map((r) => [r.userId, r._count.id]));
    const correctByUser = new Map(correctCountsByUser.map((r) => [r.userId, r._count.id]));
    const lastActivityMap = new Map(lastActivityByUser.map((r) => [r.userId, r._max.createdAt]));

    const reviewsByUserCard = new Map<string, number>();
    for (const r of reviewCountsByUserCard) reviewsByUserCard.set(`${r.userId}:${r.cardId}`, r._count.id);
    const correctByUserCard = new Map<string, number>();
    for (const r of correctCountsByUserCard) correctByUserCard.set(`${r.userId}:${r.cardId}`, r._count.id);

    // Build student progress from maps (no DB calls in this loop)
    for (const enrollment of classData.enrollments) {
      const userId = enrollment.user.id;
      const userCardStates = cardStatesByUser.get(userId) || new Map();

      const curricula: StudentProgress["curricula"] = [];

      for (const ca of classData.curriculumAssignments) {
        const curriculumCardIds = ca.curriculum.curriculumSubjects.flatMap((cs) =>
          cs.subject.cardSubjects.map((ccs) => ccs.cardId)
        );

        const totalCards = curriculumCardCounts.get(ca.curriculum.id) || 0;
        let cardsStudied = 0;
        let cardsMastered = 0;
        let curriculumReviews = 0;
        let curriculumCorrect = 0;

        for (const cardId of curriculumCardIds) {
          const state = userCardStates.get(cardId);
          if (state) {
            cardsStudied++;
            if (state.state === "REVIEW" && state.stability > 10) {
              cardsMastered++;
            }
          }
          curriculumReviews += reviewsByUserCard.get(`${userId}:${cardId}`) || 0;
          curriculumCorrect += correctByUserCard.get(`${userId}:${cardId}`) || 0;
        }

        curricula.push({
          curriculumId: ca.curriculum.id,
          curriculumName: ca.curriculum.name,
          totalCards,
          cardsStudied,
          cardsMastered,
          totalReviews: curriculumReviews,
          correctReviews: curriculumCorrect,
          accuracy: curriculumReviews > 0 ? curriculumCorrect / curriculumReviews : 0,
          lastActivity: null, // Aggregated at overall level
          completionPercentage: totalCards > 0 ? (cardsMastered / totalCards) * 100 : 0,
        });
      }

      const totalReviews = totalReviewsByUser.get(userId) || 0;
      const correctReviews = correctByUser.get(userId) || 0;

      students.push({
        userId: enrollment.user.id,
        userName: enrollment.user.name,
        userEmail: enrollment.user.email,
        curricula,
        overallStats: {
          totalReviews,
          accuracy: totalReviews > 0 ? correctReviews / totalReviews : 0,
          lastActivity: lastActivityMap.get(userId) || null,
        },
      });
    }

    // Calculate class averages
    const activeStudents = students.filter(
      (s) => s.overallStats.lastActivity && s.overallStats.lastActivity > sevenDaysAgo
    ).length;

    const studentsWithReviews = students.filter((s) => s.overallStats.totalReviews > 0);
    const averageAccuracy =
      studentsWithReviews.length > 0
        ? studentsWithReviews.reduce((sum, s) => sum + s.overallStats.accuracy, 0) /
          studentsWithReviews.length
        : 0;

    const averageCompletion =
      students.length > 0
        ? students.reduce(
            (sum, s) =>
              sum +
              (s.curricula.length > 0
                ? s.curricula.reduce((cs, c) => cs + c.completionPercentage, 0) / s.curricula.length
                : 0),
            0
          ) / students.length
        : 0;

    const totalReviews = students.reduce((sum, s) => sum + s.overallStats.totalReviews, 0);

    const analytics: ClassAnalytics = {
      classId,
      className: classData.name,
      totalStudents: classData.enrollments.length,
      totalCurricula: classData.curriculumAssignments.length,
      students,
      classAverages: {
        averageAccuracy,
        averageCompletion,
        totalReviews,
        activeStudents,
      },
    };

    return NextResponse.json({ success: true, data: analytics });
  } catch (error) {
    console.error("Class analytics error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get analytics" } },
      { status: 500 }
    );
  }
}
