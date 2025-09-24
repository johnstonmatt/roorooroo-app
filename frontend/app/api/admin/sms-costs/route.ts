/**
 * Admin API endpoint for SMS cost monitoring
 * Provides cost statistics and alerts for system administrators
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SMSCostMonitor } from '@/lib/sms-cost-monitor'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // TODO: Add admin role check here
    // For now, any authenticated user can access this endpoint
    // In production, you should verify the user has admin privileges

    const costMonitor = new SMSCostMonitor()
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    switch (action) {
      case 'stats':
        const stats = await costMonitor.getSystemCostStats()
        return NextResponse.json({ stats })

      case 'alerts':
        const alerts = await costMonitor.getUsersExceedingLimits()
        return NextResponse.json({ alerts })

      case 'user-projection':
        const userId = searchParams.get('userId')
        if (!userId) {
          return NextResponse.json(
            { error: 'userId parameter required' },
            { status: 400 }
          )
        }
        
        const projection = await costMonitor.getCostProjection(userId)
        return NextResponse.json({ projection })

      default:
        // Default: return both stats and alerts
        const [systemStats, systemAlerts] = await Promise.all([
          costMonitor.getSystemCostStats(),
          costMonitor.getUsersExceedingLimits()
        ])
        
        return NextResponse.json({
          stats: systemStats,
          alerts: systemAlerts
        })
    }
  } catch (error) {
    console.error('SMS cost monitoring API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // TODO: Add admin role check here

    const body = await request.json()
    const { action } = body

    const costMonitor = new SMSCostMonitor()

    switch (action) {
      case 'reset-monthly-costs':
        const result = await costMonitor.resetMonthlyCosts()
        
        if (result.error) {
          return NextResponse.json(
            { error: result.error },
            { status: 500 }
          )
        }
        
        return NextResponse.json({
          message: `Successfully reset monthly costs for ${result.resetCount} users`,
          resetCount: result.resetCount
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('SMS cost monitoring API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}