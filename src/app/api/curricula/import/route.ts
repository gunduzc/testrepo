import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sandboxService } from "@/services/sandbox.service";
import { canCreateContent } from "@/lib/instance-config";

interface ImportCard {
  name: string;
  description: string;
  functionSource: string;
  answerType: string;
  learningSteps?: number;
  relearningSteps?: number;
  tags?: string[];
  position?: number;
}

interface ImportSubject {
  name: string;
  description?: string | null;
  prerequisites?: string[];
  cards: ImportCard[];
}

interface ImportCurriculum {
  name: string;
  description?: string | null;
  subjects: ImportSubject[];
}

interface ImportData {
  version: string;
  curriculum: ImportCurriculum;
}

// POST: Import curriculum from JSON
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    if (!canCreateContent(session.user.role)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Not authorized to import curricula" } },
        { status: 403 }
      );
    }

    const importData: ImportData = await request.json();

    // Validate structure
    if (!importData.curriculum?.name || !Array.isArray(importData.curriculum.subjects)) {
      return NextResponse.json(
        { error: { code: "INVALID_FORMAT", message: "Invalid import format" } },
        { status: 400 }
      );
    }

    const { curriculum: curriculumData } = importData;

    // Validate all card functions before importing
    const validationErrors: string[] = [];
    for (const subject of curriculumData.subjects) {
      for (const card of subject.cards) {
        const result = await sandboxService.executeCard(card.functionSource);
        if (!result.success) {
          validationErrors.push(`Card "${card.name}" in subject "${subject.name}": ${result.error.message}`);
        }
      }
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Some cards have invalid functions",
            details: validationErrors
          }
        },
        { status: 400 }
      );
    }

    // Create curriculum in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create curriculum
      const curriculum = await tx.curriculum.create({
        data: {
          name: curriculumData.name,
          description: curriculumData.description || null,
          authorId: session.user!.id,
        },
      });

      // Create subjects and cards
      const subjectMap = new Map<string, string>(); // name -> id

      for (const subjectData of curriculumData.subjects) {
        const subject = await tx.subject.create({
          data: {
            name: subjectData.name,
            description: subjectData.description || null,
            authorId: session.user!.id,
          },
        });

        subjectMap.set(subjectData.name, subject.id);

        // Link to curriculum
        await tx.curriculumSubject.create({
          data: {
            curriculumId: curriculum.id,
            subjectId: subject.id,
          },
        });

        // Create cards
        for (let i = 0; i < subjectData.cards.length; i++) {
          const cardData = subjectData.cards[i];
          const card = await tx.card.create({
            data: {
              name: cardData.name,
              description: cardData.description,
              functionSource: cardData.functionSource,
              answerType: cardData.answerType,
              learningSteps: cardData.learningSteps ?? 5,
              relearningSteps: cardData.relearningSteps ?? 3,
              tags: JSON.stringify(cardData.tags ?? []),
              authorId: session.user!.id,
            },
          });

          await tx.cardSubject.create({
            data: {
              cardId: card.id,
              subjectId: subject.id,
              position: cardData.position ?? i,
            },
          });
        }
      }

      // Create prerequisites (second pass)
      for (const subjectData of curriculumData.subjects) {
        if (subjectData.prerequisites && subjectData.prerequisites.length > 0) {
          const subjectId = subjectMap.get(subjectData.name);
          if (!subjectId) continue;

          for (const prereqName of subjectData.prerequisites) {
            const prereqId = subjectMap.get(prereqName);
            if (prereqId) {
              await tx.subjectPrerequisite.create({
                data: {
                  subjectId,
                  prerequisiteId: prereqId,
                },
              });
            }
          }
        }
      }

      return curriculum;
    });

    return NextResponse.json({
      success: true,
      data: {
        id: result.id,
        name: result.name,
        subjectCount: curriculumData.subjects.length,
        cardCount: curriculumData.subjects.reduce((sum, s) => sum + s.cards.length, 0),
      },
    });
  } catch (error) {
    console.error("Import curriculum error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to import curriculum" } },
      { status: 500 }
    );
  }
}
