import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { CardCodeEditor } from "@/components/editor/code-editor";

export default async function EditorPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!["ADMIN", "EDUCATOR"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Card Editor</h1>
          <p className="text-gray-600 mt-2">Create and test flashcard functions</p>
        </header>

        <CardCodeEditor />
      </div>
    </div>
  );
}
