/**
 * Card Test API
 * POST /api/cards/test - Test card function without saving
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { cardService } from "@/services";

const testSchema = z.object({
  source: z.string(),
  count: z.number().int().min(1).max(50).optional().default(10),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    if (!["ADMIN", "EDUCATOR"].includes(session.user.role)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Only educators can test cards" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const data = testSchema.parse(body);

    const results = await cardService.testFunction(data.source, data.count);

    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: error.issues } },
        { status: 400 }
      );
    }

    console.error("Test card error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to test card" } },
      { status: 500 }
    );
  }
}
