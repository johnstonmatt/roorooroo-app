"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Status {
  service: string;
  version: string;
  timestamp: string;
  uptime: number;
  environment: string;
}

export default function StatusTag() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadStatus() {
      try {
        const res: Status = await api.get("/status");
        if (isMounted) {
          setStatus(res);
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
    if (loading) return { badge: "bg-yellow-100 text-yellow-700", dot: "bg-yellow-500", text: "Loading" } as const;
    if (error || !status) return { badge: "bg-red-100 text-red-700", dot: "bg-red-500", text: "Disconnected" } as const;
    return { badge: "bg-green-100 text-green-700", dot: "bg-green-500", text: "API OK" } as const;
  };

  const styles = getBadgeClasses();
  const versionText = status?.version ? `${status.version}` : undefined;
  const envText = status?.environment;

  return (
    <div className="w-full flex items-center justify-center gap-2 bg-transparent pb-0 mb-0">
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

      {status && (
        <Badge
          variant="outline"
          className={cn(
            "bg-gray-100 text-gray-700 inline-flex items-center gap-1 border-transparent px-2 py-0.5 text-xs leading-none",
          )}
          aria-label="version"
          title={status.timestamp}
        >
          <span className="w-2 h-2 rounded-full bg-gray-500" />
          <span>{envText ? envText : ""}{envText && versionText ? " • " : ""}{versionText ?? ""}</span>
        </Badge>
      )}
    </div>
  );
}
