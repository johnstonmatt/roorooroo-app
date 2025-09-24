import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { NotificationsList } from "@/components/notifications-list"

export default async function NotificationsPage() {
  const supabase = await createClient()

  // Check authentication
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) {
    redirect("/auth/login")
  }

  // Get user's notifications with all fields needed for SMS support
  const { data: notifications, error: notificationsError } = await supabase
    .from("notifications")
    .select(
      `
      id,
      type,
      channel,
      message,
      status,
      error_message,
      sent_at,
      monitors (
        name,
        url
      )
    `,
    )
    .eq("user_id", user.id)
    .order("sent_at", { ascending: false })
    .limit(50)

  if (notificationsError) {
    console.error("Error fetching notifications:", notificationsError)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* Header */}
      <header className="border-b border-orange-200 bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild className="text-orange-700">
              <Link href="/dashboard">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Link>
            </Button>
            <div className="flex items-center gap-3">
              <div className="text-2xl">🔔</div>
              <div>
                <h1 className="text-xl font-bold text-orange-800">Notifications</h1>
                <p className="text-xs text-orange-600">Your alert history</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {notifications && notifications.length > 0 ? (
            <NotificationsList notifications={notifications} />
          ) : (
            /* Empty State */
            <div className="text-center py-16">
              <div className="text-6xl mb-6">🔔</div>
              <h2 className="text-2xl font-bold text-orange-800 mb-4">No Notifications Yet</h2>
              <p className="text-orange-600 mb-8 max-w-md mx-auto">
                When your watchers find something interesting, you'll see all the alerts here.
              </p>
              <Button asChild size="lg" className="bg-orange-500 hover:bg-orange-600 text-white">
                <Link href="/dashboard">Back to Dashboard</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
