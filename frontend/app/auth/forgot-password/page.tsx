"use client";

import type React from "react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      // trailingSlash is enabled, so the exported route is /auth/reset-password/
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        { redirectTo: `${window.location.origin}/auth/reset-password/` },
      );
      if (resetError) throw resetError;
      // Always report success: revealing whether an account exists would let
      // anyone enumerate registered emails.
      setSent(true);
    } catch (error: unknown) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not send the reset email. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50 p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🐕</div>
          <h1 className="text-3xl font-bold text-orange-800 mb-2">RooRooRoo</h1>
          <p className="text-orange-600">Your faithful website watcher</p>
        </div>

        <Card className="border-orange-200 shadow-lg">
          {sent
            ? (
              <>
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl text-orange-800">
                    Check Your Email
                  </CardTitle>
                  <CardDescription className="text-orange-600">
                    We&#39;ll fetch you a reset link
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                  <div className="mb-6">
                    <div className="text-4xl mb-4">📧</div>
                    <p className="text-orange-700 mb-4">
                      If an account exists for{" "}
                      <span className="font-medium">{email}</span>, we&#39;ve
                      sent it a link to choose a new password.
                    </p>
                    <p className="text-sm text-orange-600">
                      Don&#39;t see the email? Check your spam folder or wait a
                      few minutes. The link expires after one hour.
                    </p>
                  </div>
                  <Button
                    asChild
                    className="bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    <Link href="/auth/login">Back to Sign In</Link>
                  </Button>
                </CardContent>
              </>
            )
            : (
              <>
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl text-orange-800">
                    Forgot Your Password?
                  </CardTitle>
                  <CardDescription className="text-orange-600">
                    Enter your email and we&#39;ll send you a reset link
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit}>
                    <div className="flex flex-col gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="email" className="text-orange-700">
                          Email
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="your@email.com"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="border-orange-200 focus:border-orange-400"
                        />
                      </div>
                      {error && (
                        <div className="bg-red-50 border border-red-200 rounded-md p-3">
                          <p className="text-sm text-red-600">{error}</p>
                        </div>
                      )}
                      <Button
                        type="submit"
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                        disabled={isLoading}
                      >
                        {isLoading ? "Sending..." : "Send Reset Link"}
                      </Button>
                    </div>
                    <div className="mt-6 text-center text-sm">
                      <span className="text-orange-600 mr-1">
                        Remembered it?
                      </span>
                      <Link
                        href="/auth/login"
                        className="text-orange-700 hover:text-orange-800 font-medium underline underline-offset-4"
                      >
                        Back to sign in
                      </Link>
                    </div>
                  </form>
                </CardContent>
              </>
            )}
        </Card>
      </div>
    </div>
  );
}
