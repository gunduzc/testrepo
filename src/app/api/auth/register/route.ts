/**
 * User Registration API
 * POST /api/auth/register
 *
 * Registration is controlled by REGISTRATION env var:
 * - open: Anyone can register (as STUDENT only)
 * - closed: Only admins can create accounts
 * - domain: Only allowed email domains
 * - invite: Requires invite token (not implemented yet)
 * - code: Requires registration code (not implemented yet)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { getRegistrationMode, getAllowedDomains } from "@/lib/instance-config";

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  // Role is NOT user-selectable - everyone registers as STUDENT
  // Admins promote users to EDUCATOR via admin panel
});

export async function POST(request: NextRequest) {
  try {
    const registrationMode = getRegistrationMode();

    // Check if registration is allowed
    if (registrationMode === "closed") {
      return NextResponse.json(
        { error: { code: "REGISTRATION_CLOSED", message: "Registration is disabled. Contact an administrator." } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const data = registerSchema.parse(body);

    // Check domain restrictions
    if (registrationMode === "domain") {
      const allowedDomains = getAllowedDomains();
      const emailDomain = data.email.split("@")[1]?.toLowerCase();
      if (!allowedDomains.includes(emailDomain)) {
        return NextResponse.json(
          { error: { code: "DOMAIN_NOT_ALLOWED", message: "Registration is restricted to approved email domains." } },
          { status: 403 }
        );
      }
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: { code: "EMAIL_EXISTS", message: "Email already registered" } },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(data.password);

    // Create user - always as STUDENT
    // Admins can promote to EDUCATOR via admin panel
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        role: "STUDENT",
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ success: true, data: user }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: error.issues } },
        { status: 400 }
      );
    }

    console.error("Registration error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Registration failed" } },
      { status: 500 }
    );
  }
}
