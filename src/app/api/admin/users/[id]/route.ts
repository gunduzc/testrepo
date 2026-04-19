import { NextRequest, NextResponse } from "next/server";
import { auth, hashPassword } from "@/lib/auth";
import prisma from "@/lib/prisma";

// PATCH: Update user (role, name, email, password, 2FA)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Admin access required" } },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    // Role change
    if (body.role !== undefined) {
      if (!["ADMIN", "EDUCATOR", "STUDENT"].includes(body.role)) {
        return NextResponse.json(
          { error: { code: "INVALID_ROLE", message: "Invalid role" } },
          { status: 400 }
        );
      }
      if (id === session.user.id && body.role !== "ADMIN") {
        return NextResponse.json(
          { error: { code: "FORBIDDEN", message: "Cannot change your own role" } },
          { status: 403 }
        );
      }
      updateData.role = body.role;
    }

    // Name change
    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.trim().length < 1) {
        return NextResponse.json(
          { error: { code: "VALIDATION_ERROR", message: "Name cannot be empty" } },
          { status: 400 }
        );
      }
      updateData.name = body.name.trim();
    }

    // Email change
    if (body.email !== undefined) {
      if (typeof body.email !== "string" || !body.email.includes("@")) {
        return NextResponse.json(
          { error: { code: "VALIDATION_ERROR", message: "Invalid email" } },
          { status: 400 }
        );
      }
      const existing = await prisma.user.findUnique({ where: { email: body.email } });
      if (existing && existing.id !== id) {
        return NextResponse.json(
          { error: { code: "CONFLICT", message: "Email already in use" } },
          { status: 409 }
        );
      }
      updateData.email = body.email.trim().toLowerCase();
    }

    // Password reset
    if (body.password !== undefined) {
      if (typeof body.password !== "string" || body.password.length < 8) {
        return NextResponse.json(
          { error: { code: "VALIDATION_ERROR", message: "Password must be at least 8 characters" } },
          { status: 400 }
        );
      }
      updateData.passwordHash = await hashPassword(body.password);
    }

    // Disable 2FA
    if (body.disable2FA === true) {
      updateData.twoFactorEnabled = false;
      updateData.twoFactorSecret = null;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "No valid fields to update" } },
        { status: 400 }
      );
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, twoFactorEnabled: true },
    });

    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update user" } },
      { status: 500 }
    );
  }
}

// DELETE: Delete user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Admin access required" } },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Prevent admin from deleting themselves
    if (id === session.user.id) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Cannot delete your own account" } },
        { status: 403 }
      );
    }

    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to delete user" } },
      { status: 500 }
    );
  }
}
