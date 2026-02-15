"use client";

import { useState, useEffect } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

interface CurriculumProgress {
  curriculumId: string;
  curriculumName: string;
  totalCards: number;
  cardsStudied: number;
  cardsMastered: number;
  totalReviews: number;
  correctReviews: number;
  accuracy: number;
  lastActivity: string | null;
  completionPercentage: number;
}

interface StudentProgress {
  userId: string;
  userName: string | null;
  userEmail: string;
  curricula: CurriculumProgress[];
  overallStats: {
    totalReviews: number;
    accuracy: number;
    lastActivity: string | null;
  };
}

interface ClassAnalytics {
  classId: string;
  className: string;
  totalStudents: number;
  totalCurricula: number;
  students: StudentProgress[];
  classAverages: {
    averageAccuracy: number;
    averageCompletion: number;
    totalReviews: number;
    activeStudents: number;
  };
}

interface ClassAnalyticsProps {
  classId: string;
}

export function ClassAnalytics({ classId }: ClassAnalyticsProps) {
  const [analytics, setAnalytics] = useState<ClassAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await fetch(`/api/classes/${classId}/analytics`);
        const data = await res.json();

        if (data.success) {
          setAnalytics(data.data);
        } else {
          setError(data.error?.message || "Failed to load analytics");
        }
      } catch (err) {
        setError("Failed to load analytics");
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [classId]);

  if (loading) {
    return (
      <Card>
        <CardBody className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">Loading analytics...</p>
        </CardBody>
      </Card>
    );
  }

  if (error || !analytics) {
    return (
      <Card>
        <CardBody className="text-center py-8">
          <p className="text-red-600 dark:text-red-400">{error || "Failed to load analytics"}</p>
        </CardBody>
      </Card>
    );
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return "bg-green-500";
    if (percentage >= 50) return "bg-yellow-500";
    if (percentage >= 20) return "bg-orange-500";
    return "bg-red-500";
  };

  const getActivityStatus = (lastActivity: string | null) => {
    if (!lastActivity) return { label: "Inactive", color: "text-gray-400" };
    const date = new Date(lastActivity);
    const diffDays = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= 1) return { label: "Active", color: "text-green-500" };
    if (diffDays <= 7) return { label: "Recent", color: "text-yellow-500" };
    return { label: "Inactive", color: "text-red-500" };
  };

  return (
    <div className="space-y-6">
      {/* Class Overview */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
            Class Overview
          </h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {analytics.totalStudents}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Students</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {analytics.classAverages.activeStudents}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Active (7d)</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {(analytics.classAverages.averageAccuracy * 100).toFixed(0)}%
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Avg Accuracy</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {analytics.classAverages.averageCompletion.toFixed(0)}%
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Avg Completion</div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Student Progress */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
            Student Progress
          </h3>
        </CardHeader>
        <CardBody className="p-0">
          {analytics.students.length === 0 ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              No students enrolled yet.
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {analytics.students.map((student) => {
                const activityStatus = getActivityStatus(student.overallStats.lastActivity);
                const isExpanded = expandedStudent === student.userId;

                return (
                  <div key={student.userId}>
                    <button
                      onClick={() => setExpandedStudent(isExpanded ? null : student.userId)}
                      className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 dark:text-gray-100">
                              {student.userName || student.userEmail}
                            </span>
                            <span className={`text-xs ${activityStatus.color}`}>
                              {activityStatus.label}
                            </span>
                          </div>
                          {student.userName && (
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {student.userEmail}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-6 text-sm">
                          <div className="text-right">
                            <div className="font-medium text-gray-900 dark:text-gray-100">
                              {student.overallStats.totalReviews}
                            </div>
                            <div className="text-gray-500 dark:text-gray-400">reviews</div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium text-gray-900 dark:text-gray-100">
                              {(student.overallStats.accuracy * 100).toFixed(0)}%
                            </div>
                            <div className="text-gray-500 dark:text-gray-400">accuracy</div>
                          </div>
                          <div className="text-right min-w-[80px]">
                            <div className="text-gray-500 dark:text-gray-400">
                              {formatDate(student.overallStats.lastActivity)}
                            </div>
                          </div>
                          <div className="text-gray-400">
                            {isExpanded ? "▲" : "▼"}
                          </div>
                        </div>
                      </div>
                    </button>

                    {/* Expanded details */}
                    {isExpanded && student.curricula.length > 0 && (
                      <div className="px-4 pb-4 bg-gray-50 dark:bg-gray-800/30">
                        <div className="space-y-3">
                          {student.curricula.map((curriculum) => (
                            <div
                              key={curriculum.curriculumId}
                              className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                  {curriculum.curriculumName}
                                </span>
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                  {curriculum.cardsMastered}/{curriculum.totalCards} mastered
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
                                <div
                                  className={`h-2 rounded-full ${getProgressColor(
                                    curriculum.completionPercentage
                                  )}`}
                                  style={{ width: `${curriculum.completionPercentage}%` }}
                                />
                              </div>
                              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                                <span>
                                  {curriculum.totalReviews} reviews ({(curriculum.accuracy * 100).toFixed(0)}% accuracy)
                                </span>
                                <span>Last: {formatDate(curriculum.lastActivity)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
