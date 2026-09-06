"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/sign-out-button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NotificationsList } from "@/components/notifications-list";
import { DashboardHeader, HeaderTitle } from "@/components/dashboard-header";
import { Emoji } from "@/lib/emoji";
import type { Notification } from "@/lib/db";

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
          .select("*, monitors(name, url)")
          .order("created_at", { ascending: false });
        if (notifError) throw notifError;

        setNotifications(data ?? []);
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔔</div>
          <p className="text-muted-foreground">Loading notifications...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <DashboardHeader>
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="text-accent-foreground"
          >
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
          <HeaderTitle
            emoji={<Emoji char="🔔" />}
            title="Notifications"
            subtitle="Your alert history"
          />
        </div>
        <SignOutButton className="border-orange-300 text-accent-foreground" />
      </DashboardHeader>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {error
            ? (
              <div className="text-center py-16">
                <div className="text-6xl mb-6">⚠️</div>
                <h2 className="text-2xl font-bold text-foreground mb-4">
                  Could not load notifications
                </h2>
                <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                  {error}
                </p>
                <Button
                  asChild
                  size="lg"
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
                <h2 className="text-2xl font-bold text-foreground mb-4">
                  No Notifications Yet
                </h2>
                <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                  When your watchers find something interesting, you&#39;ll see
                  all the alerts here.
                </p>
                <Button
                  asChild
                  size="lg"
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
