"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** The slice of the OpenAPI document this badge renders. */
interface ApiDocument {
  info: {
    title: string;
    version: string;
    "x-environment"?: string;
  };
}

export default function StatusTag() {
  const isHome = usePathname() === "/";
  const [doc, setDoc] = useState<ApiDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadStatus() {
      try {
        // Serving the document also proves the function is deployed and up,
        // so it doubles as the liveness check the old /status endpoint was.
        const res: ApiDocument | null = await api.get("/openapi.json");
        // api.get yields null for a response it does not recognize as JSON.
        // Without this, that silently renders as "Disconnected" with nothing
        // logged -- which is exactly how it failed once already.
        if (!res?.info) {
          throw new Error("API returned no usable OpenAPI document");
        }
        if (isMounted) {
          setDoc(res);
        }
      } catch (err) {
        console.error("Error fetching status:", err);
        if (isMounted) setError("disconnected");
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadStatus();
    return () => {
      isMounted = false;
    };
  }, []);

  // Map to existing app badge styles
  const getBadgeClasses = () => {
    if (loading) {
      return {
        badge: "bg-yellow-100 text-yellow-700",
        dot: "bg-yellow-500",
        text: "Loading",
      } as const;
    }
    if (error || !doc) {
      return {
        badge: "bg-red-100 text-red-700",
        dot: "bg-red-500",
        text: "Disconnected",
      } as const;
    }
    return {
      badge: "bg-green-100 text-green-700",
      dot: "bg-green-500",
      text: "API OK",
    } as const;
  };

  const styles = getBadgeClasses();
  const versionText = doc?.info.version;
  const envText = doc?.info["x-environment"];

  return (
    <div
      className={cn(
        "w-full flex items-center justify-center gap-2 py-2",
        // The home page ends in a white footer; every other page ends in the
        // layout gradient. Matching it here avoids a strip of the wrong
        // colour under the last section.
        isHome ? "bg-white/80" : "bg-transparent",
      )}
    >
      <Badge
        variant="outline"
        className={cn(
          styles.badge,
          "inline-flex items-center gap-1 border-transparent px-2 py-0.5 text-xs leading-none",
        )}
        aria-label={`${styles.text} status`}
      >
        <span className={cn("w-2 h-2 rounded-full", styles.dot)} />
        <span>{styles.text}</span>
      </Badge>

      {doc && (
        <Badge
          variant="outline"
          className={cn(
            "bg-blue-100 text-blue-700 inline-flex items-center gap-1 border-transparent px-2 py-0.5 text-xs leading-none",
          )}
          aria-label="version"
          title={doc.info.title}
        >
          <span className="w-2 h-2 rounded-full bg-gray-500" />
          <span>
            {envText ? envText : ""}
            {envText && versionText ? " • " : ""}
            {versionText ?? ""}
          </span>
        </Badge>
      )}
    </div>
  );
}
