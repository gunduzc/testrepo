/**
 * Legal Notice API (public)
 * GET /api/legal-notice - Get the instance's legal/privacy notice
 *
 * This is the aydınlatma metni configured by the deploying institution.
 * No authentication required — shown at registration.
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const setting = await prisma.instanceSettings.findUnique({
      where: { key: "legalNotice" },
    });

    return NextResponse.json({
      success: true,
      data: {
        legalNotice: setting?.value || null,
      },
    });
  } catch (error) {
    console.error("Get legal notice error:", error);
    return NextResponse.json({
      success: true,
      data: { legalNotice: null },
    });
  }
}
