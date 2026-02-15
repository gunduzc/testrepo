"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClassAnalytics } from "@/components/educator/class-analytics";

interface Student {
  id: string;
  name: string | null;
  email: string;
}

interface Curriculum {
  id: string;
  name: string;
  description: string | null;
}

interface ClassDetail {
  id: string;
  name: string;
  educatorId: string;
  enrollments: Array<{ user: Student }>;
  curriculumAssignments: Array<{ curriculum: Curriculum }>;
}

interface AvailableCurriculum {
  id: string;
  name: string;
  description: string | null;
}

export default function ClassDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [classData, setClassData] = useState<ClassDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [studentEmail, setStudentEmail] = useState("");
  const [addingStudent, setAddingStudent] = useState(false);
  const [studentError, setStudentError] = useState<string | null>(null);
  const [availableCurricula, setAvailableCurricula] = useState<AvailableCurriculum[]>([]);
  const [selectedCurriculum, setSelectedCurriculum] = useState("");
  const [addingCurriculum, setAddingCurriculum] = useState(false);

  useEffect(() => {
    fetchClass();
    fetchAvailableCurricula();
  }, [params.id]);

  const fetchClass = async () => {
    try {
      const res = await fetch(`/api/classes/${params.id}`);
      const data = await res.json();
      if (data.success) {
        setClassData(data.data);
      } else {
        router.push("/educator/classes");
      }
    } catch (error) {
      console.error("Failed to fetch class:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableCurricula = async () => {
    try {
      // Fetch educator's own curricula
      const res = await fetch("/api/curricula");
      const data = await res.json();
      if (data.success && data.data?.curricula) {
        setAvailableCurricula(data.data.curricula);
      }
    } catch (error) {
      console.error("Failed to fetch curricula:", error);
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentEmail.trim()) return;

    setAddingStudent(true);
    setStudentError(null);

    try {
      const res = await fetch(`/api/classes/${params.id}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: studentEmail }),
      });

      const data = await res.json();
      if (res.ok) {
        setStudentEmail("");
        fetchClass();
      } else {
        setStudentError(data.error?.message || "Failed to add student");
      }
    } catch (error) {
      setStudentError("Failed to add student");
    } finally {
      setAddingStudent(false);
    }
  };

  const handleRemoveStudent = async (userId: string, userName: string | null) => {
    if (!confirm(`Remove ${userName || "this student"} from class?`)) return;

    try {
      const res = await fetch(`/api/classes/${params.id}/students`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (res.ok) {
        fetchClass();
      }
    } catch (error) {
      console.error("Failed to remove student:", error);
    }
  };

  const handleAddCurriculum = async () => {
    if (!selectedCurriculum) return;

    setAddingCurriculum(true);
    try {
      const res = await fetch(`/api/classes/${params.id}/curricula`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ curriculumId: selectedCurriculum }),
      });

      if (res.ok) {
        setSelectedCurriculum("");
        fetchClass();
      }
    } catch (error) {
      console.error("Failed to add curriculum:", error);
    } finally {
      setAddingCurriculum(false);
    }
  };

  const handleRemoveCurriculum = async (curriculumId: string, curriculumName: string) => {
    if (!confirm(`Remove "${curriculumName}" from class?`)) return;

    try {
      const res = await fetch(`/api/classes/${params.id}/curricula`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ curriculumId }),
      });

      if (res.ok) {
        fetchClass();
      }
    } catch (error) {
      console.error("Failed to remove curriculum:", error);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading...</div>
    );
  }

  if (!classData) {
    return null;
  }

  const assignedCurriculumIds = new Set(
    classData.curriculumAssignments.map((ca) => ca.curriculum.id)
  );
  const unassignedCurricula = availableCurricula.filter(
    (c) => !assignedCurriculumIds.has(c.id)
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/educator/classes"
            className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
          >
            &larr; Back to Classes
          </Link>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
            {classData.name}
          </h2>
        </div>
      </div>

      {/* Students Section */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
            Students ({classData.enrollments.length})
          </h3>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleAddStudent} className="flex gap-3 mb-4">
            <Input
              type="email"
              placeholder="Student email address"
              value={studentEmail}
              onChange={(e) => setStudentEmail(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={addingStudent || !studentEmail.trim()}>
              {addingStudent ? "Adding..." : "Add Student"}
            </Button>
          </form>

          {studentError && (
            <p className="text-red-600 dark:text-red-400 text-sm mb-4">{studentError}</p>
          )}

          {classData.enrollments.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              No students enrolled yet. Add students by their email address.
            </p>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {classData.enrollments.map(({ user }) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {user.name || "—"}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveStudent(user.id, user.name)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Curricula Section */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
            Assigned Curricula ({classData.curriculumAssignments.length})
          </h3>
        </CardHeader>
        <CardBody>
          {unassignedCurricula.length > 0 && (
            <div className="flex gap-3 mb-4">
              <select
                value={selectedCurriculum}
                onChange={(e) => setSelectedCurriculum(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value="">Select a curriculum to assign...</option>
                {unassignedCurricula.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Button
                onClick={handleAddCurriculum}
                disabled={addingCurriculum || !selectedCurriculum}
              >
                {addingCurriculum ? "Assigning..." : "Assign"}
              </Button>
            </div>
          )}

          {classData.curriculumAssignments.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              No curricula assigned yet. Assign curricula for students to study.
            </p>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {classData.curriculumAssignments.map(({ curriculum }) => (
                <div
                  key={curriculum.id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {curriculum.name}
                    </p>
                    {curriculum.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {curriculum.description}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/educator/curricula/${curriculum.id}`}>
                      <Button variant="ghost" size="sm">
                        Edit
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveCurriculum(curriculum.id, curriculum.name)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {unassignedCurricula.length === 0 && availableCurricula.length > 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              All your curricula are assigned to this class.
            </p>
          )}

          {availableCurricula.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              <Link href="/educator/curricula/new" className="text-blue-600 dark:text-blue-400 hover:underline">
                Create a curriculum
              </Link>{" "}
              to assign to this class.
            </p>
          )}
        </CardBody>
      </Card>

      {/* Analytics Section */}
      {classData.enrollments.length > 0 && classData.curriculumAssignments.length > 0 && (
        <ClassAnalytics classId={classData.id} />
      )}
    </div>
  );
}
