import { notFound } from "next/navigation";
import { curriculumService } from "@/services/curriculum.service";
import { CurriculumEditor } from "./curriculum-editor";

interface CurriculumPageProps {
  params: Promise<{ id: string }>;
}

export default async function CurriculumPage({ params }: CurriculumPageProps) {
  const { id } = await params;
  const curriculum = await curriculumService.getCurriculumWithStructure(id);

  if (!curriculum) {
    notFound();
  }

  return <CurriculumEditor curriculum={curriculum} />;
}
