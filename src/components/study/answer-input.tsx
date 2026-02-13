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
    }
  };

  const handleChoiceSelect = (choice: string) => {
    onSubmit(choice);
  };

  // Choice-based answer
  if (answerType === "CHOICE" && choices) {
    return (
      <div className="space-y-3">
        {choices.map((choice, index) => (
          <button
            key={index}
            onClick={() => handleChoiceSelect(choice)}
            disabled={disabled}
            className="w-full p-4 text-left border rounded-lg hover:bg-blue-50 hover:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="font-medium mr-3">{String.fromCharCode(65 + index)}.</span>
            {choice}
          </button>
        ))}
      </div>
    );
  }

  // Text-based answer
  const inputProps: Record<AnswerType, { type: string; placeholder: string; pattern?: string }> = {
    INTEGER: { type: "text", placeholder: "Enter an integer (e.g., 42)", pattern: "-?\\d+" },
    DECIMAL: { type: "text", placeholder: "Enter a number (e.g., 3.14)", pattern: "-?\\d*\\.?\\d+" },
    TEXT: { type: "text", placeholder: "Enter your answer" },
    FRACTION: { type: "text", placeholder: "Enter a fraction (e.g., 2/3)", pattern: "-?\\d+/?\\d*" },
    CHOICE: { type: "text", placeholder: "" },
  };

  const { type, placeholder, pattern } = inputProps[answerType];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        type={type}
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder={placeholder}
        pattern={pattern}
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
