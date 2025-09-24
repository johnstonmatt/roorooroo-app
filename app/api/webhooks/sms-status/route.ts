/**
 * Twilio SMS Status Webhook Endpoint
 * Receives delivery status updates from Twilio and updates notification records
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getConfig } from '@/lib/config'

interface TwilioStatusWebhook {
  MessageSid: string
  MessageStatus: 'queued' | 'sent' | 'delivered' | 'failed' | 'undelivered'
  ErrorCode?: string
  ErrorMessage?: string
  To: string
  From: string
  AccountSid: string
}

export async function POST(request: NextRequest) {
  try {
    const config = getConfig()
    
    // Verify the request is from Twilio (basic validation)
    const contentType = request.headers.get('content-type')
    if (!contentType?.includes('application/x-www-form-urlencoded')) {
      return NextResponse.json(
        { error: 'Invalid content type' },
        { status: 400 }
      )
    }

    // Parse form data from Twilio
    const formData = await request.formData()
    const webhookData: TwilioStatusWebhook = {
      MessageSid: formData.get('MessageSid') as string,
      MessageStatus: formData.get('MessageStatus') as TwilioStatusWebhook['MessageStatus'],
      ErrorCode: formData.get('ErrorCode') as string || undefined,
      ErrorMessage: formData.get('ErrorMessage') as string || undefined,
      To: formData.get('To') as string,
      From: formData.get('From') as string,
      AccountSid: formData.get('AccountSid') as string
    }

    // Validate required fields
    if (!webhookData.MessageSid || !webhookData.MessageStatus) {
      return NextResponse.json(
        { error: 'Missing required webhook data' },
        { status: 400 }
      )
    }

    // Verify the request is from our Twilio account
    if (webhookData.AccountSid !== config.twilio.accountSid) {
      console.warn('Webhook from unknown Twilio account:', webhookData.AccountSid)
      return NextResponse.json(
        { error: 'Invalid account' },
        { status: 403 }
      )
    }

    // Update notification status in database
    await updateNotificationStatus(webhookData)

    // Log status update in development
    if (config.isDevelopment) {
      console.log('SMS status update received:', {
        messageId: webhookData.MessageSid,
        status: webhookData.MessageStatus,
        to: webhookData.To.replace(/\d(?=\d{4})/g, '*'), // Mask phone number
        error: webhookData.ErrorCode ? `${webhookData.ErrorCode}: ${webhookData.ErrorMessage}` : undefined
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('SMS webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function updateNotificationStatus(webhookData: TwilioStatusWebhook): Promise<void> {
  try {
    const supabase = createClient()

    // Find the notification record by message ID
    const { data: notification, error: findError } = await supabase
      .from('notifications')
      .select('id, status')
      .eq('message_id', webhookData.MessageSid)
      .eq('channel', 'sms')
      .single()

    if (findError || !notification) {
      console.warn('Notification not found for message ID:', webhookData.MessageSid)
      return
    }

    // Map Twilio status to our status
    let status: string
    let errorMessage: string | null = null

    switch (webhookData.MessageStatus) {
      case 'queued':
      case 'sent':
        status = 'sent'
        break
      case 'delivered':
        status = 'delivered'
        break
      case 'failed':
      case 'undelivered':
        status = 'failed'
        errorMessage = webhookData.ErrorCode 
          ? `${webhookData.ErrorCode}: ${webhookData.ErrorMessage}`
          : 'Delivery failed'
        break
      default:
        status = 'sent' // Default to sent for unknown statuses
    }

    // Update the notification record
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    }

    if (errorMessage) {
      updateData.error_message = errorMessage
    }

    const { error: updateError } = await supabase
      .from('notifications')
      .update(updateData)
      .eq('id', notification.id)

    if (updateError) {
      console.error('Failed to update notification status:', updateError)
    }
  } catch (error) {
    console.error('Error updating notification status:', error)
  }
}

// Handle GET requests (for webhook verification)
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'SMS status webhook endpoint',
    timestamp: new Date().toISOString()
  })
}