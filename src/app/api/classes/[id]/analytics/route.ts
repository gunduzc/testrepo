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

    for (const enrollment of classData.enrollments) {
      const userId = enrollment.user.id;

      // Get student's card states
      const cardStates = await prisma.studentCardState.findMany({
        where: {
          userId,
          cardId: { in: allCardIds },
        },
      });

      const cardStateMap = new Map(cardStates.map((s) => [s.cardId, s]));

      // Get review stats
      const reviewStats = await prisma.reviewLog.aggregate({
        where: {
          userId,
          cardId: { in: allCardIds },
        },
        _count: { id: true },
      });

      const correctReviews = await prisma.reviewLog.count({
        where: {
          userId,
          cardId: { in: allCardIds },
          correct: true,
        },
      });

      const lastReview = await prisma.reviewLog.findFirst({
        where: {
          userId,
          cardId: { in: allCardIds },
        },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });

      // Calculate per-curriculum progress
      const curricula: StudentProgress["curricula"] = [];

      for (const ca of classData.curriculumAssignments) {
        const curriculumCardIds = ca.curriculum.curriculumSubjects.flatMap((cs) =>
          cs.subject.cardSubjects.map((ccs) => ccs.cardId)
        );

        const totalCards = curriculumCardCounts.get(ca.curriculum.id) || 0;
        let cardsStudied = 0;
        let cardsMastered = 0;

        for (const cardId of curriculumCardIds) {
          const state = cardStateMap.get(cardId);
          if (state) {
            cardsStudied++;
            if (state.state === "REVIEW" && state.stability > 10) {
              cardsMastered++;
            }
          }
        }

        // Get curriculum-specific review stats
        const curriculumReviews = await prisma.reviewLog.count({
          where: {
            userId,
            cardId: { in: curriculumCardIds },
          },
        });

        const curriculumCorrect = await prisma.reviewLog.count({
          where: {
            userId,
            cardId: { in: curriculumCardIds },
            correct: true,
          },
        });

        const curriculumLastReview = await prisma.reviewLog.findFirst({
          where: {
            userId,
            cardId: { in: curriculumCardIds },
          },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        });

        curricula.push({
          curriculumId: ca.curriculum.id,
          curriculumName: ca.curriculum.name,
          totalCards,
          cardsStudied,
          cardsMastered,
          totalReviews: curriculumReviews,
          correctReviews: curriculumCorrect,
          accuracy: curriculumReviews > 0 ? curriculumCorrect / curriculumReviews : 0,
          lastActivity: curriculumLastReview?.createdAt || null,
          completionPercentage: totalCards > 0 ? (cardsMastered / totalCards) * 100 : 0,
        });
      }

      const totalReviews = reviewStats._count.id || 0;

      students.push({
        userId: enrollment.user.id,
        userName: enrollment.user.name,
        userEmail: enrollment.user.email,
        curricula,
        overallStats: {
          totalReviews,
          accuracy: totalReviews > 0 ? correctReviews / totalReviews : 0,
          lastActivity: lastReview?.createdAt || null,
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
