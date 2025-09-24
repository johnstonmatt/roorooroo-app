/**
 * SMS Rate Limiting and Cost Monitoring Service
 * Tracks SMS usage per user and implements safeguards
 */

import { createClient } from '@/lib/supabase/server'
import { getConfig } from './config'

interface SMSUsage {
  userId: string
  hourlyCount: number
  dailyCount: number
  monthlyCount: number
  monthlyCostUSD: number
  lastResetHour: Date
  lastResetDay: Date
  lastResetMonth: Date
}

interface RateLimitResult {
  allowed: boolean
  reason?: string
  remainingHourly?: number
  remainingDaily?: number
  estimatedMonthlyCost?: number
}

export class SMSRateLimiter {
  private config = getConfig()

  /**
   * Check if user is allowed to send SMS based on rate limits
   */
  async checkRateLimit(userId: string): Promise<RateLimitResult> {
    try {
      const usage = await this.getUserUsage(userId)
      const now = new Date()

      // Reset counters if time periods have passed
      const updatedUsage = this.resetCountersIfNeeded(usage, now)

      // Check hourly limit
      if (updatedUsage.hourlyCount >= this.config.smsLimits.maxSMSPerUserPerHour) {
        return {
          allowed: false,
          reason: `Hourly SMS limit exceeded (${this.config.smsLimits.maxSMSPerUserPerHour} messages/hour)`,
          remainingHourly: 0
        }
      }

      // Check daily limit
      if (updatedUsage.dailyCount >= this.config.smsLimits.maxSMSPerUserPerDay) {
        return {
          allowed: false,
          reason: `Daily SMS limit exceeded (${this.config.smsLimits.maxSMSPerUserPerDay} messages/day)`,
          remainingDaily: 0
        }
      }

      // Check monthly cost limit
      const projectedCost = updatedUsage.monthlyCostUSD + this.config.smsLimits.costPerSMSUSD
      if (projectedCost > this.config.smsLimits.maxMonthlyCostUSD) {
        return {
          allowed: false,
          reason: `Monthly SMS cost limit would be exceeded ($${this.config.smsLimits.maxMonthlyCostUSD})`,
          estimatedMonthlyCost: projectedCost
        }
      }

      return {
        allowed: true,
        remainingHourly: this.config.smsLimits.maxSMSPerUserPerHour - updatedUsage.hourlyCount,
        remainingDaily: this.config.smsLimits.maxSMSPerUserPerDay - updatedUsage.dailyCount,
        estimatedMonthlyCost: projectedCost
      }
    } catch (error) {
      console.error('Rate limit check failed:', error)
      // Fail closed - deny if we can't check limits
      return {
        allowed: false,
        reason: 'Unable to verify SMS limits. Please try again later.'
      }
    }
  }

  /**
   * Record SMS usage after successful send
   */
  async recordSMSUsage(userId: string): Promise<void> {
    try {
      const supabase = createClient()
      const now = new Date()
      const cost = this.config.smsLimits.costPerSMSUSD

      // Use upsert to handle concurrent updates
      const { error } = await supabase
        .from('sms_usage')
        .upsert({
          user_id: userId,
          hourly_count: 1,
          daily_count: 1,
          monthly_count: 1,
          monthly_cost_usd: cost,
          last_reset_hour: this.getHourStart(now),
          last_reset_day: this.getDayStart(now),
          last_reset_month: this.getMonthStart(now),
          updated_at: now.toISOString()
        }, {
          onConflict: 'user_id',
          ignoreDuplicates: false
        })

      if (error) {
        console.error('Failed to record SMS usage:', error)
      }
    } catch (error) {
      console.error('SMS usage recording error:', error)
    }
  }

  /**
   * Get current usage for a user
   */
  private async getUserUsage(userId: string): Promise<SMSUsage> {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('sms_usage')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      // Return default usage for new users
      const now = new Date()
      return {
        userId,
        hourlyCount: 0,
        dailyCount: 0,
        monthlyCount: 0,
        monthlyCostUSD: 0,
        lastResetHour: this.getHourStart(now),
        lastResetDay: this.getDayStart(now),
        lastResetMonth: this.getMonthStart(now)
      }
    }

    return {
      userId: data.user_id,
      hourlyCount: data.hourly_count || 0,
      dailyCount: data.daily_count || 0,
      monthlyCount: data.monthly_count || 0,
      monthlyCostUSD: data.monthly_cost_usd || 0,
      lastResetHour: new Date(data.last_reset_hour),
      lastResetDay: new Date(data.last_reset_day),
      lastResetMonth: new Date(data.last_reset_month)
    }
  }

  /**
   * Reset counters if time periods have elapsed
   */
  private resetCountersIfNeeded(usage: SMSUsage, now: Date): SMSUsage {
    const currentHour = this.getHourStart(now)
    const currentDay = this.getDayStart(now)
    const currentMonth = this.getMonthStart(now)

    let updated = { ...usage }

    // Reset hourly counter
    if (currentHour > usage.lastResetHour) {
      updated.hourlyCount = 0
      updated.lastResetHour = currentHour
    }

    // Reset daily counter
    if (currentDay > usage.lastResetDay) {
      updated.dailyCount = 0
      updated.lastResetDay = currentDay
    }

    // Reset monthly counter and cost
    if (currentMonth > usage.lastResetMonth) {
      updated.monthlyCount = 0
      updated.monthlyCostUSD = 0
      updated.lastResetMonth = currentMonth
    }

    return updated
  }

  /**
   * Get start of current hour
   */
  private getHourStart(date: Date): Date {
    const start = new Date(date)
    start.setMinutes(0, 0, 0)
    return start
  }

  /**
   * Get start of current day
   */
  private getDayStart(date: Date): Date {
    const start = new Date(date)
    start.setHours(0, 0, 0, 0)
    return start
  }

  /**
   * Get start of current month
   */
  private getMonthStart(date: Date): Date {
    const start = new Date(date)
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
    return start
  }

  /**
   * Get usage statistics for a user (for admin/monitoring)
   */
  async getUserUsageStats(userId: string): Promise<SMSUsage | null> {
    try {
      const usage = await this.getUserUsage(userId)
      const now = new Date()
      return this.resetCountersIfNeeded(usage, now)
    } catch (error) {
      console.error('Failed to get usage stats:', error)
      return null
    }
  }
}