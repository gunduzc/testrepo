/**
 * Revoke All Sessions API
 * POST /api/auth/sessions/revoke-all
 *
 * Logs out the user from all devices by deleting all their sessions.
 * Note: With JWT strategy, this deletes database sessions but
 * existing JWTs remain valid until they expire. Consider using
 * short-lived JWTs with refresh tokens for better security.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    // Delete all sessions for this user
    const result = await prisma.session.deleteMany({
      where: { userId: session.user.id },
    });

    return NextResponse.json({
      success: true,
      message: "All sessions have been revoked",
      sessionsRevoked: result.count,
    });
  } catch (error) {
    console.error("Revoke sessions error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to revoke sessions" } },
      { status: 500 }
    );
  }
}
