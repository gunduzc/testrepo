"use client";

import { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { Card, CardHeader, CardBody, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QuestionRenderer } from "@/components/study/question-renderer";
import { CardOutput, SandboxResult, AnswerType } from "@/lib/types";

interface CardCodeEditorProps {
  initialSource?: string;
  cardId?: string;
  subjectId?: string;
  initialLearningSteps?: number;
  initialRelearningSteps?: number;
  initialReviewSteps?: number;
  onSave?: (data: {
    name: string;
    description: string;
    answerType: AnswerType;
    source: string;
    learningSteps: number;
    relearningSteps: number;
    reviewSteps: number;
  }) => Promise<void>;
  onCardCreated?: (cardId: string) => void;
}

const DEFAULT_SOURCE = `function generate() {
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  const sum = a + b;

  return {
    question: \`What is \${a} + \${b}?\`,
    answer: {
      correct: String(sum),
      type: "INTEGER"
    },
    solution: \`\${a} + \${b} = \${sum}\`
  };
}`;

export function CardCodeEditor({
  initialSource,
  cardId,
  subjectId,
  initialLearningSteps = 5,
  initialRelearningSteps = 3,
  initialReviewSteps = 1,
  onSave,
  onCardCreated,
}: CardCodeEditorProps) {
  const [source, setSource] = useState(initialSource || DEFAULT_SOURCE);
  const [testResults, setTestResults] = useState<SandboxResult[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [answerType, setAnswerType] = useState<AnswerType>("INTEGER");
  const [learningSteps, setLearningSteps] = useState(initialLearningSteps);
  const [relearningSteps, setRelearningSteps] = useState(initialRelearningSteps);
  const [reviewSteps, setReviewSteps] = useState(initialReviewSteps);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [sampleCount, setSampleCount] = useState(10);
  const [llmAvailable, setLlmAvailable] = useState<boolean | null>(null);

  // Check if LLM is available on mount
  useEffect(() => {
    fetch("/api/llm/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: "test check" }),
    })
      .then((res) => res.json())
      .then((data) => {
        // If we get SERVICE_UNAVAILABLE, LLM is not configured
        setLlmAvailable(data.error?.code !== "SERVICE_UNAVAILABLE");
      })
      .catch(() => setLlmAvailable(false));
  }, []);

  const handleGenerate = async () => {
    if (!aiPrompt.trim() || aiPrompt.length < 10) {
      setError("Please describe the card in at least 10 characters");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch("/api/llm/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: aiPrompt }),
      });

      const data = await res.json();

      if (data.success) {
        setSource(data.data.source);
        setSuccessMessage("Card generated! Click Test to preview it.");
        // Auto-fill description from prompt
        if (!description) {
          setDescription(aiPrompt);
        }
      } else {
        setError(data.error.message || "Failed to generate card");
      }
    } catch (err) {
      setError("Failed to generate card");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setError(null);
    setSuccessMessage(null);
    setTestResults([]);

    try {
      const res = await fetch("/api/cards/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, count: sampleCount }),
      });

      const data = await res.json();

      if (data.success) {
        setTestResults(data.data);

        // Check for errors
        const errorResult = data.data.find((r: SandboxResult) => !r.success);
        if (errorResult && !errorResult.success) {
          setError(errorResult.error.message);
        }
      } else {
        setError(data.error.message);
      }
    } catch (err) {
      setError("Failed to test card");
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    if (!name || !description) return;

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // If custom onSave provided, use it
      if (onSave) {
        await onSave({ name, description, answerType, source, learningSteps, relearningSteps, reviewSteps });
        return;
      }

      // Otherwise, save directly via API
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          functionSource: source,
          name,
          description,
          answerType,
          learningSteps,
          relearningSteps,
          reviewSteps,
          subjectId,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccessMessage(`Card "${data.data.name}" created successfully!`);
        setName("");
        setDescription("");
        if (onCardCreated) {
          onCardCreated(data.data.id);
        }
      } else {
        setError(data.error?.message || "Failed to save card");
      }
    } catch (err) {
      setError("Failed to save card");
    } finally {
      setIsSaving(false);
    }
  };

  const successResults = testResults.filter((r): r is { success: true; output: CardOutput } => r.success);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Editor Panel */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Card Function</h2>
          {/* AI Generation Input - only show if LLM is available */}
          {llmAvailable && (
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Describe the card (e.g., 'two-digit multiplication problems')"
                className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
              <Button
                onClick={handleGenerate}
                isLoading={isGenerating}
                variant="secondary"
                disabled={aiPrompt.length < 10}
              >
                Generate with AI
              </Button>
            </div>
          )}
        </CardHeader>
        <CardBody className="p-0">
          <Editor
            height="400px"
            defaultLanguage="javascript"
            value={source}
            onChange={(value) => setSource(value || "")}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        </CardBody>
        <CardFooter className="flex gap-3 items-center">
          <Button onClick={handleTest} isLoading={isTesting} variant="secondary">
            Test
          </Button>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 dark:text-gray-400">Samples:</label>
            <input
              type="number"
              min="1"
              max="50"
              value={sampleCount}
              onChange={(e) => setSampleCount(Math.min(50, Math.max(1, parseInt(e.target.value) || 10)))}
              className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
        </CardFooter>
      </Card>

      {/* Preview Panel */}
      <div className="space-y-6">
        {/* Success Message */}
        {successMessage && (
          <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
            <CardBody>
              <p className="text-green-700 dark:text-green-400">{successMessage}</p>
            </CardBody>
          </Card>
        )}

        {/* Error Display */}
        {error && (
          <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
            <CardBody>
              <h3 className="font-semibold text-red-700 dark:text-red-400 mb-2">Error</h3>
              <pre className="text-sm text-red-600 dark:text-red-300 whitespace-pre-wrap">{error}</pre>
            </CardBody>
          </Card>
        )}

        {/* Sample Previews */}
        {successResults.length > 0 && (
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Sample Outputs ({successResults.length})</h2>
            </CardHeader>
            <CardBody className="max-h-[300px] overflow-y-auto space-y-4">
              {successResults.slice(0, 5).map((result, index) => (
                <div key={index} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Sample {index + 1}</div>
                  <QuestionRenderer content={result.output.question} />
                  <div className="mt-2 text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Answer: </span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{result.output.answer.correct}</span>
                    <span className="text-gray-400 dark:text-gray-500 ml-2">({result.output.answer.type})</span>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
        )}

        {/* Save Form - Always show */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Card Details</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <Input
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Two-Digit Addition"
            />
            <Input
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this card test?"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Answer Type
              </label>
              <select
                value={answerType}
                onChange={(e) => setAnswerType(e.target.value as AnswerType)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value="INTEGER">Integer</option>
                <option value="DECIMAL">Decimal</option>
                <option value="TEXT">Text</option>
                <option value="FRACTION">Fraction</option>
                <option value="CHOICE">Multiple Choice</option>
              </select>
            </div>

            {/* Learning Steps Configuration */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Learning Steps
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={learningSteps}
                  onChange={(e) => setLearningSteps(Math.min(20, Math.max(1, parseInt(e.target.value) || 5)))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  For new cards
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Relearning Steps
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={relearningSteps}
                  onChange={(e) => setRelearningSteps(Math.min(10, Math.max(1, parseInt(e.target.value) || 3)))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  After forgetting
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Review Steps
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={reviewSteps}
                  onChange={(e) => setReviewSteps(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Per review session
                </p>
              </div>
            </div>
          </CardBody>
          <CardFooter>
            <Button
              onClick={handleSave}
              isLoading={isSaving}
              disabled={!name || !description || successResults.length === 0}
              className="w-full"
            >
              {cardId ? "Update Card" : "Create Card"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
