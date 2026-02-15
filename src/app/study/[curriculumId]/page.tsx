import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { StudyView } from "@/components/study/study-view";
import { StudyHeader } from "@/components/study/study-header";

interface StudyPageProps {
  params: Promise<{ curriculumId: string }>;
  searchParams: Promise<{ preview?: string }>;
}

export default async function StudyPage({ params, searchParams }: StudyPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { curriculumId } = await params;
  const { preview } = await searchParams;
  const isPreview = preview === "true";

  return (
    <div className="min-h-screen py-4 sm:py-8 bg-gray-50 dark:bg-gray-950">
      <div className="container mx-auto px-3 sm:px-4 max-w-2xl">
        {isPreview && (
          <div className="bg-yellow-100 dark:bg-yellow-900 border border-yellow-300 dark:border-yellow-700 rounded-lg p-3 mb-4 text-center">
            <span className="text-yellow-800 dark:text-yellow-200 text-sm font-medium">
              Preview Mode - Progress will not be saved
            </span>
          </div>
        )}
        <StudyHeader />
        <StudyView curriculumId={curriculumId} previewMode={isPreview} />
      </div>
    </div>
  );
}
