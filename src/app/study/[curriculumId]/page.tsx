import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { StudyView } from "@/components/study/study-view";

interface StudyPageProps {
  params: Promise<{ curriculumId: string }>;
}

export default async function StudyPage({ params }: StudyPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { curriculumId } = await params;

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Study Session</h1>
          <p className="text-gray-600 mt-2">Answer each question to the best of your ability</p>
        </header>

        <StudyView curriculumId={curriculumId} />
      </div>
    </div>
  );
}
