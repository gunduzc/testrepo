import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { FSRSService } from "@/services/fsrs.service";

const fsrsService = new FSRSService();

export async function POST() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const result = await fsrsService.undoLastReview(session.user.id);

    return NextResponse.json({
      success: result.success,
      message: result.message,
    });
  } catch (error) {
    console.error("Undo failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to undo" } },
      { status: 500 }
    );
  }
}
