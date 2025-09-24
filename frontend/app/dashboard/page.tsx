import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Plus, Bell } from "lucide-react"
import { MonitorCard } from "@/components/monitor-card"

export default async function DashboardPage() {
  const supabase = await createClient()

  // Check authentication
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) {
    redirect("/auth/login")
  }

  // Get user profile
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  // Get user's monitors
  const { data: monitors, error: monitorsError } = await supabase
    .from("monitors")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (monitorsError) {
    console.error("Error fetching monitors:", monitorsError)
  }

  const { data: notifications, error: notificationsError } = await supabase
    .from("notifications")
    .select("id")
    .eq("user_id", user.id)
    .gte("sent_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours

  const todayNotificationCount = notifications?.length || 0

  const activeMonitors = monitors?.filter((m) => m.is_active) || []
  const inactiveMonitors = monitors?.filter((m) => !m.is_active) || []

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* Header */}
      <header className="border-b border-orange-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-3xl">🐕</div>
            <div>
              <h1 className="text-2xl font-bold text-orange-800">RooRooRoo</h1>
              <p className="text-xs text-orange-600">Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-orange-700">Hello, {profile?.display_name || "Watcher"}!</span>
            <Button variant="ghost" asChild className="text-orange-700 hover:text-orange-800">
              <Link href="/dashboard/notifications">
                <Bell className="h-4 w-4 mr-2" />
                Notifications
              </Link>
            </Button>
            <Button asChild className="bg-orange-500 hover:bg-orange-600 text-white">
              <Link href="/dashboard/new">
                <Plus className="h-4 w-4 mr-2" />
                New Watcher
              </Link>
            </Button>
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
                  <p className="text-2xl font-bold text-orange-800">{monitors?.length || 0}</p>
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
                  <p className="text-2xl font-bold text-green-700">{activeMonitors.length}</p>
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
                  <p className="text-2xl font-bold text-gray-600">{inactiveMonitors.length}</p>
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
                  <p className="text-2xl font-bold text-blue-700">{todayNotificationCount}</p>
                </div>
                <div className="text-2xl">🔔</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Monitors List */}
        {monitors && monitors.length > 0 ? (
          <div className="space-y-6">
            {/* Active Monitors */}
            {activeMonitors.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-xl font-semibold text-orange-800">Active Watchers</h2>
                  <Badge className="bg-green-100 text-green-700">{activeMonitors.length}</Badge>
                </div>
                <div className="grid gap-4">
                  {activeMonitors.map((monitor) => (
                    <MonitorCard key={monitor.id} monitor={monitor} />
                  ))}
                </div>
              </div>
            )}

            {/* Inactive Monitors */}
            {inactiveMonitors.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-xl font-semibold text-orange-800">Paused Watchers</h2>
                  <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                    {inactiveMonitors.length}
                  </Badge>
                </div>
                <div className="grid gap-4">
                  {inactiveMonitors.map((monitor) => (
                    <MonitorCard key={monitor.id} monitor={monitor} />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Empty State */
          <div className="text-center py-16">
            <div className="text-6xl mb-6">🐕</div>
            <h2 className="text-2xl font-bold text-orange-800 mb-4">No Watchers Yet</h2>
            <p className="text-orange-600 mb-8 max-w-md mx-auto">
              Your faithful pup is ready to start watching! Create your first website monitor to get started.
            </p>
            <Button asChild size="lg" className="bg-orange-500 hover:bg-orange-600 text-white">
              <Link href="/dashboard/new">
                <Plus className="h-5 w-5 mr-2" />
                Create Your First Watcher
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
