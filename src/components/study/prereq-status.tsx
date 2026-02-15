"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface MissingPrereq {
  subjectId: string;
  subjectName: string;
  completionPercentage: number;
}

interface SubjectPrereqStatus {
  subjectId: string;
  subjectName: string;
  isUnlocked: boolean;
  missingPrereqs: MissingPrereq[];
}

interface CurriculumPrereqStatus {
  curriculumId: string;
  enforcement: "hard" | "soft" | "none";
  canEnroll: boolean;
  canStudy: boolean;
  subjects: SubjectPrereqStatus[];
  blockedSubjects: SubjectPrereqStatus[];
  warningSubjects: SubjectPrereqStatus[];
}

interface PrereqStatusProps {
  curriculumId: string;
  onStatusLoaded?: (status: CurriculumPrereqStatus) => void;
}

export function PrereqStatus({ curriculumId, onStatusLoaded }: PrereqStatusProps) {
  const [status, setStatus] = useState<CurriculumPrereqStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/curricula/${curriculumId}/prereqs`);
        const data = await res.json();

        if (data.success) {
          setStatus(data.data);
          onStatusLoaded?.(data.data);
        } else {
          setError(data.error?.message || "Failed to load prerequisite status");
        }
      } catch (err) {
        setError("Failed to load prerequisite status");
      } finally {
        setIsLoading(false);
      }
    };

    fetchStatus();
  }, [curriculumId, onStatusLoaded]);

  if (isLoading || error || !status) {
    return null; // Don't show anything while loading or on error
  }

  // No enforcement or no warnings/blocks
  if (status.enforcement === "none") {
    return null;
  }

  const hasBlockedSubjects = status.blockedSubjects.length > 0;
  const hasWarningSubjects = status.warningSubjects.length > 0;

  if (!hasBlockedSubjects && !hasWarningSubjects) {
    return null;
  }

  const isHardEnforcement = status.enforcement === "hard";

  return (
    <Card
      className={`mb-4 ${
        isHardEnforcement && hasBlockedSubjects
          ? "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20"
          : "border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20"
      }`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <h3
            className={`font-semibold ${
              isHardEnforcement && hasBlockedSubjects
                ? "text-red-700 dark:text-red-400"
                : "text-yellow-700 dark:text-yellow-400"
            }`}
          >
            {isHardEnforcement && hasBlockedSubjects
              ? "Prerequisites Required"
              : "Prerequisites Recommended"}
          </h3>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm text-gray-500 dark:text-gray-400 hover:underline"
          >
            {isExpanded ? "Hide details" : "Show details"}
          </button>
        </div>
      </CardHeader>
      <CardBody className="pt-0">
        <p
          className={`text-sm ${
            isHardEnforcement && hasBlockedSubjects
              ? "text-red-600 dark:text-red-300"
              : "text-yellow-600 dark:text-yellow-300"
          }`}
        >
          {isHardEnforcement && hasBlockedSubjects
            ? `${status.blockedSubjects.length} subject(s) are locked until you complete their prerequisites.`
            : `${status.warningSubjects.length} subject(s) have recommended prerequisites you haven't completed.`}
        </p>

        {isExpanded && (
          <div className="mt-4 space-y-3">
            {(isHardEnforcement ? status.blockedSubjects : status.warningSubjects).map(
              (subject) => (
                <div
                  key={subject.subjectId}
                  className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <div className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                    {subject.subjectName}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Missing prerequisites:
                  </div>
                  <ul className="mt-1 space-y-1">
                    {subject.missingPrereqs.map((prereq) => (
                      <li
                        key={prereq.subjectId}
                        className="text-sm flex items-center gap-2"
                      >
                        <span
                          className={`inline-block w-2 h-2 rounded-full ${
                            prereq.completionPercentage >= 80
                              ? "bg-green-500"
                              : prereq.completionPercentage >= 50
                              ? "bg-yellow-500"
                              : "bg-red-500"
                          }`}
                        />
                        <span className="text-gray-700 dark:text-gray-300">
                          {prereq.subjectName}
                        </span>
                        <span className="text-gray-400 dark:text-gray-500">
                          ({prereq.completionPercentage}% complete)
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            )}
          </div>
        )}

        {isHardEnforcement && hasBlockedSubjects && (
          <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            Complete the required prerequisites to unlock all subjects. Cards from unlocked
            subjects are still available for study.
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/**
 * Inline prereq warning for individual subjects
 */
interface SubjectPrereqWarningProps {
  subjectId: string;
  className?: string;
}

export function SubjectPrereqWarning({ subjectId, className = "" }: SubjectPrereqWarningProps) {
  const [status, setStatus] = useState<{
    isUnlocked: boolean;
    missingPrereqs: MissingPrereq[];
    access: { allowed: boolean; reason?: string; enforcement: string };
  } | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/subjects/${subjectId}/prereqs`);
        const data = await res.json();

        if (data.success) {
          setStatus(data.data);
        }
      } catch (err) {
        // Silently fail
      }
    };

    fetchStatus();
  }, [subjectId]);

  if (!status || status.isUnlocked || status.access.enforcement === "none") {
    return null;
  }

  const isBlocked = !status.access.allowed;

  return (
    <div
      className={`text-sm p-2 rounded ${
        isBlocked
          ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
          : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
      } ${className}`}
    >
      {isBlocked ? "🔒 " : "⚠️ "}
      {status.access.reason}
    </div>
  );
}
