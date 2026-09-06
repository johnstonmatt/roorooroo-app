"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AuthBrand } from "@/components/auth-brand";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function AuthErrorPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  return (
    <>
      <AuthBrand />
      <Card className="border-red-200 shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-red-700">
            Oops! Something went wrong
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <div className="mb-6">
            <div className="text-4xl mb-4">😞</div>
            {error
              ? <p className="text-sm text-red-600 mb-4">Error: {error}</p>
              : (
                <p className="text-sm text-red-600 mb-4">
                  An unexpected error occurred during authentication.
                </p>
              )}
          </div>
          <Button
            asChild
          >
            <Link href="/auth/login">Try Again</Link>
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
