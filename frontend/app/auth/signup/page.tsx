"use client";

import { Button } from "@/components/ui/button";
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
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { createClient } from "@/lib/supabase/client";

// Email allowlist configuration from environment variables
const ALLOWED_EMAILS = (process.env.NEXT_PUBLIC_ALLOWED_SIGNUP_EMAILS || "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);
const ALLOWED_DOMAIN = process.env.NEXT_PUBLIC_ALLOWED_SIGNUP_DOMAIN ||
  "@supabase.io";

// Build HTML5 pattern for email input validation
// Escape dots for regex and create pattern for both allowed emails and domain
const escapedEmails = ALLOWED_EMAILS.map((e) => e.replace(/\./g, "\\.")).join(
  "|",
);
const escapedDomain = ALLOWED_DOMAIN.replace(/\./g, "\\.");
const EMAIL_PATTERN = escapedEmails
  ? `^(${escapedEmails}|[^\\s@]+${escapedDomain})$`
  : `^[^\\s@]+${escapedDomain}$`;

export default function SignupPage() {
  const router = useRouter();

  const [error, signUp, isPending] = useActionState<string | null, FormData>(
    async (_previous, formData) => {
      const email = String(formData.get("email") ?? "");
      const password = String(formData.get("password") ?? "");
      const confirmPassword = String(formData.get("confirmPassword") ?? "");
      const displayName = String(formData.get("displayName") ?? "");

      if (password !== confirmPassword) return "Passwords do not match";

      // The pattern attribute already blocks this in the browser; repeat it
      // here because the attribute is only a hint, not a guarantee.
      const emailLower = email.toLowerCase();
      if (
        !ALLOWED_EMAILS.includes(emailLower) &&
        !emailLower.endsWith(ALLOWED_DOMAIN)
      ) {
        return `Only ${ALLOWED_DOMAIN} email addresses are allowed.`;
      }

      const supabase = createClient();
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName || undefined } },
      });
      if (signUpError) return signUpError.message || "Failed to sign up";

      router.push("/auth/signup-success");
      return null;
    },
    null,
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50 p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🐕</div>
          <h1 className="text-3xl font-bold text-orange-800 mb-2">RooRooRoo</h1>
          <p className="text-orange-600">Join the pack of website watchers</p>
        </div>

        <Card className="border-orange-200 shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-orange-800">
              Create Account
            </CardTitle>
            <CardDescription className="text-orange-600">
              Start watching websites like a loyal pup
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={signUp}>
              <div className="flex flex-col gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="displayName" className="text-orange-700">
                    Display Name
                  </Label>
                  <Input
                    id="displayName"
                    name="displayName"
                    type="text"
                    placeholder="Your name"
                    className="border-orange-200 focus:border-orange-400"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email" className="text-orange-700">
                    Email
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="your@email.com"
                    required
                    className="border-orange-200 focus:border-orange-400"
                    pattern={EMAIL_PATTERN}
                    title="Email must be a @supabase.io address or an approved email"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password" className="text-orange-700">
                    Password
                  </Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    className="border-orange-200 focus:border-orange-400"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="confirmPassword" className="text-orange-700">
                    Confirm Password
                  </Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    className="border-orange-200 focus:border-orange-400"
                  />
                </div>
                <FormError message={error} />
                <Button
                  type="submit"
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                  disabled={isPending}
                >
                  {isPending ? "Creating account..." : "Create Account"}
                </Button>
              </div>
              <div className="mt-6 text-center text-sm">
                <span className="text-orange-600">
                  Already have an account?
                </span>
                <Link
                  href="/auth/login"
                  className="text-orange-700 hover:text-orange-800 font-medium underline underline-offset-4"
                >
                  Sign in
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
