"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { api, ApiError } from "@/lib/api-client";
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

        // Get user's notifications using the API endpoint
        try {
          const response = await api.get("/notifications");
          setNotifications(response?.data || []);
        } catch (error) {
          console.error("Error fetching notifications:", error);
          if (
            (error instanceof ApiError && error.status === 401) ||
            (error instanceof Error && error.message.includes("401"))
          ) {
            router.push("/auth/login");
            return;
          }
        }
      } catch (error) {
        console.error("Error loading notifications:", error);
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
      <header className="border-b border-orange-200 bg-white/80 backdrop-blur-sm">
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
          {notifications && notifications.length > 0
            ? <NotificationsList notifications={notifications} />
            : (
              /* Empty State */
              <div className="text-center py-16">
                <div className="text-6xl mb-6">🔔</div>
                <h2 className="text-2xl font-bold text-orange-800 mb-4">
                  No Notifications Yet
                </h2>
                <p className="text-orange-600 mb-8 max-w-md mx-auto">
                  When your watchers find something interesting, you'll see all
                  the alerts here.
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
