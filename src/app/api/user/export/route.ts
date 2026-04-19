/**
 * GDPR Data Export API
 * GET /api/user/export
 *
 * Exports all user data in JSON format for GDPR compliance
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

interface UserDataExport {
  exportedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified: string | null;
    role: string;
    createdAt: string;
    updatedAt: string;
    twoFactorEnabled: boolean;
    fsrsParameters: object | null;
  };
  enrollments: {
    curricula: Array<{
      curriculumId: string;
      curriculumName: string;
    }>;
    classes: Array<{
      classId: string;
      className: string;
    }>;
  };
  studyProgress: Array<{
    cardId: string;
    cardName: string;
    state: string;
    stability: number;
    difficulty: number;
    reps: number;
    lapses: number;
    due: string;
    lastReview: string | null;
  }>;
  reviewHistory: Array<{
    id: string;
    cardId: string;
    rating: string;
    correct: boolean;
    responseTimeMs: number;
    answerMedium: string;
    stateBeforeReview: string;
    createdAt: string;
  }>;
  authoredContent: {
    curricula: Array<{
      id: string;
      name: string;
      description: string | null;
      createdAt: string;
    }>;
    subjects: Array<{
      id: string;
      name: string;
      description: string | null;
    }>;
    cards: Array<{
      id: string;
      name: string;
      description: string;
      answerType: string;
      createdAt: string;
    }>;
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Fetch all user data
    const [
      user,
      curriculumEnrollments,
      classEnrollments,
      cardStates,
      reviewLogs,
      authoredCurricula,
      authoredSubjects,
      authoredCards,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          twoFactorEnabled: true,
          fsrsParameters: true,
        },
      }),
      prisma.userCurriculumEnrollment.findMany({
        where: { userId },
        include: {
          curriculum: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.classEnrollment.findMany({
        where: { userId },
        include: {
          class: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.studentCardState.findMany({
        where: { userId },
        include: {
          card: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.reviewLog.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 50_000, // Safety cap to prevent OOM
      }),
      prisma.curriculum.findMany({
        where: { authorId: userId },
        select: {
          id: true,
          name: true,
          description: true,
          createdAt: true,
        },
      }),
      prisma.subject.findMany({
        where: { authorId: userId },
        select: {
          id: true,
          name: true,
          description: true,
        },
      }),
      prisma.card.findMany({
        where: { authorId: userId },
        select: {
          id: true,
          name: true,
          description: true,
          answerType: true,
          createdAt: true,
        },
      }),
    ]);

    if (!user) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "User not found" } },
        { status: 404 }
      );
    }

    const exportData: UserDataExport = {
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified?.toISOString() || null,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        twoFactorEnabled: user.twoFactorEnabled,
        fsrsParameters: user.fsrsParameters ? JSON.parse(user.fsrsParameters) : null,
      },
      enrollments: {
        curricula: curriculumEnrollments.map((e) => ({
          curriculumId: e.curriculum.id,
          curriculumName: e.curriculum.name,
        })),
        classes: classEnrollments.map((e) => ({
          classId: e.class.id,
          className: e.class.name,
        })),
      },
      studyProgress: cardStates.map((s) => ({
        cardId: s.cardId,
        cardName: s.card.name,
        state: s.state,
        stability: s.stability,
        difficulty: s.difficulty,
        reps: s.reps,
        lapses: s.lapses,
        due: s.due.toISOString(),
        lastReview: s.lastReview?.toISOString() || null,
      })),
      reviewHistory: reviewLogs.map((r) => ({
        id: r.id,
        cardId: r.cardId,
        rating: r.rating,
        correct: r.correct,
        responseTimeMs: r.responseTimeMs,
        answerMedium: r.answerMedium,
        stateBeforeReview: r.stateBeforeReview,
        createdAt: r.createdAt.toISOString(),
      })),
      authoredContent: {
        curricula: authoredCurricula.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          createdAt: c.createdAt.toISOString(),
        })),
        subjects: authoredSubjects.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
        })),
        cards: authoredCards.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          answerType: c.answerType,
          createdAt: c.createdAt.toISOString(),
        })),
      },
    };

    // Return as downloadable JSON file
    const jsonString = JSON.stringify(exportData, null, 2);

    return new NextResponse(jsonString, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="user-data-export-${userId}-${Date.now()}.json"`,
      },
    });
  } catch (error) {
    console.error("GDPR export error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to export data" } },
      { status: 500 }
    );
  }
}
