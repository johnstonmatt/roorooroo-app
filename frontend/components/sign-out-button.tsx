"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { LogOut } from "lucide-react";

interface Props {
  className?: string;
  size?: "sm" | "default" | "lg";
}

export function SignOutButton({ className, size = "default" }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const onSignOut = async () => {
    if (loading) return;
    setLoading(true);
    try {
      // Clear the browser session first
      await supabase.auth.signOut();
      router.push("/auth/login");
    } catch {
      // Even if signOut throws, push to login so the user isn&#39;t stuck
      router.push("/auth/login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      className={className}
      size={size}
      onClick={onSignOut}
      disabled={loading}
      title="Sign out"
    >
      <LogOut className="h-4 w-4 mr-2" />
      {loading ? "Signing out..." : "Sign Out"}
    </Button>
  );
}
