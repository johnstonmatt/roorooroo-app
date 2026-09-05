"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/sign-out-button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NotificationsList } from "@/components/notifications-list";
import { Emoji } from "@/lib/emoji";

interface Notification {
  id: string;
  type: string;
  channel: string;
  message: string;
  status: string;
  error_message?: string;
  sent_at: string;
  monitors?: {
    name: string;
    url: string;
  };
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function loadNotifications() {
      try {
        // Check authentication
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          router.push("/auth/login");
          return;
        }

        // notifications is the table; RLS scopes it to the caller. An
        // earlier version read the notification_history view, which was
        // dropped in 20251007051434 -- and because the failure was only
        // logged, the page rendered an empty list instead of an error.
        const { data, error: notifError } = await supabase
          .from("notifications")
          .select(
            "id, type, channel, message, status, error_message, sent_at, created_at, monitors(name, url)",
          )
          .order("created_at", { ascending: false });
        if (notifError) throw notifError;

        setNotifications(
          (data || []).map((n) => ({
            id: n.id,
            type: n.type,
            channel: n.channel,
            message: n.message,
            status: n.status,
            error_message: n.error_message ?? undefined,
            // sent_at is null until the send succeeds, so fall back to when
            // the row was written rather than rendering "Invalid Date".
            sent_at: n.sent_at || n.created_at,
            // PostgREST returns a single object for this many-to-one embed,
            // but the untyped client widens it to an array. Normalise both.
            monitors: (Array.isArray(n.monitors) ? n.monitors[0] : n.monitors) ??
              undefined,
          })),
        );
      } catch (err) {
        console.error("Error loading notifications:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load notifications",
        );
      } finally {
        setLoading(false);
      }
    }

    loadNotifications();
  }, [router, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔔</div>
          <p className="text-orange-600">Loading notifications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* Header */}
      <header className="border-b border-orange-200 bg-surface-raised backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div />
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="text-orange-700"
            >
              <Link href="/dashboard">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Link>
            </Button>
            <div className="flex items-center gap-3">
              <div className="text-2xl">
                <Emoji char="🔔" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-orange-800">
                  Notifications
                </h1>
                <p className="text-xs text-orange-600">Your alert history</p>
              </div>
            </div>
          </div>
          <SignOutButton className="border-orange-300 text-orange-700" />
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {error
            ? (
              <div className="text-center py-16">
                <div className="text-6xl mb-6">⚠️</div>
                <h2 className="text-2xl font-bold text-orange-800 mb-4">
                  Could not load notifications
                </h2>
                <p className="text-orange-600 mb-8 max-w-md mx-auto">{error}</p>
                <Button
                  asChild
                  size="lg"
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  <Link href="/dashboard">Back to Dashboard</Link>
                </Button>
              </div>
            )
            : notifications.length > 0
            ? <NotificationsList notifications={notifications} />
            : (
              /* Empty State */
              <div className="text-center py-16">
                <div className="text-6xl mb-6">🔔</div>
                <h2 className="text-2xl font-bold text-orange-800 mb-4">
                  No Notifications Yet
                </h2>
                <p className="text-orange-600 mb-8 max-w-md mx-auto">
                  When your watchers find something interesting, you&#39;ll see
                  all the alerts here.
                </p>
                <Button
                  asChild
                  size="lg"
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  <Link href="/dashboard">Back to Dashboard</Link>
                </Button>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
