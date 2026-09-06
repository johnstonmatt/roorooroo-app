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
import { useActionState } from "react";

/** Sending succeeds or fails; on success we echo back the address we used. */
type RequestState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "sent"; email: string };

export default function ForgotPasswordPage() {
  const [state, requestReset, isPending] = useActionState<
    RequestState,
    FormData
  >(
    async (_previous, formData) => {
      const email = String(formData.get("email") ?? "");
      const supabase = createClient();
      // trailingSlash is enabled, so the exported route is /auth/reset-password/
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password/`,
      });
      if (error) {
        return {
          status: "error",
          message: error.message ||
            "Could not send the reset email. Please try again.",
        };
      }
      // Always report success: revealing whether an account exists would let
      // anyone enumerate registered emails.
      return { status: "sent", email };
    },
    { status: "idle" },
  );

  return (
    <>
      <AuthBrand tagline="Your faithful website watcher" />
      <Card className="shadow-lg">
        {state.status === "sent"
          ? (
            <>
              <CardHeader className="text-center">
                <CardTitle className="text-2xl text-foreground">
                  Check Your Email
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  We&#39;ll fetch you a reset link
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <div className="mb-6">
                  <div className="text-4xl mb-4">📧</div>
                  <p className="text-accent-foreground mb-4">
                    If an account exists for{" "}
                    <span className="font-medium">{state.email}</span>,
                    we&#39;ve sent it a link to choose a new password.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Don&#39;t see the email? Check your spam folder or wait a
                    few minutes. The link expires after one hour.
                  </p>
                </div>
                <Button
                  asChild
                >
                  <Link href="/auth/login">Back to Sign In</Link>
                </Button>
              </CardContent>
            </>
          )
          : (
            <>
              <CardHeader className="text-center">
                <CardTitle className="text-2xl text-foreground">
                  Forgot Your Password?
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Enter your email and we&#39;ll send you a reset link
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form action={requestReset}>
                  <div className="flex flex-col gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="email" className="text-accent-foreground">
                        Email
                      </Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="your@email.com"
                        required
                      />
                    </div>
                    <FormError
                      message={state.status === "error" ? state.message : null}
                    />
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isPending}
                    >
                      {isPending ? "Sending..." : "Send Reset Link"}
                    </Button>
                  </div>
                  <div className="mt-6 text-center text-sm">
                    <span className="text-muted-foreground mr-1">
                      Remembered it?
                    </span>
                    <Link
                      href="/auth/login"
                      className="text-accent-foreground hover:text-foreground font-medium underline underline-offset-4"
                    >
                      Back to sign in
                    </Link>
                  </div>
                </form>
              </CardContent>
            </>
          )}
      </Card>
    </>
  );
}
