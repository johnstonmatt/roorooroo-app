"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { BrandLink } from "@/components/nav-auth";
import { SignOutButton } from "@/components/sign-out-button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Bell, Plus } from "lucide-react";
import { MonitorCard } from "@/components/monitor-card";
import { type Monitor, type Profile, toMonitor } from "@/lib/db";

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [todayNotificationCount, setTodayNotificationCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  const refreshMonitors = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("monitors")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setMonitors((data ?? []).map(toMonitor));
    } catch (error) {
      console.error("Error fetching monitors:", error);
      router.push("/auth/login");
      return;
    }
  }, [router, supabase]);

  useEffect(() => {
    async function loadData() {
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

        // Get user profile
        const { data: profile } = await supabase.from("profiles").select("*")
          .eq("id", user.id).single();
        setProfile(profile);

        // Get user's monitors using Supabase client
        await refreshMonitors();

        // Get notifications count from the last 24 hours using Supabase client
        try {
          const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
            .toISOString();
          const { data: notifications, error: notifError } = await supabase
            .from("notifications")
            .select("id")
            .gte("created_at", since)
            .eq("user_id", user.id);
          if (notifError) throw notifError;
          setTodayNotificationCount(notifications?.length || 0);
        } catch (error) {
          console.error("Error fetching notifications count:", error);
          setTodayNotificationCount(0);
        }
      } catch (error) {
        console.error("Error loading dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router, supabase, refreshMonitors]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🐕</div>
          <p className="text-orange-600">Loading your watchers...</p>
        </div>
      </div>
    );
  }

  const activeMonitors = monitors.filter((m) => m.is_active);
  const inactiveMonitors = monitors.filter((m) => !m.is_active);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* Header */}
      <header className="border-b border-orange-200 bg-surface-raised backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <BrandLink className="flex items-center gap-3">
            <div className="text-3xl">🐕</div>
            <div>
              <h1 className="text-2xl font-bold text-orange-800">RooRooRoo</h1>
              <p className="text-xs text-orange-600">Dashboard</p>
            </div>
          </BrandLink>
          <div className="flex items-center gap-3">
            <span className="text-sm text-orange-700">
              Hello, {profile?.display_name || "Watcher"}!
            </span>
            <Button
              variant="ghost"
              asChild
              className="text-orange-700 hover:text-orange-800"
            >
              <Link href="/dashboard/notifications">
                <Bell className="h-4 w-4 mr-2" />
                Notifications
              </Link>
            </Button>
            <Button
              asChild
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              <Link href="/dashboard/new">
                <Plus className="h-4 w-4 mr-2" />
                New Watcher
              </Link>
            </Button>
            <SignOutButton className="border-orange-300 text-orange-700" />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="border-orange-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-orange-600">Total Watchers</p>
                  <p className="text-2xl font-bold text-orange-800">
                    {monitors?.length || 0}
                  </p>
                </div>
                <div className="text-2xl">👀</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-orange-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-orange-600">Active</p>
                  <p className="text-2xl font-bold text-green-700">
                    {activeMonitors.length}
                  </p>
                </div>
                <div className="text-2xl">🟢</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-orange-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-orange-600">Paused</p>
                  <p className="text-2xl font-bold text-gray-600">
                    {inactiveMonitors.length}
                  </p>
                </div>
                <div className="text-2xl">⏸️</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-orange-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-orange-600">Alerts Today</p>
                  <p className="text-2xl font-bold text-blue-700">
                    {todayNotificationCount}
                  </p>
                </div>
                <div className="text-2xl">🔔</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Monitors List */}
        {monitors && monitors.length > 0
          ? (
            <div className="space-y-6">
              {/* Active Monitors */}
              {activeMonitors.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <h2 className="text-xl font-semibold text-orange-800">
                      Active Watchers
                    </h2>
                    <Badge className="bg-green-100 text-green-700">
                      {activeMonitors.length}
                    </Badge>
                  </div>
                  <div className="grid gap-4">
                    {activeMonitors.map((monitor) => (
                      <MonitorCard
                        key={monitor.id}
                        monitor={monitor}
                        onChanged={refreshMonitors}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Inactive Monitors */}
              {inactiveMonitors.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <h2 className="text-xl font-semibold text-orange-800">
                      Paused Watchers
                    </h2>
                    <Badge
                      variant="secondary"
                      className="bg-gray-100 text-gray-700"
                    >
                      {inactiveMonitors.length}
                    </Badge>
                  </div>
                  <div className="grid gap-4">
                    {inactiveMonitors.map((monitor) => (
                      <MonitorCard
                        key={monitor.id}
                        monitor={monitor}
                        onChanged={refreshMonitors}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
          : (
            /* Empty State */
            <div className="text-center py-16">
              <div className="text-6xl mb-6">🐕</div>
              <h2 className="text-2xl font-bold text-orange-800 mb-4">
                No Watchers Yet
              </h2>
              <p className="text-orange-600 mb-8 max-w-md mx-auto">
                Your faithful pup is ready to start watching! Create your first
                website monitor to get started.
              </p>
              <Button
                asChild
                size="lg"
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                <Link href="/dashboard/new">
                  <Plus className="h-5 w-5 mr-2" />
                  Create Your First Watcher
                </Link>
              </Button>
            </div>
          )}
      </div>
    </div>
  );
}
