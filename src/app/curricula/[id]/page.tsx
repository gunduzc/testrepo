"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { PrereqStatus } from "@/components/study/prereq-status";

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
  authorId: string;
  subjects: Subject[];
}

interface UserInfo {
  id: string;
  role: string;
}

interface SubjectPrereqStatus {
  subjectId: string;
  isUnlocked: boolean;
}

interface PrereqStatusData {
  enforcement: "hard" | "soft" | "none";
  subjects: SubjectPrereqStatus[];
}

export default function CurriculumDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [curriculum, setCurriculum] = useState<CurriculumDetail | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [prereqStatus, setPrereqStatus] = useState<PrereqStatusData | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [curriculumRes, userRes] = await Promise.all([
          fetch(`/api/curricula/${params.id}`),
          fetch("/api/auth/session"),
        ]);

        const curriculumData = await curriculumRes.json();
        const sessionData = await userRes.json();

        if (!curriculumRes.ok) {
          setError(curriculumData.error?.message || "Failed to load curriculum");
          return;
        }

        setCurriculum(curriculumData.data);
        if (sessionData?.user) {
          setUser({ id: sessionData.user.id, role: sessionData.user.role });
        }
      } catch (err) {
        setError("Failed to load curriculum");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [params.id]);

  const isEducator = user && ["ADMIN", "EDUCATOR"].includes(user.role);
  const isOwner = user && curriculum && user.id === curriculum.authorId;

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

  // Helper to check if a subject is unlocked
  const isSubjectUnlocked = (subjectId: string): boolean => {
    if (!prereqStatus || prereqStatus.enforcement === "none") return true;
    const subjectStatus = prereqStatus.subjects.find((s) => s.subjectId === subjectId);
    return subjectStatus?.isUnlocked ?? true;
  };

  // Helper to get lock status color/icon
  const getSubjectLockStatus = (subjectId: string): { icon: string; color: string } | null => {
    if (!prereqStatus || prereqStatus.enforcement === "none") return null;
    const unlocked = isSubjectUnlocked(subjectId);
    if (unlocked) return null;

    return prereqStatus.enforcement === "hard"
      ? { icon: "🔒", color: "text-red-500" }
      : { icon: "⚠️", color: "text-yellow-500" };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <p className="text-gray-600 dark:text-gray-400">Loading curriculum...</p>
      </div>
    );
  }

  if (error || !curriculum) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{error || "Curriculum not found"}</p>
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="mb-4 sm:mb-6">
          <Link href="/curricula" className="text-blue-600 dark:text-blue-400 hover:underline text-sm sm:text-base">
            &larr; Back to Curricula
          </Link>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md dark:shadow-gray-900/50 p-4 sm:p-6 mb-6 sm:mb-8 border border-transparent dark:border-gray-800">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-gray-900 dark:text-gray-100">{curriculum.name}</h1>
              <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm sm:text-base">
                {curriculum.description || "No description"}
              </p>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                {curriculum.subjects.length} subject
                {curriculum.subjects.length !== 1 ? "s" : ""} &middot;{" "}
                {totalCards} card{totalCards !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              {/* Owner or Admin can edit */}
              {(isOwner || user?.role === "ADMIN") && (
                <Link href={`/educator/curricula/${curriculum.id}`} className="flex-1 sm:flex-none">
                  <Button className="w-full">Edit Curriculum</Button>
                </Link>
              )}
              {/* Only students (non-educators) see enrollment */}
              {!isEducator && (
                <Button onClick={handleEnroll} disabled={enrolling} className="flex-1 sm:flex-none">
                  {enrolling ? "Enrolling..." : "Start Learning"}
                </Button>
              )}
              {isEducator ? (
                <Link href={`/study/${curriculum.id}?preview=true`} className="flex-1 sm:flex-none">
                  <Button variant="primary" className="w-full">
                    Preview
                  </Button>
                </Link>
              ) : (
                <Link href={`/study/${curriculum.id}`} className="flex-1 sm:flex-none">
                  <Button variant="secondary" className="w-full">
                    Go to Study
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Prereq Status Banner */}
        {user && !isEducator && (
          <div className="mb-6">
            <PrereqStatus
              curriculumId={curriculum.id}
              onStatusLoaded={(status) => setPrereqStatus(status)}
            />
          </div>
        )}

        <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4 text-gray-900 dark:text-gray-100">Subjects</h2>

        {curriculum.subjects.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No subjects in this curriculum yet.</p>
        ) : (
          <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
            {curriculum.subjects.map((subject) => {
              const lockStatus = getSubjectLockStatus(subject.id);
              return (
              <Card key={subject.id} className={lockStatus ? "opacity-75" : ""}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    {lockStatus && (
                      <span className={lockStatus.color} title={lockStatus.icon === "🔒" ? "Locked - complete prerequisites" : "Prerequisites recommended"}>
                        {lockStatus.icon}
                      </span>
                    )}
                    <h3 className="font-semibold text-base sm:text-lg text-gray-900 dark:text-gray-100">{subject.name}</h3>
                  </div>
                </CardHeader>
                <CardBody>
                  <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm mb-3">
                    {subject.description || "No description"}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    {subject.cards.length} card
                    {subject.cards.length !== 1 ? "s" : ""}
                  </p>
                  {subject.prerequisites.length > 0 && (
                    <p className="text-xs sm:text-sm text-orange-600 dark:text-orange-400 mt-2">
                      Requires:{" "}
                      {subject.prerequisites
                        .map((id) => getSubjectName(id))
                        .join(", ")}
                    </p>
                  )}
                  {subject.cards.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Cards:</p>
                      <ul className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        {subject.cards.slice(0, 3).map((c) => (
                          <li key={c.cardId} className="truncate">
                            &bull; {c.card.name}
                          </li>
                        ))}
                        {subject.cards.length > 3 && (
                          <li className="text-gray-400 dark:text-gray-500">
                            +{subject.cards.length - 3} more
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </CardBody>
              </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
