"use client";

import { useState, useEffect } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

interface Curriculum {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  createdAt: string;
  author: {
    name: string | null;
    email: string;
  } | null;
  _count: {
    curriculumSubjects: number;
  };
}

export default function AdminCurriculaPage() {
  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [publicFilter, setPublicFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCurricula();
  }, [search, publicFilter]);

  const fetchCurricula = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (publicFilter) params.set("isPublic", publicFilter);
      params.set("all", "true"); // Admin flag to get all curricula

      const res = await fetch(`/api/admin/curricula?${params}`);
      const data = await res.json();
      if (data.success) {
        setCurricula(data.data.curricula);
        setTotal(data.data.total);
      }
    } catch (error) {
      console.error("Failed to fetch curricula:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePublic = async (curriculumId: string, currentPublic: boolean) => {
    try {
      const res = await fetch(`/api/curricula/${curriculumId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: !currentPublic }),
      });

      if (res.ok) {
        setCurricula((prev) =>
          prev.map((c) => (c.id === curriculumId ? { ...c, isPublic: !currentPublic } : c))
        );
      }
    } catch (error) {
      console.error("Failed to toggle public:", error);
    }
  };

  const handleDelete = async (curriculumId: string, name: string) => {
    if (!confirm(`Delete curriculum "${name}"? This will remove all subjects and cards.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/curricula/${curriculumId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setCurricula((prev) => prev.filter((c) => c.id !== curriculumId));
        setTotal((prev) => prev - 1);
      }
    } catch (error) {
      console.error("Failed to delete curriculum:", error);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          All Curricula ({total})
        </h2>
      </div>

      {/* Filters */}
      <Card>
        <CardBody className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Search by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            value={publicFilter}
            onChange={(e) => setPublicFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value="">All Visibility</option>
            <option value="true">Public</option>
            <option value="false">Private</option>
          </select>
        </CardBody>
      </Card>

      {/* Curricula Table */}
      <Card>
        <CardBody className="p-0">
          {loading ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading...</div>
          ) : curricula.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">No curricula found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                      Curriculum
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                      Author
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                      Subjects
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                      Visibility
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                      Created
                    </th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {curricula.map((curriculum) => (
                    <tr key={curriculum.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {curriculum.name}
                        </div>
                        {curriculum.description && (
                          <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                            {curriculum.description}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {curriculum.author?.name || curriculum.author?.email || "Unknown"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {curriculum._count.curriculumSubjects}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleTogglePublic(curriculum.id, curriculum.isPublic)}
                          className={`px-2 py-1 text-xs rounded-full ${
                            curriculum.isPublic
                              ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                          }`}
                        >
                          {curriculum.isPublic ? "Public" : "Private"}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {new Date(curriculum.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <Link href={`/educator/curricula/${curriculum.id}`}>
                          <Button size="sm" variant="ghost">
                            Edit
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleDelete(curriculum.id, curriculum.name)}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
