import { CurriculumForm } from "@/components/educator/curriculum-form";

export default function NewCurriculumPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
        Create New Curriculum
      </h2>
      <CurriculumForm />
    </div>
  );
}
