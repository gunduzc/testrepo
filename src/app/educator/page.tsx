"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface Curriculum {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
}

export default function EducatorDashboard() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCurricula();
  }, []);

  const fetchCurricula = async () => {
    try {
      const res = await fetch("/api/curricula");
      const data = await res.json();
      if (data.success) {
        setCurricula(data.data.curricula || []);
      }
    } catch (err) {
      console.error("Failed to fetch curricula:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setError(null);

    try {
      const text = await file.text();
      const importData = JSON.parse(text);

      const res = await fetch("/api/curricula/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(importData),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        router.push(`/educator/curricula/${data.data.id}`);
      } else {
        setError(data.error?.message || "Failed to import curriculum");
        if (data.error?.details) {
          setError((prev) => `${prev}\n${data.error.details.join("\n")}`);
        }
      }
    } catch (err) {
      setError("Failed to parse import file. Please ensure it's a valid JSON export.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <p className="text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">My Curricula</h2>
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
          <Button
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            {importing ? "Importing..." : "Import"}
          </Button>
          <Link href="/educator/curricula/new">
            <Button>Create Curriculum</Button>
          </Link>
        </div>
      </div>

      {error && (
        <Card className="mb-6 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
          <CardBody>
            <pre className="text-sm text-red-600 dark:text-red-300 whitespace-pre-wrap">{error}</pre>
          </CardBody>
        </Card>
      )}

      {curricula.length === 0 ? (
        <Card>
          <CardBody className="text-center py-12">
            <div className="text-5xl mb-4">📚</div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No curricula yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Create your first curriculum or import an existing one.
            </p>
            <div className="flex justify-center gap-3">
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                Import Curriculum
              </Button>
              <Link href="/educator/curricula/new">
                <Button>Create Your First Curriculum</Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {curricula.map((curriculum) => (
            <Link key={curriculum.id} href={`/educator/curricula/${curriculum.id}`}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardBody className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">
                      {curriculum.name}
                    </h3>
                    {curriculum.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {curriculum.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        curriculum.isPublic
                          ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                      }`}
                    >
                      {curriculum.isPublic ? "Public" : "Private"}
                    </span>
                    <svg
                      className="w-5 h-5 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
