"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface TwoFactorSetup {
  qrCode: string;
  secret: string;
  backupCodes: string[];
}

export default function SecurityPage() {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [setupData, setSetupData] = useState<TwoFactorSetup | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isEnabling, setIsEnabling] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/auth/session");
      const data = await res.json();
      if (data?.user) {
        // Check if 2FA is enabled via user data
        const userRes = await fetch("/api/user/optimization");
        const userData = await userRes.json();
        // For now, we'll fetch from the session or make a separate call
        // The actual status should come from the user object
        setTwoFactorEnabled(false); // Will be updated once we have proper status
      }
    } catch (error) {
      console.error("Failed to fetch status:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnableStart = async () => {
    setIsEnabling(true);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "enable" }),
      });

      const data = await res.json();

      if (data.success) {
        setSetupData(data.data);
      } else {
        setMessage({ type: "error", text: data.error?.message || "Failed to start 2FA setup" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to start 2FA setup" });
    } finally {
      setIsEnabling(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verificationCode.length !== 6) return;

    setIsVerifying(true);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", code: verificationCode }),
      });

      const data = await res.json();

      if (data.success) {
        setTwoFactorEnabled(true);
        setShowBackupCodes(true);
        setVerificationCode("");
        setMessage({ type: "success", text: "Two-factor authentication enabled!" });
      } else {
        setMessage({ type: "error", text: data.error?.message || "Verification failed" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Verification failed" });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (disableCode.length !== 6) return;

    setIsDisabling(true);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disable", code: disableCode }),
      });

      const data = await res.json();

      if (data.success) {
        setTwoFactorEnabled(false);
        setSetupData(null);
        setDisableCode("");
        setMessage({ type: "success", text: "Two-factor authentication disabled" });
      } else {
        setMessage({ type: "error", text: data.error?.message || "Failed to disable 2FA" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to disable 2FA" });
    } finally {
      setIsDisabling(false);
    }
  };

  const handleRevokeAllSessions = async () => {
    if (!confirm("This will log you out of all devices. Continue?")) return;

    try {
      const res = await fetch("/api/auth/sessions/revoke-all", { method: "POST" });
      const data = await res.json();

      if (data.success) {
        setMessage({ type: "success", text: `${data.sessionsRevoked} sessions revoked. Redirecting...` });
        setTimeout(() => {
          window.location.href = "/login";
        }, 2000);
      } else {
        setMessage({ type: "error", text: data.error?.message || "Failed to revoke sessions" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to revoke sessions" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <p className="text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-4 sm:py-8">
      <div className="container mx-auto px-3 sm:px-4 max-w-2xl">
        <div className="mb-4">
          <Link href="/dashboard" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">
            &larr; Back to Dashboard
          </Link>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-gray-900 dark:text-gray-100">
          Security Settings
        </h1>

        {/* Message */}
        {message && (
          <div
            className={`mb-4 p-3 rounded-lg ${
              message.type === "success"
                ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Two-Factor Authentication */}
        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Two-Factor Authentication
            </h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Add an extra layer of security to your account by requiring a verification code
              from an authenticator app when signing in.
            </p>

            {twoFactorEnabled ? (
              /* 2FA Enabled - Show disable option */
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <span className="text-lg">&#10003;</span>
                  <span className="font-medium">Two-factor authentication is enabled</span>
                </div>

                <form onSubmit={handleDisable} className="space-y-3">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Enter your current authenticator code to disable 2FA:
                  </p>
                  <div className="flex gap-3">
                    <Input
                      type="text"
                      placeholder="000000"
                      value={disableCode}
                      onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      maxLength={6}
                      className="w-32 text-center font-mono text-lg"
                    />
                    <Button type="submit" variant="secondary" disabled={isDisabling || disableCode.length !== 6}>
                      {isDisabling ? "Disabling..." : "Disable 2FA"}
                    </Button>
                  </div>
                </form>
              </div>
            ) : setupData ? (
              /* Setup in progress */
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Scan this QR code with your authenticator app:
                  </p>
                  <div className="inline-block bg-white p-4 rounded-lg">
                    <img
                      src={setupData.qrCode}
                      alt="2FA QR Code"
                      width={200}
                      height={200}
                      className="mx-auto"
                    />
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Or enter this code manually:
                  </p>
                  <code className="bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded font-mono text-sm">
                    {setupData.secret}
                  </code>
                </div>

                <form onSubmit={handleVerify} className="space-y-3">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Enter the 6-digit code from your authenticator app:
                  </p>
                  <div className="flex gap-3 justify-center">
                    <Input
                      type="text"
                      placeholder="000000"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      maxLength={6}
                      className="w-32 text-center font-mono text-lg"
                    />
                    <Button type="submit" disabled={isVerifying || verificationCode.length !== 6}>
                      {isVerifying ? "Verifying..." : "Verify & Enable"}
                    </Button>
                  </div>
                </form>

                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => setSetupData(null)}
                >
                  Cancel Setup
                </Button>
              </div>
            ) : (
              /* 2FA not enabled */
              <Button onClick={handleEnableStart} disabled={isEnabling}>
                {isEnabling ? "Setting up..." : "Enable Two-Factor Authentication"}
              </Button>
            )}

            {/* Backup codes display */}
            {showBackupCodes && setupData?.backupCodes && (
              <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <h3 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                  Backup Codes
                </h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
                  Save these codes in a safe place. Each code can only be used once.
                </p>
                <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                  {setupData.backupCodes.map((code, i) => (
                    <div key={i} className="bg-white dark:bg-gray-800 px-2 py-1 rounded">
                      {code}
                    </div>
                  ))}
                </div>
                <Button
                  variant="secondary"
                  className="mt-3 w-full"
                  onClick={() => setShowBackupCodes(false)}
                >
                  I&apos;ve Saved My Codes
                </Button>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Session Management */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Session Management
            </h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              If you suspect unauthorized access to your account, you can log out of all
              devices at once.
            </p>
            <Button variant="secondary" onClick={handleRevokeAllSessions}>
              Log Out of All Devices
            </Button>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
