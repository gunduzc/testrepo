"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AnswerType } from "@/lib/types";

interface AnswerInputProps {
  answerType: AnswerType;
  choices?: string[];
  onSubmit: (answer: string) => void;
  disabled?: boolean;
}

export function AnswerInput({ answerType, choices, onSubmit, disabled }: AnswerInputProps) {
  const [answer, setAnswer] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (answer.trim()) {
      onSubmit(answer.trim());
      setAnswer("");
    }
  };

  const handleChoiceSelect = (choice: string) => {
    onSubmit(choice);
  };

  // Choice-based answer
  if (answerType === "CHOICE" && choices) {
    return (
      <div className="space-y-2 sm:space-y-3">
        {choices.map((choice, index) => (
          <button
            key={index}
            onClick={() => handleChoiceSelect(choice)}
            disabled={disabled}
            className="w-full p-3 sm:p-4 text-left text-sm sm:text-base border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-500 dark:hover:border-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="font-medium mr-2 sm:mr-3">{String.fromCharCode(65 + index)}.</span>
            {choice}
          </button>
        ))}
      </div>
    );
  }

  // Text-based answer
  const inputProps: Record<AnswerType, { type: string; placeholder: string; inputMode?: string }> = {
    INTEGER: { type: "text", placeholder: "Enter an integer (e.g., 42)", inputMode: "numeric" },
    DECIMAL: { type: "text", placeholder: "Enter a number (e.g., 3.14)", inputMode: "decimal" },
    TEXT: { type: "text", placeholder: "Enter your answer" },
    FRACTION: { type: "text", placeholder: "Enter a fraction (e.g., 2/3)" },
    CHOICE: { type: "text", placeholder: "" },
  };

  const { type, placeholder, inputMode } = inputProps[answerType];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        type={type}
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode as any}
        disabled={disabled}
        className="text-lg py-3"
        autoFocus
      />
      <Button type="submit" disabled={disabled || !answer.trim()} className="w-full">
        Submit Answer
      </Button>
    </form>
  );
}
