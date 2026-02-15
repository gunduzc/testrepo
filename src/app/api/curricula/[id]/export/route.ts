import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET: Export curriculum as JSON
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

    const { id } = await params;

    const curriculum = await prisma.curriculum.findUnique({
      where: { id },
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
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Curriculum not found" } },
        { status: 404 }
      );
    }

    // Build export format
    const exportData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      curriculum: {
        name: curriculum.name,
        description: curriculum.description,
        isPublic: curriculum.isPublic,
        subjects: curriculum.curriculumSubjects.map((cs) => ({
          name: cs.subject.name,
          description: cs.subject.description,
          prerequisites: cs.subject.prerequisites.map((p) => {
            // Find prerequisite subject name
            const prereqSubject = curriculum.curriculumSubjects.find(
              (cs2) => cs2.subjectId === p.prerequisiteId
            );
            return prereqSubject?.subject.name || null;
          }).filter(Boolean),
          cards: cs.subject.cardSubjects.map((ccs) => ({
            name: ccs.card.name,
            description: ccs.card.description,
            functionSource: ccs.card.functionSource,
            answerType: ccs.card.answerType,
            learningSteps: ccs.card.learningSteps,
            relearningSteps: ccs.card.relearningSteps,
            tags: JSON.parse(ccs.card.tags),
            position: ccs.position,
          })),
        })),
      },
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${curriculum.name.replace(/[^a-z0-9]/gi, "_")}_export.json"`,
      },
    });
  } catch (error) {
    console.error("Export curriculum error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to export curriculum" } },
      { status: 500 }
    );
  }
}
