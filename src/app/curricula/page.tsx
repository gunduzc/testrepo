import Link from "next/link";
import { auth } from "@/lib/auth";
import { curriculumService } from "@/services";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function CurriculaPage() {
  const session = await auth();
  const isEducator = session?.user && ["ADMIN", "EDUCATOR"].includes(session.user.role);

  // Get browsable curricula based on user and instance mode
  const { curricula } = session?.user
    ? await curriculumService.listBrowsableCurricula(
        session.user.id,
        session.user.role,
        { limit: 50 }
      )
    : { curricula: [] };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 py-4 sm:py-8">
      <div className="container mx-auto px-3 sm:px-4">
        <header className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Curriculum Library</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm sm:text-base">
              {isEducator ? "Browse public curricula" : "Browse and enroll in public curricula"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/dashboard">
              <Button variant="secondary">Dashboard</Button>
            </Link>
          </div>
        </header>

        {curricula.length === 0 ? (
          <Card>
            <CardBody className="text-center py-8 sm:py-12">
              <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm sm:text-base">
                No public curricula available yet.
              </p>
              {isEducator && (
                <Link href="/educator/curricula/new">
                  <Button>Create the First One</Button>
                </Link>
              )}
            </CardBody>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {curricula.map((curriculum) => (
              <CurriculumCard
                key={curriculum.id}
                curriculum={curriculum}
                isLoggedIn={!!session?.user}
                userId={session?.user?.id}
                userRole={session?.user?.role}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface CurriculumCardProps {
  curriculum: {
    id: string;
    name: string;
    description: string | null;
    authorId: string;
  };
  isLoggedIn: boolean;
  userId?: string;
  userRole?: string;
}

async function CurriculumCard({ curriculum, isLoggedIn, userId, userRole }: CurriculumCardProps) {
  const isEducator = userRole && ["ADMIN", "EDUCATOR"].includes(userRole);
  const isOwner = userId === curriculum.authorId;

  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold text-base sm:text-lg text-gray-900 dark:text-gray-100">{curriculum.name}</h3>
        {curriculum.description && (
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">{curriculum.description}</p>
        )}
      </CardHeader>
      <CardBody>
        <div className="flex gap-2">
          <Link href={`/curricula/${curriculum.id}`} className="flex-1">
            <Button variant="secondary" className="w-full">
              View Details
            </Button>
          </Link>
          {isLoggedIn && isEducator && isOwner && (
            <Link href={`/educator/curricula/${curriculum.id}`}>
              <Button>Edit</Button>
            </Link>
          )}
          {isLoggedIn && !isEducator && (
            <EnrollButton curriculumId={curriculum.id} />
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function EnrollButton({ curriculumId }: { curriculumId: string }) {
  return (
    <form
      action={async () => {
        "use server";
        const session = await auth();
        if (session?.user && !["ADMIN", "EDUCATOR"].includes(session.user.role)) {
          try {
            await curriculumService.enrollUser(curriculumId, session.user.id);
          } catch {
            // User may already be enrolled
          }
        }
      }}
    >
      <Button type="submit">Enroll</Button>
    </form>
  );
}
