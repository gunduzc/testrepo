"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QuestionRenderer } from "./question-renderer";
import { AnswerInput } from "./answer-input";
import { QuestionPresentation, SubmissionResult, AnswerType } from "@/lib/types";

interface StudyViewProps {
  curriculumId: string;
}

type StudyState = "loading" | "question" | "feedback" | "complete";

export function StudyView({ curriculumId }: StudyViewProps) {
  const [state, setState] = useState<StudyState>("loading");
  const [question, setQuestion] = useState<QuestionPresentation | null>(null);
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [nextDue, setNextDue] = useState<Date | null>(null);
  const [startTime, setStartTime] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchNextQuestion = useCallback(async () => {
    setState("loading");
    try {
      const res = await fetch(`/api/study/${curriculumId}`);
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
  }, [curriculumId]);

  useEffect(() => {
    fetchNextQuestion();
  }, [fetchNextQuestion]);

  const handleSubmit = async (answer: string) => {
    if (!question) return;

    setIsSubmitting(true);
    try {
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
        setState("feedback");
      } else {
        console.error("Submit failed:", data.error);
      }
    } catch (error) {
      console.error("Failed to submit answer:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContinue = () => {
    setResult(null);
    setQuestion(null);
    fetchNextQuestion();
  };

  // Loading state
  if (state === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading next question...</p>
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
      <Card className="max-w-2xl mx-auto">
        <CardBody className="text-center py-12">
          <div className="text-6xl mb-4">{isPastDue ? "📚" : "🎉"}</div>
          <h2 className="text-2xl font-bold mb-2">
            {isPastDue ? "Cards Ready!" : "All caught up!"}
          </h2>
          <p className="text-gray-600 mb-6">{formatDueTime()}</p>
          <Button onClick={fetchNextQuestion}>
            {isPastDue ? "Continue Studying" : "Check Again"}
          </Button>
        </CardBody>
      </Card>
    );
  }

  // Feedback state
  if (state === "feedback" && result) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardBody className="py-8">
          <div className={`text-center mb-6 ${result.correct ? "text-green-600" : "text-red-600"}`}>
            <div className="text-6xl mb-2">{result.correct ? "✓" : "✗"}</div>
            <h2 className="text-2xl font-bold">
              {result.correct ? "Correct!" : "Incorrect"}
            </h2>
          </div>

          {!result.correct && (
            <div className="bg-gray-100 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-500 mb-1">Correct answer:</p>
              <p className="text-lg font-medium">{result.correctAnswer}</p>
            </div>
          )}

          <div className="flex justify-between items-center text-sm text-gray-500 mb-6">
            <span>Rating: {result.rating}</span>
            <span>Progress: {result.progress.completionPercentage.toFixed(1)}%</span>
          </div>

          <Button onClick={handleContinue} className="w-full">
            Continue
          </Button>
        </CardBody>
      </Card>
    );
  }

  // Question state
  if (state === "question" && question) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardBody className="py-8">
          <div className="text-sm text-gray-500 mb-4">
            {question.subjectName && <span>{question.subjectName} • </span>}
            <span>{question.cardName}</span>
          </div>

          <div className="mb-8">
            <QuestionRenderer content={question.question} />
          </div>

          <AnswerInput
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
