"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardBody } from "@/components/ui/card";

interface SubjectCard {
  cardId: string;
  position: number;
  card: {
    id: string;
    name: string;
    description: string;
    answerType: string;
  };
}

interface Subject {
  id: string;
  name: string;
  description: string | null;
  cards: SubjectCard[];
  prerequisites: string[];
  dependents: string[];
}

interface CurriculumDetail {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  authorId: string;
  subjects: Subject[];
}

export default function CurriculumDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [curriculum, setCurriculum] = useState<CurriculumDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    async function fetchCurriculum() {
      try {
        const res = await fetch(`/api/curricula/${params.id}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error?.message || "Failed to load curriculum");
          return;
        }

        setCurriculum(data.data);
      } catch (err) {
        setError("Failed to load curriculum");
      } finally {
        setLoading(false);
      }
    }

    fetchCurriculum();
  }, [params.id]);

  const handleEnroll = async () => {
    setEnrolling(true);
    try {
      const res = await fetch(`/api/curricula/${params.id}/enroll`, {
        method: "POST",
      });

      if (res.ok) {
        router.push(`/study/${params.id}`);
      } else {
        const data = await res.json();
        setError(data.error?.message || "Failed to enroll");
      }
    } catch (err) {
      setError("Failed to enroll");
    } finally {
      setEnrolling(false);
    }
  };

  // Helper to get subject name by ID
  const getSubjectName = (subjectId: string): string => {
    const subject = curriculum?.subjects.find((s) => s.id === subjectId);
    return subject?.name || subjectId;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading curriculum...</p>
      </div>
    );
  }

  if (error || !curriculum) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || "Curriculum not found"}</p>
          <Link href="/curricula">
            <Button variant="secondary">Back to Curricula</Button>
          </Link>
        </div>
      </div>
    );
  }

  const totalCards = curriculum.subjects.reduce(
    (sum, s) => sum + s.cards.length,
    0
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/curricula" className="text-blue-600 hover:underline">
            &larr; Back to Curricula
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <div className="flex justify-between items-start flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">{curriculum.name}</h1>
              <p className="text-gray-600 mb-4">
                {curriculum.description || "No description"}
              </p>
              <p className="text-sm text-gray-500">
                {curriculum.subjects.length} subject
                {curriculum.subjects.length !== 1 ? "s" : ""} &middot;{" "}
                {totalCards} card{totalCards !== 1 ? "s" : ""} &middot;{" "}
                {curriculum.isPublic ? "Public" : "Private"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleEnroll} disabled={enrolling}>
                {enrolling ? "Enrolling..." : "Start Learning"}
              </Button>
              <Link href={`/study/${curriculum.id}`}>
                <Button variant="secondary">Go to Study</Button>
              </Link>
            </div>
          </div>
        </div>

        <h2 className="text-2xl font-semibold mb-4">Subjects</h2>

        {curriculum.subjects.length === 0 ? (
          <p className="text-gray-500">No subjects in this curriculum yet.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {curriculum.subjects.map((subject) => (
              <Card key={subject.id}>
                <CardHeader>
                  <h3 className="font-semibold text-lg">{subject.name}</h3>
                </CardHeader>
                <CardBody>
                  <p className="text-gray-600 text-sm mb-3">
                    {subject.description || "No description"}
                  </p>
                  <p className="text-sm text-gray-500">
                    {subject.cards.length} card
                    {subject.cards.length !== 1 ? "s" : ""}
                  </p>
                  {subject.prerequisites.length > 0 && (
                    <p className="text-sm text-orange-600 mt-2">
                      Requires:{" "}
                      {subject.prerequisites
                        .map((id) => getSubjectName(id))
                        .join(", ")}
                    </p>
                  )}
                  {subject.cards.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs text-gray-400 mb-1">Cards:</p>
                      <ul className="text-sm text-gray-600">
                        {subject.cards.slice(0, 3).map((c) => (
                          <li key={c.cardId} className="truncate">
                            &bull; {c.card.name}
                          </li>
                        ))}
                        {subject.cards.length > 3 && (
                          <li className="text-gray-400">
                            +{subject.cards.length - 3} more
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
