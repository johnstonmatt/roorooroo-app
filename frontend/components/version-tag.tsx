"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { api, ApiError } from "@/lib/api-client";

export default function VersionTag() {
  const [version, setVersion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function loadAppVersion() {
      try {
        // Get user's notifications using the API endpoint
        try {
          const response = await api.get("/version");
          setVersion(response?.data.version || "undefined");
        } catch (error) {
          console.error("Error fetching version:", error);
          if (
            (error instanceof ApiError && error.status === 401) ||
            (error instanceof Error && error.message.includes("401"))
          ) {
            router.push("/auth/login");
            return;
          }
        }
      } catch (error) {
        console.error("Error loading version:", error);
      } finally {
        setLoading(false);
      }
    }

    loadAppVersion();
  }, [router, supabase]);

  return <div>{loading ? "Loading" : version}</div>;
}
