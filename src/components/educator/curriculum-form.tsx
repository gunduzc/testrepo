"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";

interface CurriculumFormProps {
  initialData?: {
    id: string;
    name: string;
    description: string | null;
  };
  onSuccess?: () => void;
}

export function CurriculumForm({ initialData, onSuccess }: CurriculumFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!initialData?.id;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const url = isEditing ? `/api/curricula/${initialData.id}` : "/api/curricula";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to save curriculum");
      }

      if (onSuccess) {
        onSuccess();
      } else {
        router.push(`/educator/curricula/${data.data?.id || initialData?.id}`);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardBody>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Curriculum Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Calculus 101"
            required
          />

          <Textarea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what this curriculum covers..."
          />

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="flex gap-3">
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? "Saving..." : isEditing ? "Update Curriculum" : "Create Curriculum"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
