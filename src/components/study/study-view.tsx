"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QuestionRenderer } from "./question-renderer";
import { AnswerInput } from "./answer-input";
import { QuestionPresentation, SubmissionResult, AnswerType } from "@/lib/types";

interface StudyViewProps {
  curriculumId: string;
  previewMode?: boolean;
}

type StudyState = "loading" | "question" | "feedback" | "complete";

export function StudyView({ curriculumId, previewMode = false }: StudyViewProps) {
  const [state, setState] = useState<StudyState>("loading");
  const [question, setQuestion] = useState<QuestionPresentation | null>(null);
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [nextDue, setNextDue] = useState<Date | null>(null);
  const [startTime, setStartTime] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);

  const fetchNextQuestion = useCallback(async () => {
    setState("loading");
    try {
      const url = previewMode
        ? `/api/study/${curriculumId}?preview=true`
        : `/api/study/${curriculumId}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.data) {
        setQuestion(data.data);
        setStartTime(Date.now());
        setState("question");
      } else {
        setNextDue(data.nextDue ? new Date(data.nextDue) : null);
        setState("complete");
      }
    } catch (error) {
      console.error("Failed to fetch question:", error);
      setState("complete");
    }
  }, [curriculumId, previewMode]);

  useEffect(() => {
    fetchNextQuestion();
  }, [fetchNextQuestion]);

  const handleSubmit = async (answer: string) => {
    if (!question) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      if (previewMode) {
        // In preview mode, don't save progress - just show feedback
        const isCorrect = answer.trim().toLowerCase() === question.correctAnswer?.trim().toLowerCase();
        setResult({
          correct: isCorrect,
          correctAnswer: question.correctAnswer || "N/A",
          solution: question.solution || question.correctAnswer || "N/A",
          progress: {},
          canUndo: false,
        });
        setCanUndo(false);
        setState("feedback");
      } else {
        const res = await fetch("/api/study/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: question.sessionId,
            answer,
          }),
        });

        const data = await res.json();

        if (data.success) {
          setResult(data.data);
          setCanUndo(data.data.canUndo ?? false);
          setSubmitError(null);
          setState("feedback");
        } else if (data.error?.code === "SESSION_NOT_FOUND") {
          // Session expired or lost — refetch question to get a new session
          setSubmitError("Session expired. Loading new question...");
          fetchNextQuestion();
        } else {
          setSubmitError(data.error?.message || "Failed to submit answer. Please try again.");
        }
      }
    } catch (error) {
      console.error("Failed to submit answer:", error);
      setSubmitError("Connection error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContinue = () => {
    setResult(null);
    setQuestion(null);
    setCanUndo(false);
    setSubmitError(null);
    fetchNextQuestion();
  };

  const handleUndo = async () => {
    setIsUndoing(true);
    try {
      const res = await fetch("/api/study/undo", {
        method: "POST",
      });
      const data = await res.json();

      if (data.success) {
        setCanUndo(false);
        setResult(null);
        setQuestion(null);
        // Re-fetch - the undone card should come back
        fetchNextQuestion();
      } else {
        console.error("Undo failed:", data.message);
      }
    } catch (error) {
      console.error("Undo failed:", error);
    } finally {
      setIsUndoing(false);
    }
  };

  // Loading state
  if (state === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[300px] sm:min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">Loading...</p>
        </div>
      </div>
    );
  }

  // Complete state (no more cards due)
  if (state === "complete") {
    const now = new Date();
    const isDueSoon = nextDue && nextDue <= new Date(now.getTime() + 60000); // Due within 1 minute
    const isPastDue = nextDue && nextDue <= now;

    const formatDueTime = () => {
      if (!nextDue) return "No more cards to review right now.";
      if (isPastDue) return "You have cards ready for review!";
      if (isDueSoon) {
        const seconds = Math.ceil((nextDue.getTime() - now.getTime()) / 1000);
        return `Next review in ${seconds} seconds`;
      }
      return `Next review due: ${nextDue.toLocaleDateString()} at ${nextDue.toLocaleTimeString()}`;
    };

    return (
      <Card>
        <CardBody className="text-center py-8 sm:py-12 px-4 sm:px-6">
          <div className="text-5xl sm:text-6xl mb-4">{isPastDue ? "📚" : "🎉"}</div>
          <h2 className="text-xl sm:text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100">
            {isPastDue ? "Cards Ready!" : "All caught up!"}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base mb-6">{formatDueTime()}</p>
          <Button onClick={fetchNextQuestion} className="w-full sm:w-auto">
            {isPastDue ? "Continue Studying" : "Check Again"}
          </Button>
        </CardBody>
      </Card>
    );
  }

  // Feedback state
  if (state === "feedback" && result) {
    return (
      <Card>
        <CardBody className="py-6 sm:py-8 px-4 sm:px-6">
          <div className={`text-center mb-4 sm:mb-6 ${result.correct ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
            <div className="text-5xl sm:text-6xl mb-2">{result.correct ? "✓" : "✗"}</div>
            <h2 className="text-xl sm:text-2xl font-bold">
              {result.correct ? "Correct!" : "Incorrect"}
            </h2>
          </div>

          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6 space-y-2">
            {!result.correct && (
              <div>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">Correct answer:</p>
                <div className="text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100">
                  <QuestionRenderer content={result.correctAnswer} />
                </div>
              </div>
            )}
            <div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">Solution:</p>
              <div className="text-sm sm:text-base text-gray-700 dark:text-gray-300">
                <QuestionRenderer content={result.solution} />
              </div>
            </div>
          </div>

          {result.progress?.completionPercentage !== undefined && (
            <div className="mb-4 sm:mb-6">
              <div className="flex justify-between text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">
                <span>Progress</span>
                <span>{result.progress.completionPercentage.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    result.progress.completionPercentage >= 80
                      ? "bg-green-500"
                      : result.progress.completionPercentage >= 50
                      ? "bg-yellow-500"
                      : "bg-blue-500"
                  }`}
                  style={{ width: `${Math.min(result.progress.completionPercentage, 100)}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            {canUndo && (
              <Button
                onClick={handleUndo}
                disabled={isUndoing}
                className="w-full sm:flex-1 bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              >
                {isUndoing ? "Undoing..." : "Undo"}
              </Button>
            )}
            <Button onClick={handleContinue} className="w-full sm:flex-1">
              Continue
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  // Question state
  if (state === "question" && question) {
    return (
      <Card>
        <CardBody className="py-6 sm:py-8 px-4 sm:px-6">
          <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-3 sm:mb-4">
            {question.subjectName && <span>{question.subjectName} • </span>}
            <span>{question.cardName}</span>
          </div>

          <div className="mb-6 sm:mb-8 text-lg sm:text-xl">
            <QuestionRenderer content={question.question} />
          </div>

          {submitError && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-sm">
              {submitError}
            </div>
          )}

          <AnswerInput
            key={question.sessionId}
            answerType={question.answerType as AnswerType}
            choices={question.choices}
            onSubmit={handleSubmit}
            disabled={isSubmitting}
          />
        </CardBody>
      </Card>
    );
  }

  return null;
}
