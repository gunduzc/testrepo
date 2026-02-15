"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";

export function StudyHeader() {
  return (
    <header className="flex items-center justify-between mb-6 sm:mb-8">
      <Link
        href="/dashboard"
        className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
      >
        ← Back
      </Link>
      <h1 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">Study</h1>
      <ThemeToggle />
    </header>
  );
}
