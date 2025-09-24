import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { ArrowLeft, Mail } from "lucide-react"

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

  // Get user's notifications
  const { data: notifications, error: notificationsError } = await supabase
    .from("notifications")
    .select(
      `
      *,
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString() + " " + date.toLocaleTimeString()
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "pattern_found":
        return "🎯"
      case "pattern_lost":
        return "❌"
      case "error":
        return "⚠️"
      default:
        return "🔔"
    }
  }

  const getNotificationTitle = (type: string) => {
    switch (type) {
      case "pattern_found":
        return "Pattern Found"
      case "pattern_lost":
        return "Pattern Lost"
      case "error":
        return "Monitor Error"
      default:
        return "Notification"
    }
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
            <div className="space-y-4">
              {notifications.map((notification: any) => (
                <Card key={notification.id} className="border-orange-200">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">{getNotificationIcon(notification.type)}</div>
                        <div>
                          <CardTitle className="text-lg text-orange-800">
                            {getNotificationTitle(notification.type)}
                          </CardTitle>
                          <CardDescription className="text-orange-600">
                            {notification.monitors?.name} • {formatDate(notification.sent_at)}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={notification.status === "sent" ? "default" : "destructive"}
                          className={
                            notification.status === "sent" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                          }
                        >
                          {notification.status}
                        </Badge>
                        {notification.channel === "email" && <Mail className="h-4 w-4 text-orange-600" />}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="bg-orange-50 rounded-md p-3">
                      <pre className="text-sm text-orange-800 whitespace-pre-wrap font-sans">
                        {notification.message}
                      </pre>
                    </div>
                    {notification.monitors?.url && (
                      <div className="mt-3 text-sm text-orange-600">
                        <strong>Website:</strong>{" "}
                        <a
                          href={notification.monitors.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-orange-700 hover:underline"
                        >
                          {notification.monitors.url}
                        </a>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
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
