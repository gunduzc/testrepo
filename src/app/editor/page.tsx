import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { CardCodeEditor } from "@/components/editor/code-editor";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export default async function EditorPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!["ADMIN", "EDUCATOR"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 py-4 sm:py-8">
      <div className="container mx-auto px-3 sm:px-4">
        <header className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Card Editor</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm sm:text-base">Create and test flashcard functions</p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/dashboard">
              <Button variant="secondary">Dashboard</Button>
            </Link>
          </div>
        </header>

        <CardCodeEditor />
      </div>
    </div>
  );
}
