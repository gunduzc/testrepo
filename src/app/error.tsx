"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="text-center">
        <h1 className="text-6xl sm:text-8xl font-bold text-gray-300 dark:text-gray-700">500</h1>
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-gray-100 mt-4">
          Something went wrong
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2 max-w-md mx-auto">
          An unexpected error occurred. Please try again.
        </p>
        {error.digest && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            Error ID: {error.digest}
          </p>
        )}
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={reset}>Try Again</Button>
          <Button
            variant="secondary"
            onClick={() => (window.location.href = "/")}
          >
            Go Home
          </Button>
        </div>
      </div>
    </div>
  );
}
