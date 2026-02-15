"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface DailyStats {
  date: string;
  reviews: number;
  correct: number;
  avgResponseMs: number;
}

interface StudyStats {
  totalReviews: number;
  totalCorrect: number;
  overallAccuracy: number;
  averageResponseMs: number;
  cardsStudied: number;
  cardsMastered: number;
  currentStreak: number;
  longestStreak: number;
  dailyStats: DailyStats[];
  recentActivity: {
    today: number;
    yesterday: number;
    thisWeek: number;
    thisMonth: number;
  };
}

interface OptimizationStatus {
  hasCustomParameters: boolean;
  reviewCount: number;
  recentAccuracy: number | null;
  canOptimize: boolean;
  minimumReviewsNeeded: number;
}

export default function StatsPage() {
  const [stats, setStats] = useState<StudyStats | null>(null);
  const [optimization, setOptimization] = useState<OptimizationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, optRes] = await Promise.all([
          fetch("/api/user/stats"),
          fetch("/api/user/optimization"),
        ]);

        const statsData = await statsRes.json();
        const optData = await optRes.json();

        if (statsData.success) setStats(statsData.data);
        if (optData.success) setOptimization(optData.data);
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleOptimize = async () => {
    setOptimizing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/user/optimization", { method: "POST" });
      const data = await res.json();

      if (data.success) {
        setMessage({ type: "success", text: "FSRS parameters optimized successfully!" });
        setOptimization((prev) => prev ? { ...prev, hasCustomParameters: true } : null);
      } else {
        setMessage({ type: "error", text: data.error?.message || "Optimization failed" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to optimize parameters" });
    } finally {
      setOptimizing(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/user/optimization", { method: "DELETE" });
      const data = await res.json();

      if (data.success) {
        setMessage({ type: "success", text: "Parameters reset to defaults" });
        setOptimization((prev) => prev ? { ...prev, hasCustomParameters: false } : null);
      } else {
        setMessage({ type: "error", text: data.error?.message || "Reset failed" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to reset parameters" });
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <p className="text-gray-600 dark:text-gray-400">Loading statistics...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-4 sm:py-8">
      <div className="container mx-auto px-3 sm:px-4 max-w-4xl">
        <div className="mb-4">
          <Link href="/dashboard" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">
            &larr; Back to Dashboard
          </Link>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-gray-900 dark:text-gray-100">
          Study Statistics
        </h1>

        {/* Message */}
        {message && (
          <div
            className={`mb-4 p-3 rounded-lg ${
              message.type === "success"
                ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Overview Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <Card>
              <CardBody className="text-center py-4">
                <div className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {stats.totalReviews}
                </div>
                <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Total Reviews</div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="text-center py-4">
                <div className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400">
                  {(stats.overallAccuracy * 100).toFixed(1)}%
                </div>
                <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Accuracy</div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="text-center py-4">
                <div className="text-2xl sm:text-3xl font-bold text-purple-600 dark:text-purple-400">
                  {stats.cardsMastered}
                </div>
                <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Cards Mastered</div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="text-center py-4">
                <div className="text-2xl sm:text-3xl font-bold text-orange-600 dark:text-orange-400">
                  {stats.currentStreak}
                </div>
                <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Day Streak</div>
              </CardBody>
            </Card>
          </div>
        )}

        {/* Recent Activity */}
        {stats && (
          <Card className="mb-6">
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Recent Activity</h2>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {stats.recentActivity.today}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Today</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {stats.recentActivity.yesterday}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Yesterday</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {stats.recentActivity.thisWeek}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">This Week</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {stats.recentActivity.thisMonth}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">This Month</div>
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Daily Activity Chart (Simple) */}
        {stats && stats.dailyStats.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Last 30 Days Activity
              </h2>
            </CardHeader>
            <CardBody>
              <div className="flex items-end gap-1 h-32 overflow-x-auto">
                {stats.dailyStats.map((day) => {
                  const maxReviews = Math.max(...stats.dailyStats.map((d) => d.reviews));
                  const height = maxReviews > 0 ? (day.reviews / maxReviews) * 100 : 0;
                  const accuracy = day.reviews > 0 ? day.correct / day.reviews : 0;

                  return (
                    <div key={day.date} className="flex flex-col items-center min-w-[12px]">
                      <div
                        className={`w-3 rounded-t ${
                          accuracy >= 0.8
                            ? "bg-green-500"
                            : accuracy >= 0.6
                            ? "bg-yellow-500"
                            : "bg-red-500"
                        }`}
                        style={{ height: `${height}%`, minHeight: day.reviews > 0 ? "4px" : "0" }}
                        title={`${day.date}: ${day.reviews} reviews, ${(accuracy * 100).toFixed(0)}% accuracy`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-2 text-xs text-gray-400">
                <span>30 days ago</span>
                <span>Today</span>
              </div>
            </CardBody>
          </Card>
        )}

        {/* FSRS Optimization */}
        {optimization && (
          <Card className="mb-6">
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                FSRS Parameter Optimization
              </h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                FSRS (Free Spaced Repetition Scheduler) uses your review history to
                optimize scheduling parameters for better retention with less review time.
              </div>

              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Review count:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {optimization.reviewCount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Minimum needed:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {optimization.minimumReviewsNeeded}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Custom parameters:</span>
                  <span
                    className={`font-medium ${
                      optimization.hasCustomParameters
                        ? "text-green-600 dark:text-green-400"
                        : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {optimization.hasCustomParameters ? "Yes" : "No (using defaults)"}
                  </span>
                </div>
                {optimization.recentAccuracy !== null && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Recent accuracy:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {(optimization.recentAccuracy * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleOptimize}
                  disabled={!optimization.canOptimize || optimizing}
                  className="flex-1"
                >
                  {optimizing ? "Optimizing..." : "Optimize Parameters"}
                </Button>
                {optimization.hasCustomParameters && (
                  <Button
                    onClick={handleReset}
                    disabled={resetting}
                    variant="secondary"
                    className="flex-1"
                  >
                    {resetting ? "Resetting..." : "Reset to Defaults"}
                  </Button>
                )}
              </div>

              {!optimization.canOptimize && (
                <p className="text-sm text-yellow-600 dark:text-yellow-400">
                  Complete at least {optimization.minimumReviewsNeeded} reviews to enable
                  optimization. You have {optimization.reviewCount} reviews so far.
                </p>
              )}
            </CardBody>
          </Card>
        )}

        {/* Performance Details */}
        {stats && (
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Performance Details
              </h2>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Cards studied:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                    {stats.cardsStudied}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Correct answers:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                    {stats.totalCorrect}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Avg response time:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                    {(stats.averageResponseMs / 1000).toFixed(1)}s
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Longest streak:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                    {stats.longestStreak} days
                  </span>
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Data Export */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Data Export
            </h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Download a complete copy of your data including your profile, study progress,
              review history, and any content you&apos;ve created. This export is provided in
              JSON format for GDPR compliance.
            </p>
            <Button
              onClick={() => {
                window.location.href = "/api/user/export";
              }}
              variant="secondary"
            >
              Download My Data
            </Button>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
