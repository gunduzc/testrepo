"use client";

import { useState } from "react";
import Editor from "@monaco-editor/react";
import { Card, CardHeader, CardBody, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QuestionRenderer } from "@/components/study/question-renderer";
import { CardOutput, SandboxResult, AnswerType } from "@/lib/types";

interface CardCodeEditorProps {
  initialSource?: string;
  cardId?: string;
  onSave?: (data: { name: string; description: string; answerType: AnswerType; source: string }) => Promise<void>;
}

const DEFAULT_SOURCE = `function generate() {
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;

  return {
    question: \`What is \${a} + \${b}?\`,
    answer: {
      correct: String(a + b),
      type: "INTEGER"
    }
  };
}`;

export function CardCodeEditor({ initialSource, cardId, onSave }: CardCodeEditorProps) {
  const [source, setSource] = useState(initialSource || DEFAULT_SOURCE);
  const [testResults, setTestResults] = useState<SandboxResult[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [answerType, setAnswerType] = useState<AnswerType>("INTEGER");
  const [error, setError] = useState<string | null>(null);

  const handleTest = async () => {
    setIsTesting(true);
    setError(null);
    setTestResults([]);

    try {
      const res = await fetch("/api/cards/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, count: 10 }),
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
    if (!onSave || !name || !description) return;

    setIsSaving(true);
    try {
      await onSave({ name, description, answerType, source });
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
          <h2 className="text-lg font-semibold">Card Function</h2>
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
        <CardFooter className="flex gap-3">
          <Button onClick={handleTest} isLoading={isTesting} variant="secondary">
            Test (10 samples)
          </Button>
        </CardFooter>
      </Card>

      {/* Preview Panel */}
      <div className="space-y-6">
        {/* Error Display */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardBody>
              <h3 className="font-semibold text-red-700 mb-2">Error</h3>
              <pre className="text-sm text-red-600 whitespace-pre-wrap">{error}</pre>
            </CardBody>
          </Card>
        )}

        {/* Sample Previews */}
        {successResults.length > 0 && (
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Sample Outputs ({successResults.length})</h2>
            </CardHeader>
            <CardBody className="max-h-[300px] overflow-y-auto space-y-4">
              {successResults.slice(0, 5).map((result, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-500 mb-1">Sample {index + 1}</div>
                  <QuestionRenderer content={result.output.question} />
                  <div className="mt-2 text-sm">
                    <span className="text-gray-500">Answer: </span>
                    <span className="font-medium">{result.output.answer.correct}</span>
                    <span className="text-gray-400 ml-2">({result.output.answer.type})</span>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
        )}

        {/* Save Form */}
        {onSave && (
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Card Details</h2>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Answer Type
                </label>
                <select
                  value={answerType}
                  onChange={(e) => setAnswerType(e.target.value as AnswerType)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="INTEGER">Integer</option>
                  <option value="DECIMAL">Decimal</option>
                  <option value="TEXT">Text</option>
                  <option value="FRACTION">Fraction</option>
                  <option value="CHOICE">Multiple Choice</option>
                </select>
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
        )}
      </div>
    </div>
  );
}
