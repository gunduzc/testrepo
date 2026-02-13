import Link from "next/link";
import { auth } from "@/lib/auth";
import { curriculumService } from "@/services";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function CurriculaPage() {
  const session = await auth();
  const { curricula } = await curriculumService.listPublicCurricula({ limit: 50 });

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Curriculum Library</h1>
          <p className="text-gray-600 mt-2">
            Browse and enroll in public curricula
          </p>
        </header>

        {curricula.length === 0 ? (
          <Card>
            <CardBody className="text-center py-12">
              <p className="text-gray-600 mb-4">
                No public curricula available yet.
              </p>
              {session?.user && ["ADMIN", "EDUCATOR"].includes(session.user.role) && (
                <Link href="/curricula/new">
                  <Button>Create the First One</Button>
                </Link>
              )}
            </CardBody>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {curricula.map((curriculum) => (
              <CurriculumCard
                key={curriculum.id}
                curriculum={curriculum}
                isLoggedIn={!!session?.user}
                userId={session?.user?.id}
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
}

async function CurriculumCard({ curriculum, isLoggedIn, userId }: CurriculumCardProps) {
  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold text-lg">{curriculum.name}</h3>
        {curriculum.description && (
          <p className="text-sm text-gray-600 mt-1">{curriculum.description}</p>
        )}
      </CardHeader>
      <CardBody>
        <div className="flex gap-2">
          <Link href={`/curricula/${curriculum.id}`} className="flex-1">
            <Button variant="secondary" className="w-full">
              View Details
            </Button>
          </Link>
          {isLoggedIn && (
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
        if (session?.user) {
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
