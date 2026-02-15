import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="text-center">
        <h1 className="text-6xl sm:text-8xl font-bold text-gray-300 dark:text-gray-700">404</h1>
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-gray-100 mt-4">
          Page Not Found
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2 max-w-md mx-auto">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/">
            <Button>Go Home</Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="secondary">Dashboard</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
