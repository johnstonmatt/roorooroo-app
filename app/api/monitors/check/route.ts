import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { monitorId } = await request.json()

    if (!monitorId) {
      return NextResponse.json({ error: "Monitor ID is required" }, { status: 400 })
    }

    // Get monitor details
    const { data: monitor, error: monitorError } = await supabase
      .from("monitors")
      .select("*")
      .eq("id", monitorId)
      .single()

    if (monitorError || !monitor) {
      return NextResponse.json({ error: "Monitor not found" }, { status: 404 })
    }

    if (!monitor.is_active) {
      return NextResponse.json({ error: "Monitor is not active" }, { status: 400 })
    }

    // Fetch the website content
    const startTime = Date.now()
    let status = "not_found"
    let errorMessage = null
    let contentSnippet = null

    try {
      const response = await fetch(monitor.url, {
        headers: {
          "User-Agent": "RooRooRoo-Bot/1.0 (Website Monitor)",
        },
        timeout: 30000, // 30 second timeout
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const content = await response.text()
      const responseTime = Date.now() - startTime

      // Check pattern match
      let patternFound = false
      switch (monitor.pattern_type) {
        case "contains":
          patternFound = content.toLowerCase().includes(monitor.pattern.toLowerCase())
          break
        case "not_contains":
          patternFound = !content.toLowerCase().includes(monitor.pattern.toLowerCase())
          break
        case "regex":
          try {
            const regex = new RegExp(monitor.pattern, "i")
            patternFound = regex.test(content)
          } catch (regexError) {
            throw new Error(`Invalid regex pattern: ${regexError}`)
          }
          break
      }

      status = patternFound ? "found" : "not_found"

      // Extract content snippet if pattern found
      if (patternFound && monitor.pattern_type !== "not_contains") {
        const patternIndex = content.toLowerCase().indexOf(monitor.pattern.toLowerCase())
        if (patternIndex !== -1) {
          const start = Math.max(0, patternIndex - 50)
          const end = Math.min(content.length, patternIndex + monitor.pattern.length + 50)
          contentSnippet = content.substring(start, end).trim()
        }
      }

      // Log the check
      await supabase.from("monitor_logs").insert({
        monitor_id: monitor.id,
        status,
        response_time: responseTime,
        content_snippet: contentSnippet,
      })

      // Update monitor last check status
      await supabase
        .from("monitors")
        .update({
          last_checked: new Date().toISOString(),
          last_status: status,
        })
        .eq("id", monitor.id)

      // Send notification if pattern found and this is a status change
      if (status === "found" && monitor.last_status !== "found") {
        await sendNotification(supabase, monitor, "pattern_found", contentSnippet)
      }

      return NextResponse.json({
        success: true,
        status,
        responseTime,
        contentSnippet,
      })
    } catch (fetchError) {
      errorMessage = fetchError instanceof Error ? fetchError.message : "Unknown error"
      status = "error"

      // Log the error
      await supabase.from("monitor_logs").insert({
        monitor_id: monitor.id,
        status: "error",
        error_message: errorMessage,
      })

      // Update monitor status
      await supabase
        .from("monitors")
        .update({
          last_checked: new Date().toISOString(),
          last_status: "error",
        })
        .eq("id", monitor.id)

      return NextResponse.json({
        success: false,
        status: "error",
        error: errorMessage,
      })
    }
  } catch (error) {
    console.error("Monitor check error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

async function sendNotification(supabase: any, monitor: any, type: string, contentSnippet: string | null) {
  try {
    // Get user profile for notification
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", monitor.user_id).single()

    if (!profile) return

    const notificationChannels = monitor.notification_channels || []

    for (const channel of notificationChannels) {
      if (channel.type === "email") {
        const message = `🐕 RooRooRoo Alert!

Your watcher "${monitor.name}" found a match!

Website: ${monitor.url}
Pattern: "${monitor.pattern}"
${contentSnippet ? `\nContent found: "${contentSnippet}"` : ""}

Time: ${new Date().toLocaleString()}

View your dashboard: ${process.env.NEXT_PUBLIC_SITE_URL || "https://roorooroo.app"}/dashboard`

        // In a real app, you'd integrate with an email service like Resend, SendGrid, etc.
        // For now, we'll just log the notification
        console.log("Email notification:", {
          to: channel.address,
          subject: `🐕 RooRooRoo Alert: ${monitor.name}`,
          message,
        })

        // Log notification in database
        await supabase.from("notifications").insert({
          monitor_id: monitor.id,
          user_id: monitor.user_id,
          type,
          channel: "email",
          message,
          status: "sent",
        })
      }
    }
  } catch (error) {
    console.error("Notification error:", error)
  }
}
