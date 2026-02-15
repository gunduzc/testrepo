import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton } from "@/components/logout-button";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const isEducator = ["ADMIN", "EDUCATOR"].includes(session.user.role);
  const isAdmin = session.user.role === "ADMIN";

  // For educators: get their authored curricula
  // For students: get enrolled curricula
  let uniqueCurricula: Array<{
    id: string;
    name: string;
    description: string | null;
    curriculumSubjects: Array<{
      subject: { cardSubjects: Array<unknown> };
    }>;
  }> = [];

  if (isEducator) {
    // Educators see their own curricula
    uniqueCurricula = await prisma.curriculum.findMany({
      where: { authorId: session.user.id },
      include: {
        curriculumSubjects: {
          include: {
            subject: {
              include: { cardSubjects: true },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
  } else {
    // Students see enrolled curricula
    const enrollments = await prisma.userCurriculumEnrollment.findMany({
      where: { userId: session.user.id },
      include: {
        curriculum: {
          include: {
            curriculumSubjects: {
              include: {
                subject: {
                  include: { cardSubjects: true },
                },
              },
            },
          },
        },
      },
    });

    // Get class enrollments
    const classEnrollments = await prisma.classEnrollment.findMany({
      where: { userId: session.user.id },
      include: {
        class: {
          include: {
            curriculumAssignments: {
              include: {
                curriculum: {
                  include: {
                    curriculumSubjects: {
                      include: {
                        subject: {
                          include: { cardSubjects: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    // Combine all curricula
    const allCurricula = [
      ...enrollments.map((e) => e.curriculum),
      ...classEnrollments.flatMap((ce) =>
        ce.class.curriculumAssignments.map((ca) => ca.curriculum)
      ),
    ];

    // Remove duplicates
    uniqueCurricula = Array.from(
      new Map(allCurricula.map((c) => [c.id, c])).values()
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 py-4 sm:py-8">
      <div className="container mx-auto px-3 sm:px-4">
        <header className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
              Welcome, {session.user.name}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm sm:text-base">
              {isEducator ? "Educator Dashboard" : "Student Dashboard"}
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <LogoutButton />
          </div>
        </header>

        {/* Curricula Section */}
        <section className="mb-6 sm:mb-8">
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-900 dark:text-gray-100">
            {isEducator ? "My Curricula" : "Enrolled Curricula"}
          </h2>

          {uniqueCurricula.length === 0 ? (
            <Card>
              <CardBody className="text-center py-8 sm:py-12">
                <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm sm:text-base">
                  {isEducator
                    ? "You haven't created any curricula yet."
                    : "You haven't enrolled in any curricula yet."}
                </p>
                <Link href={isEducator ? "/educator/curricula/new" : "/curricula"}>
                  <Button className="w-full sm:w-auto">
                    {isEducator ? "Create Curriculum" : "Browse Curricula"}
                  </Button>
                </Link>
              </CardBody>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {uniqueCurricula.map((curriculum) => {
                const totalCards = curriculum.curriculumSubjects.reduce(
                  (sum, cs) => sum + cs.subject.cardSubjects.length,
                  0
                );

                return (
                  <Card key={curriculum.id}>
                    <CardHeader>
                      <h3 className="font-semibold text-base sm:text-lg text-gray-900 dark:text-gray-100">{curriculum.name}</h3>
                      {curriculum.description && (
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {curriculum.description}
                        </p>
                      )}
                    </CardHeader>
                    <CardBody>
                      <div className="flex justify-between items-center mb-3 sm:mb-4">
                        <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                          {totalCards} cards
                        </span>
                        <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                          {curriculum.curriculumSubjects.length} subjects
                        </span>
                      </div>
                      <Link href={isEducator ? `/educator/curricula/${curriculum.id}` : `/study/${curriculum.id}`}>
                        <Button className="w-full">
                          {isEducator ? "Edit Curriculum" : "Start Studying"}
                        </Button>
                      </Link>
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Quick Actions */}
        <section>
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-900 dark:text-gray-100">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
            {isAdmin && (
              <Link href="/admin">
                <Card className="hover:shadow-lg dark:hover:shadow-gray-900/70 transition-shadow cursor-pointer">
                  <CardBody className="text-center py-4 sm:py-6">
                    <div className="text-3xl sm:text-4xl mb-2">⚙️</div>
                    <h3 className="font-medium text-sm sm:text-base text-gray-900 dark:text-gray-100">Admin Panel</h3>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Manage users & content</p>
                  </CardBody>
                </Card>
              </Link>
            )}
            {isEducator ? (
              <>
                <Link href="/educator">
                  <Card className="hover:shadow-lg dark:hover:shadow-gray-900/70 transition-shadow cursor-pointer">
                    <CardBody className="text-center py-4 sm:py-6">
                      <div className="text-3xl sm:text-4xl mb-2">🎓</div>
                      <h3 className="font-medium text-sm sm:text-base text-gray-900 dark:text-gray-100">Educator Portal</h3>
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Manage curricula & subjects</p>
                    </CardBody>
                  </Card>
                </Link>

                <Link href="/curricula">
                  <Card className="hover:shadow-lg dark:hover:shadow-gray-900/70 transition-shadow cursor-pointer">
                    <CardBody className="text-center py-4 sm:py-6">
                      <div className="text-3xl sm:text-4xl mb-2">📚</div>
                      <h3 className="font-medium text-sm sm:text-base text-gray-900 dark:text-gray-100">Browse Library</h3>
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">View public curricula</p>
                    </CardBody>
                  </Card>
                </Link>

                <Link href="/dashboard/security">
                  <Card className="hover:shadow-lg dark:hover:shadow-gray-900/70 transition-shadow cursor-pointer">
                    <CardBody className="text-center py-4 sm:py-6">
                      <div className="text-3xl sm:text-4xl mb-2">🔒</div>
                      <h3 className="font-medium text-sm sm:text-base text-gray-900 dark:text-gray-100">Security</h3>
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">2FA & session management</p>
                    </CardBody>
                  </Card>
                </Link>
              </>
            ) : (
              <>
                <Link href="/curricula">
                  <Card className="hover:shadow-lg dark:hover:shadow-gray-900/70 transition-shadow cursor-pointer">
                    <CardBody className="text-center py-4 sm:py-6">
                      <div className="text-3xl sm:text-4xl mb-2">📚</div>
                      <h3 className="font-medium text-sm sm:text-base text-gray-900 dark:text-gray-100">Browse Curricula</h3>
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Find new content to learn</p>
                    </CardBody>
                  </Card>
                </Link>

                <Link href="/dashboard/stats">
                  <Card className="hover:shadow-lg dark:hover:shadow-gray-900/70 transition-shadow cursor-pointer">
                    <CardBody className="text-center py-4 sm:py-6">
                      <div className="text-3xl sm:text-4xl mb-2">📊</div>
                      <h3 className="font-medium text-sm sm:text-base text-gray-900 dark:text-gray-100">Study Statistics</h3>
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">View progress & optimize</p>
                    </CardBody>
                  </Card>
                </Link>

                <Link href="/dashboard/security">
                  <Card className="hover:shadow-lg dark:hover:shadow-gray-900/70 transition-shadow cursor-pointer">
                    <CardBody className="text-center py-4 sm:py-6">
                      <div className="text-3xl sm:text-4xl mb-2">🔒</div>
                      <h3 className="font-medium text-sm sm:text-base text-gray-900 dark:text-gray-100">Security</h3>
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">2FA & session management</p>
                    </CardBody>
                  </Card>
                </Link>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
