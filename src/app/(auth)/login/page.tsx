"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardBody, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [needs2FA, setNeeds2FA] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        twoFactorCode: needs2FA ? twoFactorCode : "",
        redirect: false,
      });

      if (result?.error) {
        const code = result.code ?? result.error;
        if (code.includes("two_factor_required")) {
          setNeeds2FA(true);
          setTwoFactorCode("");
        } else if (code.includes("invalid_two_factor_code")) {
          setError("Invalid 2FA code. Please try again.");
          setTwoFactorCode("");
        } else {
          setError("Invalid email or password");
        }
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-950 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h1 className="text-xl sm:text-2xl font-bold text-center text-gray-900 dark:text-gray-100">
            {needs2FA ? "Two-Factor Authentication" : "Sign In"}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-center mt-1 text-sm sm:text-base">
            {needs2FA
              ? "Enter the code from your authenticator app"
              : "Welcome back to Spaced Repetition"}
          </p>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardBody className="space-y-4">
            {error && (
              <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-sm">
                {error}
              </div>
            )}
            {!needs2FA ? (
              <>
                <Input
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
                <div>
                  <Input
                    label="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <div className="mt-1 text-right">
                    <Link
                      href="/forgot-password"
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                </div>
              </>
            ) : (
              <Input
                label="Authentication Code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ""))}
                required
                autoComplete="one-time-code"
                autoFocus
                placeholder="000000"
              />
            )}
          </CardBody>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" isLoading={isLoading} className="w-full">
              {needs2FA ? "Verify" : "Sign In"}
            </Button>
            {needs2FA ? (
              <button
                type="button"
                onClick={() => {
                  setNeeds2FA(false);
                  setTwoFactorCode("");
                  setError("");
                }}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Back to login
              </button>
            ) : (
              <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                Don&apos;t have an account?{" "}
                <Link href="/register" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Sign up
                </Link>
              </p>
            )}
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
