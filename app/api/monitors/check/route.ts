import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"
import { NotificationService, type NotificationPayload, type NotificationChannel } from "@/lib/notification-service"

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

      // Send notifications for status changes
      try {
        if (status === "found" && monitor.last_status !== "found") {
          await sendNotification(supabase, monitor, "pattern_found", contentSnippet)
        } else if (status === "not_found" && monitor.last_status === "found") {
          await sendNotification(supabase, monitor, "pattern_lost", null)
        }
      } catch (notificationError) {
        console.error("Failed to send status change notification:", notificationError)
        // Don't fail the entire request if notification fails
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

      // Send error notification
      try {
        await sendNotification(supabase, monitor, "error", null, errorMessage)
      } catch (notificationError) {
        console.error("Failed to send error notification:", notificationError)
        // Don't fail the entire request if notification fails
      }

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

async function sendNotification(supabase: any, monitor: any, type: string, contentSnippet: string | null, errorMessage?: string) {
  try {
    // Get user profile for notification
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", monitor.user_id).single()

    if (!profile) {
      console.log("No profile found for user:", monitor.user_id)
      return
    }

    const notificationChannels: NotificationChannel[] = monitor.notification_channels || []
    
    if (notificationChannels.length === 0) {
      console.log("No notification channels configured for monitor:", monitor.id)
      return
    }

    // Create notification payload
    const payload: NotificationPayload = {
      monitor: {
        id: monitor.id,
        name: monitor.name,
        url: monitor.url,
        pattern: monitor.pattern,
        pattern_type: monitor.pattern_type,
        user_id: monitor.user_id
      },
      type: type as 'pattern_found' | 'pattern_lost' | 'error',
      contentSnippet,
      errorMessage
    }

    // Use NotificationService to send notifications
    const notificationService = new NotificationService()
    const results = await notificationService.sendNotifications(payload, notificationChannels)

    // Log results for debugging
    console.log(`Sent ${results.length} notifications for monitor ${monitor.id}:`)
    results.forEach((result, index) => {
      const channel = notificationChannels[index]
      if (result.success) {
        console.log(`✓ ${channel.type} to ${channel.address}: ${result.messageId}`)
      } else {
        console.error(`✗ ${channel.type} to ${channel.address}: ${result.error}`)
      }
    })

    // Return summary of notification results
    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length
    
    return {
      total: results.length,
      successful,
      failed,
      results
    }

  } catch (error) {
    console.error("Notification error:", error)
    
    // Log the notification failure to database for tracking
    try {
      await supabase.from("notifications").insert({
        monitor_id: monitor.id,
        user_id: monitor.user_id,
        type,
        channel: "system",
        message: `Failed to send notifications: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: "failed",
        error_message: error instanceof Error ? error.message : 'Unknown error'
      })
    } catch (logError) {
      console.error("Failed to log notification error:", logError)
    }
    
    throw error
  }
}
