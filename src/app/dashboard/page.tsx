import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Get user's enrolled curricula
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
  const uniqueCurricula = Array.from(
    new Map(allCurricula.map((c) => [c.id, c])).values()
  );

  const isEducator = ["ADMIN", "EDUCATOR"].includes(session.user.role);

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome, {session.user.name}
            </h1>
            <p className="text-gray-600 mt-1">
              {isEducator ? "Educator Dashboard" : "Student Dashboard"}
            </p>
          </div>
          {isEducator && (
            <Link href="/editor">
              <Button>Create Card</Button>
            </Link>
          )}
        </header>

        {/* Enrolled Curricula */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">My Curricula</h2>

          {uniqueCurricula.length === 0 ? (
            <Card>
              <CardBody className="text-center py-12">
                <p className="text-gray-600 mb-4">
                  You haven&apos;t enrolled in any curricula yet.
                </p>
                <Link href="/curricula">
                  <Button>Browse Curricula</Button>
                </Link>
              </CardBody>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {uniqueCurricula.map((curriculum) => {
                const totalCards = curriculum.curriculumSubjects.reduce(
                  (sum, cs) => sum + cs.subject.cardSubjects.length,
                  0
                );

                return (
                  <Card key={curriculum.id}>
                    <CardHeader>
                      <h3 className="font-semibold text-lg">{curriculum.name}</h3>
                      {curriculum.description && (
                        <p className="text-sm text-gray-600 mt-1">
                          {curriculum.description}
                        </p>
                      )}
                    </CardHeader>
                    <CardBody>
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-sm text-gray-500">
                          {totalCards} cards
                        </span>
                        <span className="text-sm text-gray-500">
                          {curriculum.curriculumSubjects.length} subjects
                        </span>
                      </div>
                      <Link href={`/study/${curriculum.id}`}>
                        <Button className="w-full">Start Studying</Button>
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
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/curricula">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardBody className="text-center py-6">
                  <div className="text-4xl mb-2">📚</div>
                  <h3 className="font-medium">Browse Curricula</h3>
                  <p className="text-sm text-gray-500">Find new content to learn</p>
                </CardBody>
              </Card>
            </Link>

            {isEducator && (
              <>
                <Link href="/editor">
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                    <CardBody className="text-center py-6">
                      <div className="text-4xl mb-2">✏️</div>
                      <h3 className="font-medium">Create Cards</h3>
                      <p className="text-sm text-gray-500">Build new flashcards</p>
                    </CardBody>
                  </Card>
                </Link>

                <Link href="/curricula/new">
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                    <CardBody className="text-center py-6">
                      <div className="text-4xl mb-2">📋</div>
                      <h3 className="font-medium">Create Curriculum</h3>
                      <p className="text-sm text-gray-500">Organize your cards</p>
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
