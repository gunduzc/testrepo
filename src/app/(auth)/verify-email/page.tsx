"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const email = searchParams.get("email");

  const [status, setStatus] = useState<"verifying" | "success" | "error" | "no-token">("verifying");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !email) {
      setStatus("no-token");
      return;
    }

    const verifyEmail = async () => {
      try {
        const res = await fetch("/api/auth/verify-email/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, email }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error?.message || "Verification failed");
        }

        setStatus("success");
        // Redirect to dashboard after 3 seconds
        setTimeout(() => {
          router.push("/dashboard");
        }, 3000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        setStatus("error");
      }
    };

    verifyEmail();
  }, [token, email, router]);

  if (status === "verifying") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="text-5xl mb-4 animate-pulse">📧</div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Verifying Email...
            </h1>
          </CardHeader>
          <CardBody className="text-center">
            <p className="text-gray-600 dark:text-gray-400">
              Please wait while we verify your email address.
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="text-5xl mb-4">✓</div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Email Verified!
            </h1>
          </CardHeader>
          <CardBody className="text-center space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              Your email has been verified successfully. You will be redirected to the
              dashboard shortly.
            </p>
            <Link href="/dashboard">
              <Button className="w-full">Go to Dashboard</Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (status === "no-token") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Invalid Verification Link
            </h1>
          </CardHeader>
          <CardBody className="text-center space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              This verification link is invalid. Please request a new verification email
              from your account settings.
            </p>
            <Link href="/dashboard">
              <Button className="w-full">Go to Dashboard</Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Verification Failed
          </h1>
        </CardHeader>
        <CardBody className="text-center space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            {error || "We couldn't verify your email. The link may have expired."}
          </p>
          <div className="space-y-2">
            <Link href="/dashboard">
              <Button className="w-full">Go to Dashboard</Button>
            </Link>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              You can request a new verification email from your account settings.
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
