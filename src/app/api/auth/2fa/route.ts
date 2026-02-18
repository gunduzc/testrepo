/**
 * Two-Factor Authentication API
 * POST /api/auth/2fa/enable - Enable 2FA
 * POST /api/auth/2fa/verify - Verify 2FA code
 * POST /api/auth/2fa/disable - Disable 2FA
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import CryptoJS from "crypto-js";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

const ENCRYPTION_KEY = process.env.TWO_FACTOR_SECRET_KEY;
if (!ENCRYPTION_KEY && process.env.NODE_ENV === "production") {
  throw new Error("TWO_FACTOR_SECRET_KEY must be set in production");
}
const SAFE_ENCRYPTION_KEY = ENCRYPTION_KEY || "dev-only-secret-key";
const APP_NAME = "SpacedRepetition";

// Encrypt TOTP secret for storage
function encryptSecret(secret: string): string {
  return CryptoJS.AES.encrypt(secret, SAFE_ENCRYPTION_KEY).toString();
}

// Decrypt TOTP secret
function decryptSecret(encrypted: string): string {
  const bytes = CryptoJS.AES.decrypt(encrypted, SAFE_ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
}

// Generate backup codes
function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 10; i++) {
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    codes.push(code);
  }
  return codes;
}

const enableSchema = z.object({
  action: z.literal("enable"),
});

const verifySchema = z.object({
  action: z.literal("verify"),
  code: z.string().length(6),
});

const disableSchema = z.object({
  action: z.literal("disable"),
  code: z.string().length(6),
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

    const body = await request.json();
    const action = body.action;

    if (action === "enable") {
      // Generate new TOTP secret
      const secret = new OTPAuth.Secret({ size: 20 });

      const totp = new OTPAuth.TOTP({
        issuer: APP_NAME,
        label: session.user.email,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret,
      });

      const uri = totp.toString();
      const qrCode = await QRCode.toDataURL(uri);
      const backupCodes = generateBackupCodes();

      // Store encrypted secret temporarily (not enabled until verified)
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          twoFactorSecret: encryptSecret(secret.base32),
          // Store backup codes in a real app, we'd use a separate table
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          qrCode,
          secret: secret.base32, // Show once for manual entry
          backupCodes,
        },
      });
    }

    if (action === "verify") {
      const data = verifySchema.parse(body);

      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { twoFactorSecret: true, twoFactorEnabled: true },
      });

      if (!user?.twoFactorSecret) {
        return NextResponse.json(
          { error: { code: "NOT_SETUP", message: "2FA not set up" } },
          { status: 400 }
        );
      }

      const secret = decryptSecret(user.twoFactorSecret);
      const totp = new OTPAuth.TOTP({
        issuer: APP_NAME,
        label: session.user.email,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(secret),
      });

      const isValid = totp.validate({ token: data.code, window: 1 }) !== null;

      if (!isValid) {
        return NextResponse.json(
          { error: { code: "INVALID_CODE", message: "Invalid verification code" } },
          { status: 400 }
        );
      }

      // Enable 2FA
      await prisma.user.update({
        where: { id: session.user.id },
        data: { twoFactorEnabled: true },
      });

      return NextResponse.json({ success: true, message: "2FA enabled" });
    }

    if (action === "disable") {
      const data = disableSchema.parse(body);

      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { twoFactorSecret: true, twoFactorEnabled: true },
      });

      if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
        return NextResponse.json(
          { error: { code: "NOT_ENABLED", message: "2FA not enabled" } },
          { status: 400 }
        );
      }

      const secret = decryptSecret(user.twoFactorSecret);
      const totp = new OTPAuth.TOTP({
        issuer: APP_NAME,
        label: session.user.email,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(secret),
      });

      const isValid = totp.validate({ token: data.code, window: 1 }) !== null;

      if (!isValid) {
        return NextResponse.json(
          { error: { code: "INVALID_CODE", message: "Invalid verification code" } },
          { status: 400 }
        );
      }

      // Disable 2FA
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
        },
      });

      return NextResponse.json({ success: true, message: "2FA disabled" });
    }

    return NextResponse.json(
      { error: { code: "INVALID_ACTION", message: "Invalid action" } },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: error.issues } },
        { status: 400 }
      );
    }

    console.error("2FA error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "2FA operation failed" } },
      { status: 500 }
    );
  }
}
