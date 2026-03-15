/**
 * Next.js Instrumentation
 * Runs once on server startup
 */

export async function register() {
  // Only run on server
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await createInitialAdmin();
  }
}

async function createInitialAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  console.log(`[init] Admin setup - email configured: ${!!adminEmail}, password configured: ${!!adminPassword}`);

  if (!adminEmail || !adminPassword) {
    console.log("[init] Skipping admin creation - credentials not configured");
    return;
  }

  // Dynamic imports to avoid issues during build
  const { PrismaClient } = await import("@prisma/client");
  const bcrypt = await import("bcryptjs");

  const prisma = new PrismaClient();

  try {
    // Check if admin already exists
    const existing = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (existing) {
      // Ensure they're an admin
      if (existing.role !== "ADMIN") {
        await prisma.user.update({
          where: { email: adminEmail },
          data: { role: "ADMIN" },
        });
        console.log(`[init] Promoted ${adminEmail} to ADMIN`);
      }
      return;
    }

    // Create admin account
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await prisma.user.create({
      data: {
        email: adminEmail,
        name: "Admin",
        passwordHash,
        role: "ADMIN",
      },
    });

    console.log(`[init] Created admin account: ${adminEmail}`);
  } catch (error) {
    console.error("[init] Failed to create admin:", error);
  } finally {
    await prisma.$disconnect();
  }
}
