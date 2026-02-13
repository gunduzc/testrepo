import Link from "next/link";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const session = await auth();

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="container mx-auto px-4 py-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-blue-600">SpacedRep</h1>
        <nav className="flex gap-4">
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
      <main className="container mx-auto px-4 py-20">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-5xl font-bold text-gray-900 mb-6">
            Master Any Subject with{" "}
            <span className="text-blue-600">Spaced Repetition</span>
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            A programmable learning platform that uses the FSRS algorithm to optimize
            your study schedule. Create custom flashcards with code, track your progress,
            and learn more efficiently.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href={session?.user ? "/dashboard" : "/register"}>
              <Button size="lg">
                {session?.user ? "Go to Dashboard" : "Start Learning Free"}
              </Button>
            </Link>
            <Link href="/curricula">
              <Button size="lg" variant="secondary">
                Browse Curricula
              </Button>
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="mt-32 grid md:grid-cols-3 gap-8">
          <div className="text-center p-6">
            <div className="text-5xl mb-4">🧠</div>
            <h3 className="text-xl font-semibold mb-2">FSRS Algorithm</h3>
            <p className="text-gray-600">
              State-of-the-art spaced repetition scheduling that adapts to your memory patterns.
            </p>
          </div>
          <div className="text-center p-6">
            <div className="text-5xl mb-4">💻</div>
            <h3 className="text-xl font-semibold mb-2">Programmable Cards</h3>
            <p className="text-gray-600">
              Create dynamic flashcards with JavaScript functions that generate unique questions.
            </p>
          </div>
          <div className="text-center p-6">
            <div className="text-5xl mb-4">📊</div>
            <h3 className="text-xl font-semibold mb-2">Progress Tracking</h3>
            <p className="text-gray-600">
              Track mastery across subjects with detailed analytics and prerequisite-based unlocking.
            </p>
          </div>
        </div>

        {/* For Educators */}
        <div className="mt-32 bg-white rounded-2xl shadow-xl p-12 text-center">
          <h3 className="text-3xl font-bold mb-4">For Educators</h3>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Create curricula with subject prerequisites, manage classes, and use AI-assisted
            card authoring to build engaging learning content.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <div className="px-6 py-3 bg-blue-50 rounded-full text-blue-700">
              Visual DAG Editor
            </div>
            <div className="px-6 py-3 bg-blue-50 rounded-full text-blue-700">
              LLM Card Generation
            </div>
            <div className="px-6 py-3 bg-blue-50 rounded-full text-blue-700">
              Class Management
            </div>
            <div className="px-6 py-3 bg-blue-50 rounded-full text-blue-700">
              Import/Export JSON
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-12 text-center text-gray-500">
        <p>Programmable Spaced Repetition Learning Platform</p>
        <p className="text-sm mt-2">Senior Design Project - February 2026</p>
      </footer>
    </div>
  );
}
