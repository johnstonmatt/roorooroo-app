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
import { useActionState } from "react";

export default function LoginPage() {
  const router = useRouter();

  // The form owns its field values; this holds only the failure message.
  const [error, signIn, isPending] = useActionState<string | null, FormData>(
    async (_previous, formData) => {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
      });
      if (signInError) {
        return signInError.message || "Invalid email or password";
      }
      router.push("/dashboard");
      return null;
    },
    null,
  );

  return (
    <>
      <AuthBrand tagline="Your faithful website watcher" />
      <Card className="shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-foreground">
            Welcome Back
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Sign in to check on your website watchers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={signIn}>
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
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-accent-foreground">
                    Password
                  </Label>
                  <Link
                    href="/auth/forgot-password"
                    className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                />
              </div>
              <FormError message={error} />
              <Button
                type="submit"
                className="w-full"
                disabled={isPending}
              >
                {isPending ? "Signing in..." : "Sign In"}
              </Button>
            </div>
            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground mr-1">
                New to RooRooRoo?
              </span>
              <Link
                href="/auth/signup"
                className="text-accent-foreground hover:text-foreground font-medium underline underline-offset-4"
              >
                Create an account
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
