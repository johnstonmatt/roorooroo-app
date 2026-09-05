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
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// Mirrors auth.minimum_password_length in supabase/config.toml
const MIN_PASSWORD_LENGTH = 6;

type Status = "verifying" | "ready" | "invalid";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<Status>("verifying");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // The recovery link lands here with a token in the URL. This is a static
  // export, so there is no server route to exchange it -- the browser client
  // picks it up via detectSessionInUrl and emits PASSWORD_RECOVERY.
  useEffect(() => {
    const supabase = createClient();
    let settled = false;

    // An expired or already-used link comes back as an error, not a session.
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    const urlError = hash.get("error_description") ??
      query.get("error_description") ?? hash.get("error") ??
      query.get("error");
    if (urlError) {
      // Reading the recovery token out of the URL is an external-system read,
      // and it can only happen on the client -- a lazy state initialiser would
      // run during prerender and desync on hydration. The cascading render the
      // rule guards against is a one-off here, on an error path.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus("invalid");
      setError(urlError.replace(/\+/g, " "));
      return;
    }

    const markReady = () => {
      if (settled) return;
      settled = true;
      setStatus("ready");
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "PASSWORD_RECOVERY" || session) markReady();
      },
    );

    // Covers the case where the session was established before we subscribed.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) markReady();
    });

    // detectSessionInUrl is async and stays silent when there is no token at
    // all, so fall back to treating the link as unusable.
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      setStatus("invalid");
      setError("This password reset link is invalid or has expired.");
    }, 5000);

    return () => {
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`,
      );
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) throw updateError;
      // updateUser leaves the recovery session signed in, so go straight in.
      router.push("/dashboard");
    } catch (error: unknown) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not update your password. Please try again.",
      );
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
          {status === "verifying" && (
            <>
              <CardHeader className="text-center">
                <CardTitle className="text-2xl text-orange-800">
                  Sniffing Out Your Link
                </CardTitle>
                <CardDescription className="text-orange-600">
                  One moment while we check it
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <div className="text-4xl mb-4">🦴</div>
              </CardContent>
            </>
          )}

          {status === "invalid" && (
            <>
              <CardHeader className="text-center">
                <CardTitle className="text-2xl text-orange-800">
                  This Link Won&#39;t Fetch
                </CardTitle>
                <CardDescription className="text-orange-600">
                  Reset links expire after one hour and work only once
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-6">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}
                <Button
                  asChild
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  <Link href="/auth/forgot-password">Request a New Link</Link>
                </Button>
              </CardContent>
            </>
          )}

          {status === "ready" && (
            <>
              <CardHeader className="text-center">
                <CardTitle className="text-2xl text-orange-800">
                  Choose a New Password
                </CardTitle>
                <CardDescription className="text-orange-600">
                  Pick something you&#39;ll remember this time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit}>
                  <div className="flex flex-col gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="password" className="text-orange-700">
                        New Password
                      </Label>
                      <Input
                        id="password"
                        type="password"
                        required
                        minLength={MIN_PASSWORD_LENGTH}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="border-orange-200 focus:border-orange-400"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label
                        htmlFor="confirmPassword"
                        className="text-orange-700"
                      >
                        Confirm New Password
                      </Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        required
                        minLength={MIN_PASSWORD_LENGTH}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
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
                      {isLoading ? "Updating..." : "Update Password"}
                    </Button>
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
