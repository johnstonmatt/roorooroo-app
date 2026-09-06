"use client";

import type React from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

/**
 * Whether someone is signed in. `null` while we are still finding out, so
 * callers can avoid flashing the signed-out state at a signed-in visitor --
 * which is what made the marketing page look like it had logged you out.
 */
function useSignedIn(): boolean | null {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active) setSignedIn(Boolean(data.session));
    });

    // Keeps the nav honest if the session ends in another tab.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (active) setSignedIn(Boolean(session));
      },
    );

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return signedIn;
}

/**
 * The brand in the header. Goes to the dashboard for a signed-in visitor and
 * to the marketing page otherwise.
 */
export function BrandLink(
  { children, className }: {
    children: React.ReactNode;
    className?: string;
  },
) {
  const signedIn = useSignedIn();
  return (
    <Link href={signedIn ? "/dashboard" : "/"} className={className}>
      {children}
    </Link>
  );
}

/** Header actions on the marketing page. */
export function HomeNavActions() {
  const signedIn = useSignedIn();

  // Render nothing until we know, rather than showing "Sign In" to someone who
  // is already signed in.
  if (signedIn === null) return <div className="h-9" />;

  if (signedIn) {
    return (
      <Button
        asChild
      >
        <Link href="/dashboard">Go to Dashboard</Link>
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        asChild
        className="text-accent-foreground hover:text-foreground"
      >
        <Link href="/auth/login">Sign In</Link>
      </Button>
      <Button
        asChild
      >
        <Link href="/auth/signup">Get Started</Link>
      </Button>
    </>
  );
}
