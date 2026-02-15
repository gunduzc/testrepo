/**
 * Send Email Verification API
 * POST /api/auth/verify-email/send
 *
 * Generates a verification token and sends it via email.
 * Can be called by authenticated users to resend verification.
 */

import { NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    // Check if already verified
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { emailVerified: true, email: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "User not found" } },
        { status: 404 }
      );
    }

    if (user.emailVerified) {
      return NextResponse.json({
        success: true,
        message: "Email is already verified",
        alreadyVerified: true,
      });
    }

    // Generate verification token
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Delete any existing tokens for this email
    await prisma.verificationToken.deleteMany({
      where: { identifier: user.email },
    });

    // Create new verification token
    await prisma.verificationToken.create({
      data: {
        identifier: user.email,
        token,
        expires,
      },
    });

    // In production, send email here
    const verifyLink = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/verify-email?token=${token}&email=${encodeURIComponent(user.email)}`;
    console.log(`Email verification link for ${user.email}: ${verifyLink}`);

    // TODO: Integrate with email service
    // await sendVerificationEmail(user.email, verifyLink);

    return NextResponse.json({
      success: true,
      message: "Verification email sent",
      // Include token in response for development (remove in production)
      ...(process.env.NODE_ENV === "development" && { devToken: token }),
    });
  } catch (error) {
    console.error("Send verification error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to send verification email" } },
      { status: 500 }
    );
  }
}
