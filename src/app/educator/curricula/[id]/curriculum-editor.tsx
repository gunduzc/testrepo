"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { SubjectForm } from "@/components/educator/subject-form";
import { PrerequisiteSelect } from "@/components/educator/prerequisite-select";
import { CurriculumWithStructure } from "@/lib/types";
import Link from "next/link";

interface CurriculumEditorProps {
  curriculum: CurriculumWithStructure;
}

export function CurriculumEditor({ curriculum: initialCurriculum }: CurriculumEditorProps) {
  const router = useRouter();
  const [curriculum, setCurriculum] = useState(initialCurriculum);
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [isAddingSubject, setIsAddingSubject] = useState(false);
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState(curriculum.name);
  const [editDescription, setEditDescription] = useState(curriculum.description || "");
  const [editIsPublic, setEditIsPublic] = useState(curriculum.isPublic);
  const [isSaving, setIsSaving] = useState(false);

  const refreshCurriculum = async () => {
    const res = await fetch(`/api/curricula/${curriculum.id}`);
    const data = await res.json();
    if (data.success && data.data) {
      setCurriculum(data.data);
    }
  };

  const handleSaveInfo = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/curricula/${curriculum.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          description: editDescription,
          isPublic: editIsPublic,
        }),
      });

      if (res.ok) {
        setCurriculum((prev) => ({
          ...prev,
          name: editName,
          description: editDescription,
          isPublic: editIsPublic,
        }));
        setIsEditingInfo(false);
      }
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCurriculum = async () => {
    if (!confirm("Are you sure you want to delete this curriculum? This cannot be undone.")) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/curricula/${curriculum.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        router.push("/educator");
      }
    } catch (error) {
      console.error("Failed to delete:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteSubject = async (subjectId: string) => {
    if (!confirm("Delete this subject and remove all its cards?")) {
      return;
    }

    try {
      const res = await fetch(`/api/subjects/${subjectId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        refreshCurriculum();
      }
    } catch (error) {
      console.error("Failed to delete subject:", error);
    }
  };

  const handleRemoveCard = async (subjectId: string, cardId: string) => {
    try {
      const res = await fetch(`/api/subjects/${subjectId}/cards`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId }),
      });

      if (res.ok) {
        refreshCurriculum();
      }
    } catch (error) {
      console.error("Failed to remove card:", error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Curriculum Info */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {curriculum.name}
            </h2>
            {curriculum.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {curriculum.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-1 text-xs rounded-full ${
                curriculum.isPublic
                  ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
              }`}
            >
              {curriculum.isPublic ? "Public" : "Private"}
            </span>
            <Button size="sm" variant="ghost" onClick={() => setIsEditingInfo(true)}>
              Edit
            </Button>
            <a href={`/api/curricula/${curriculum.id}/export`} download>
              <Button size="sm" variant="ghost">
                Export
              </Button>
            </a>
            <Button
              size="sm"
              variant="danger"
              onClick={handleDeleteCurriculum}
              disabled={isDeleting}
            >
              Delete
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Subjects */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Subjects ({curriculum.subjects.length})
        </h3>
        <Button onClick={() => setIsAddingSubject(true)}>Add Subject</Button>
      </div>

      {curriculum.subjects.length === 0 ? (
        <Card>
          <CardBody className="text-center py-8">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              No subjects yet. Add your first subject to start organizing cards.
            </p>
            <Button onClick={() => setIsAddingSubject(true)}>Add Subject</Button>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {curriculum.subjects.map((subject) => (
            <Card key={subject.id}>
              <CardHeader
                className="cursor-pointer"
                onClick={() =>
                  setExpandedSubject(expandedSubject === subject.id ? null : subject.id)
                }
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${
                        expandedSubject === subject.id ? "rotate-90" : ""
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-gray-100">
                        {subject.name}
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {subject.cards.length} card{subject.cards.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <Link href={`/educator/curricula/${curriculum.id}/subjects/${subject.id}/cards/new`}>
                      <Button size="sm" variant="ghost">
                        + Add Card
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteSubject(subject.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {expandedSubject === subject.id && (
                <CardBody className="border-t border-gray-200 dark:border-gray-800 space-y-4">
                  {subject.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {subject.description}
                    </p>
                  )}

                  {/* Prerequisites */}
                  <PrerequisiteSelect
                    subjectId={subject.id}
                    subjectName={subject.name}
                    allSubjects={curriculum.subjects.map((s) => ({
                      id: s.id,
                      name: s.name,
                    }))}
                    currentPrerequisites={subject.prerequisites}
                    onUpdate={refreshCurriculum}
                  />

                  {/* Cards */}
                  <div>
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Cards
                    </div>
                    {subject.cards.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        No cards yet.{" "}
                        <button
                          onClick={() => setCardPickerSubject(subject)}
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Add some
                        </button>
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {subject.cards.map(({ card, cardId }) => (
                          <div
                            key={cardId}
                            className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg"
                          >
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {card.name}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {card.answerType}
                              </p>
                            </div>
                            <button
                              onClick={() => handleRemoveCard(subject.id, cardId)}
                              className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardBody>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Edit Curriculum Modal */}
      <Modal isOpen={isEditingInfo} onClose={() => setIsEditingInfo(false)} title="Edit Curriculum">
        <div className="space-y-4">
          <Input
            label="Name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
          />
          <Textarea
            label="Description"
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
          />
          <Checkbox
            label="Make this curriculum public"
            checked={editIsPublic}
            onChange={(e) => setEditIsPublic(e.target.checked)}
          />
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setIsEditingInfo(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveInfo} disabled={isSaving || !editName.trim()}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Subject Modal */}
      <Modal
        isOpen={isAddingSubject}
        onClose={() => setIsAddingSubject(false)}
        title="Add Subject"
      >
        <SubjectForm
          curriculumId={curriculum.id}
          onSuccess={() => {
            setIsAddingSubject(false);
            refreshCurriculum();
          }}
          onCancel={() => setIsAddingSubject(false)}
        />
      </Modal>

    </div>
  );
}
