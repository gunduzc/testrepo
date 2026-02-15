"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Subject {
  id: string;
  name: string;
}

interface PrerequisiteSelectProps {
  subjectId: string;
  subjectName: string;
  allSubjects: Subject[];
  currentPrerequisites: string[];
  onUpdate: () => void;
}

export function PrerequisiteSelect({
  subjectId,
  subjectName,
  allSubjects,
  currentPrerequisites,
  onUpdate,
}: PrerequisiteSelectProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);

  // Available subjects that can be prerequisites (not self, not already a prereq)
  const availablePrereqs = allSubjects.filter(
    (s) => s.id !== subjectId && !currentPrerequisites.includes(s.id)
  );

  const currentPrereqSubjects = allSubjects.filter((s) =>
    currentPrerequisites.includes(s.id)
  );

  const handleAddPrerequisite = async (prerequisiteId: string) => {
    setIsAdding(true);
    try {
      const res = await fetch(`/api/subjects/${subjectId}/prerequisites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prerequisiteId }),
      });

      if (res.ok) {
        onUpdate();
      } else {
        const data = await res.json();
        alert(data.error?.message || "Failed to add prerequisite");
      }
    } catch (error) {
      console.error("Failed to add prerequisite:", error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemovePrerequisite = async (prerequisiteId: string) => {
    setIsRemoving(prerequisiteId);
    try {
      const res = await fetch(`/api/subjects/${subjectId}/prerequisites`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prerequisiteId }),
      });

      if (res.ok) {
        onUpdate();
      }
    } catch (error) {
      console.error("Failed to remove prerequisite:", error);
    } finally {
      setIsRemoving(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Prerequisites for &quot;{subjectName}&quot;
      </div>

      {currentPrereqSubjects.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {currentPrereqSubjects.map((prereq) => (
            <span
              key={prereq.id}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm"
            >
              {prereq.name}
              <button
                onClick={() => handleRemovePrerequisite(prereq.id)}
                disabled={isRemoving === prereq.id}
                className="hover:text-red-600 dark:hover:text-red-400"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">No prerequisites set</p>
      )}

      {availablePrereqs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {availablePrereqs.map((subject) => (
            <Button
              key={subject.id}
              size="sm"
              variant="ghost"
              onClick={() => handleAddPrerequisite(subject.id)}
              disabled={isAdding}
              className="text-xs"
            >
              + {subject.name}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
