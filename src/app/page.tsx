import Link from "next/link";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function HomePage() {
  const session = await auth();

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-950">
      {/* Header */}
      <header className="container mx-auto px-4 py-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">SpacedRep</h1>
        <nav className="flex items-center gap-4">
          <ThemeToggle />
          {session?.user ? (
            <Link href="/dashboard">
              <Button>Dashboard</Button>
            </Link>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <Link href="/register">
                <Button>Get Started</Button>
              </Link>
            </>
          )}
        </nav>
      </header>

      {/* Hero */}
      <main className="container mx-auto px-4 py-12 sm:py-20">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-5xl font-bold text-gray-900 dark:text-gray-100 mb-6">
            Master Any Subject with{" "}
            <span className="text-blue-600 dark:text-blue-400">Spaced Repetition</span>
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 mb-8">
            A programmable learning platform that uses the FSRS algorithm to optimize
            your study schedule. Create custom flashcards with code, track your progress,
            and learn more efficiently.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href={session?.user ? "/dashboard" : "/register"}>
              <Button size="lg" className="w-full sm:w-auto">
                {session?.user ? "Go to Dashboard" : "Start Learning Free"}
              </Button>
            </Link>
            <Link href="/curricula">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                Browse Curricula
              </Button>
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="mt-16 sm:mt-32 grid md:grid-cols-3 gap-6 sm:gap-8">
          <div className="text-center p-6">
            <div className="text-4xl sm:text-5xl mb-4">🧠</div>
            <h3 className="text-lg sm:text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">FSRS Algorithm</h3>
            <p className="text-gray-600 dark:text-gray-400">
              State-of-the-art spaced repetition scheduling that adapts to your memory patterns.
            </p>
          </div>
          <div className="text-center p-6">
            <div className="text-4xl sm:text-5xl mb-4">💻</div>
            <h3 className="text-lg sm:text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">Programmable Cards</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Create dynamic flashcards with JavaScript functions that generate unique questions.
            </p>
          </div>
          <div className="text-center p-6">
            <div className="text-4xl sm:text-5xl mb-4">📊</div>
            <h3 className="text-lg sm:text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">Progress Tracking</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Track mastery across subjects with detailed analytics and prerequisite-based unlocking.
            </p>
          </div>
        </div>

        {/* For Educators */}
        <div className="mt-16 sm:mt-32 bg-white dark:bg-gray-800 rounded-2xl shadow-xl dark:shadow-gray-900/50 p-8 sm:p-12 text-center">
          <h3 className="text-2xl sm:text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100">For Educators</h3>
          <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
            Create curricula with subject prerequisites, manage classes, and use AI-assisted
            card authoring to build engaging learning content.
          </p>
          <div className="flex gap-3 sm:gap-4 justify-center flex-wrap">
            <div className="px-4 sm:px-6 py-2 sm:py-3 bg-blue-50 dark:bg-blue-900/30 rounded-full text-blue-700 dark:text-blue-300 text-sm sm:text-base">
              Visual DAG Editor
            </div>
            <div className="px-4 sm:px-6 py-2 sm:py-3 bg-blue-50 dark:bg-blue-900/30 rounded-full text-blue-700 dark:text-blue-300 text-sm sm:text-base">
              LLM Card Generation
            </div>
            <div className="px-4 sm:px-6 py-2 sm:py-3 bg-blue-50 dark:bg-blue-900/30 rounded-full text-blue-700 dark:text-blue-300 text-sm sm:text-base">
              Class Management
            </div>
            <div className="px-4 sm:px-6 py-2 sm:py-3 bg-blue-50 dark:bg-blue-900/30 rounded-full text-blue-700 dark:text-blue-300 text-sm sm:text-base">
              Import/Export JSON
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 sm:py-12 text-center text-gray-500 dark:text-gray-400">
        <p>Programmable Spaced Repetition Learning Platform</p>
        <p className="text-sm mt-2">Senior Design Project - February 2026</p>
      </footer>
    </div>
  );
}
