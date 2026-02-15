"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Class {
  id: string;
  name: string;
  createdAt: string;
  _count: {
    enrollments: number;
    curriculumAssignments: number;
  };
}

export default function ClassesPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [newClassName, setNewClassName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      const res = await fetch("/api/classes");
      const data = await res.json();
      if (data.success) {
        setClasses(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch classes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;

    setCreating(true);
    try {
      const res = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newClassName }),
      });

      if (res.ok) {
        setNewClassName("");
        fetchClasses();
      }
    } catch (error) {
      console.error("Failed to create class:", error);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (classId: string, className: string) => {
    if (!confirm(`Delete class "${className}"? Students will be unenrolled.`)) return;

    try {
      const res = await fetch(`/api/classes/${classId}`, { method: "DELETE" });
      if (res.ok) {
        setClasses((prev) => prev.filter((c) => c.id !== classId));
      }
    } catch (error) {
      console.error("Failed to delete class:", error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">My Classes</h2>
      </div>

      {/* Create New Class */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Create New Class</h3>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleCreate} className="flex gap-3">
            <Input
              placeholder="Class name (e.g., Math 101 - Fall 2024)"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={creating || !newClassName.trim()}>
              {creating ? "Creating..." : "Create Class"}
            </Button>
          </form>
        </CardBody>
      </Card>

      {/* Classes List */}
      {loading ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading...</div>
      ) : classes.length === 0 ? (
        <Card>
          <CardBody className="text-center py-8">
            <p className="text-gray-600 dark:text-gray-400 mb-2">No classes yet.</p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Create a class to organize students and assign curricula.
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {classes.map((cls) => (
            <Card key={cls.id}>
              <CardHeader>
                <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">{cls.name}</h3>
              </CardHeader>
              <CardBody>
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-4">
                  <span>{cls._count.enrollments} students</span>
                  <span>{cls._count.curriculumAssignments} curricula</span>
                </div>
                <div className="flex gap-2">
                  <Link href={`/educator/classes/${cls.id}`} className="flex-1">
                    <Button className="w-full">Manage</Button>
                  </Link>
                  <Button
                    variant="danger"
                    onClick={() => handleDelete(cls.id, cls.name)}
                  >
                    Delete
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
