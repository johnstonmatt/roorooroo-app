"use client";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FormError } from "@/components/ui/form-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthBrand } from "@/components/auth-brand";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

// Mirrors auth.minimum_password_length in supabase/config.toml
const MIN_PASSWORD_LENGTH = 6;

type Status = "verifying" | "ready" | "invalid";

/** The update either fails with a message or succeeds and navigates away. */
type UpdateState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "done" };

export default function ResetPasswordPage() {
  const [status, setStatus] = useState<Status>("verifying");
  const [error, setError] = useState<string | null>(null);
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

  const [update, updatePassword, isPending] = useActionState<
    UpdateState,
    FormData
  >(
    async (_previous, formData) => {
      const password = String(formData.get("password") ?? "");
      const confirmPassword = String(formData.get("confirmPassword") ?? "");

      if (password.length < MIN_PASSWORD_LENGTH) {
        return {
          status: "error",
          message:
            `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`,
        };
      }
      if (password !== confirmPassword) {
        return { status: "error", message: "Passwords do not match" };
      }

      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) {
        return {
          status: "error",
          message: updateError.message ||
            "Could not update your password. Please try again.",
        };
      }

      // updateUser leaves the recovery session signed in, so go straight in.
      // Stay in the "done" state so the button cannot be pressed again while
      // the navigation is in flight.
      router.push("/dashboard");
      return { status: "done" };
    },
    { status: "idle" },
  );

  return (
    <>
      <AuthBrand tagline="Your faithful website watcher" />
      <Card className="shadow-lg">
        {status === "verifying" && (
          <>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl text-foreground">
                Sniffing Out Your Link
              </CardTitle>
              <CardDescription className="text-muted-foreground">
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
              <CardTitle className="text-2xl text-foreground">
                This Link Won&#39;t Fetch
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Reset links expire after one hour and work only once
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <div className="mb-6">
                <FormError message={error} />
              </div>
              <Button
                asChild
              >
                <Link href="/auth/forgot-password">Request a New Link</Link>
              </Button>
            </CardContent>
          </>
        )}

        {status === "ready" && (
          <>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl text-foreground">
                Choose a New Password
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Pick something you&#39;ll remember this time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={updatePassword}>
                <div className="flex flex-col gap-4">
                  <div className="grid gap-2">
                    <Label
                      htmlFor="password"
                      className="text-accent-foreground"
                    >
                      New Password
                    </Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      required
                      minLength={MIN_PASSWORD_LENGTH}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label
                      htmlFor="confirmPassword"
                      className="text-accent-foreground"
                    >
                      Confirm New Password
                    </Label>
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      required
                      minLength={MIN_PASSWORD_LENGTH}
                    />
                  </div>
                  <FormError
                    message={update.status === "error" ? update.message : null}
                  />
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isPending || update.status === "done"}
                  >
                    {isPending || update.status === "done"
                      ? "Updating..."
                      : "Update Password"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </>
        )}
      </Card>
    </>
  );
}
