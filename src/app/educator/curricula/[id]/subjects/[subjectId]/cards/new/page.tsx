"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CardCodeEditor } from "@/components/editor/code-editor";
import { Button } from "@/components/ui/button";

export default function NewCardPage() {
  const params = useParams();
  const router = useRouter();
  const [subjectName, setSubjectName] = useState<string>("");
  const [curriculumName, setCurriculumName] = useState<string>("");

  const curriculumId = params.id as string;
  const subjectId = params.subjectId as string;

  useEffect(() => {
    async function fetchInfo() {
      try {
        const res = await fetch(`/api/curricula/${curriculumId}`);
        const data = await res.json();
        if (data.success && data.data) {
          setCurriculumName(data.data.name);
          const subject = data.data.subjects?.find((s: { id: string }) => s.id === subjectId);
          if (subject) {
            setSubjectName(subject.name);
          }
        }
      } catch (err) {
        console.error("Failed to fetch curriculum info:", err);
      }
    }
    fetchInfo();
  }, [curriculumId, subjectId]);

  const handleCardCreated = () => {
    router.push(`/educator/curricula/${curriculumId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="container mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-sm">
          <Link
            href={`/educator/curricula/${curriculumId}`}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            {curriculumName || "Curriculum"}
          </Link>
          <span className="text-gray-400">/</span>
          <span className="text-gray-600 dark:text-gray-400">{subjectName || "Subject"}</span>
          <span className="text-gray-400">/</span>
          <span className="text-gray-900 dark:text-gray-100">New Card</span>
        </div>

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Create New Card
            </h1>
            {subjectName && (
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Adding to: {subjectName}
              </p>
            )}
          </div>
          <Link href={`/educator/curricula/${curriculumId}`}>
            <Button variant="ghost">Cancel</Button>
          </Link>
        </div>

        {/* Card Editor */}
        <CardCodeEditor
          subjectId={subjectId}
          onCardCreated={handleCardCreated}
        />
      </div>
    </div>
  );
}
