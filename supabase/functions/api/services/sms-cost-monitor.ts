/**
 * SMS Cost Monitoring and Alerting Service
 * Tracks SMS costs and provides alerts when thresholds are exceeded
 */

import { createServiceClient } from '../utils/supabase.ts'
import { config, logger } from '../utils/config.ts'

interface CostAlert {
  userId: string
  currentCostUSD: number
  limitUSD: number
  percentageUsed: number
  alertLevel: 'warning' | 'critical' | 'exceeded'
}

interface SystemCostStats {
  totalMonthlyCostUSD: number
  totalMonthlyMessages: number
  activeUsers: number
  averageCostPerUser: number
  topUsers: Array<{
    userId: string
    costUSD: number
    messageCount: number
  }>
}

export class SMSCostMonitor {
  private readonly maxMonthlyCostUSD = 100 // Default limit, can be configured

  /**
   * Check if user is approaching cost limits
   */
  async checkUserCostAlert(userId: string): Promise<CostAlert | null> {
    try {
      const supabase = createServiceClient()
      
      const { data, error } = await supabase
        .from('sms_usage')
        .select('monthly_cost_usd, monthly_count')
        .eq('user_id', userId)
        .single()

      if (error || !data) {
        return null
      }

      const currentCost = data.monthly_cost_usd || 0
      const limit = this.maxMonthlyCostUSD
      const percentageUsed = (currentCost / limit) * 100

      // Determine alert level
      let alertLevel: CostAlert['alertLevel']
      if (percentageUsed >= 100) {
        alertLevel = 'exceeded'
      } else if (percentageUsed >= 90) {
        alertLevel = 'critical'
      } else if (percentageUsed >= 75) {
        alertLevel = 'warning'
      } else {
        return null // No alert needed
      }

      return {
        userId,
        currentCostUSD: currentCost,
        limitUSD: limit,
        percentageUsed,
        alertLevel
      }
    } catch (error) {
      logger.error('Failed to check user cost alert:', error)
      return null
    }
  }

  /**
   * Get system-wide cost statistics
   */
  async getSystemCostStats(): Promise<SystemCostStats | null> {
    try {
      const supabase = createServiceClient()
      
      const { data, error } = await supabase
        .from('sms_usage')
        .select('user_id, monthly_cost_usd, monthly_count')
        .gt('monthly_count', 0)

      if (error || !data) {
        return null
      }

      const totalMonthlyCostUSD = data.reduce((sum, row) => sum + (row.monthly_cost_usd || 0), 0)
      const totalMonthlyMessages = data.reduce((sum, row) => sum + (row.monthly_count || 0), 0)
      const activeUsers = data.length
      const averageCostPerUser = activeUsers > 0 ? totalMonthlyCostUSD / activeUsers : 0

      // Get top 10 users by cost
      const topUsers = data
        .sort((a, b) => (b.monthly_cost_usd || 0) - (a.monthly_cost_usd || 0))
        .slice(0, 10)
        .map(row => ({
          userId: row.user_id,
          costUSD: row.monthly_cost_usd || 0,
          messageCount: row.monthly_count || 0
        }))

      return {
        totalMonthlyCostUSD,
        totalMonthlyMessages,
        activeUsers,
        averageCostPerUser,
        topUsers
      }
    } catch (error) {
      logger.error('Failed to get system cost stats:', error)
      return null
    }
  }

  /**
   * Get users who have exceeded cost thresholds
   */
  async getUsersExceedingLimits(): Promise<CostAlert[]> {
    try {
      const supabase = createServiceClient()
      
      const { data, error } = await supabase
        .from('sms_usage')
        .select('user_id, monthly_cost_usd')
        .gte('monthly_cost_usd', this.maxMonthlyCostUSD * 0.75) // 75% threshold

      if (error || !data) {
        return []
      }

      const alerts: CostAlert[] = []
      
      for (const row of data) {
        const currentCost = row.monthly_cost_usd || 0
        const limit = this.maxMonthlyCostUSD
        const percentageUsed = (currentCost / limit) * 100

        let alertLevel: CostAlert['alertLevel']
        if (percentageUsed >= 100) {
          alertLevel = 'exceeded'
        } else if (percentageUsed >= 90) {
          alertLevel = 'critical'
        } else {
          alertLevel = 'warning'
        }

        alerts.push({
          userId: row.user_id,
          currentCostUSD: currentCost,
          limitUSD: limit,
          percentageUsed,
          alertLevel
        })
      }

      return alerts.sort((a, b) => b.percentageUsed - a.percentageUsed)
    } catch (error) {
      logger.error('Failed to get users exceeding limits:', error)
      return []
    }
  }

  /**
   * Log cost alert for monitoring
   */
  async logCostAlert(alert: CostAlert): Promise<void> {
    try {
      logger.warn('SMS Cost Alert:', {
        userId: alert.userId,
        alertLevel: alert.alertLevel,
        currentCost: alert.currentCostUSD,
        limit: alert.limitUSD,
        percentageUsed: alert.percentageUsed.toFixed(1) + '%'
      })

      // In production, you might want to send this to a monitoring service
      if (config.app.environment === 'production' && alert.alertLevel === 'exceeded') {
        logger.error('CRITICAL: User exceeded SMS cost limit:', alert)
      }
    } catch (error) {
      logger.error('Failed to log cost alert:', error)
    }
  }

  /**
   * Reset monthly costs (typically called by a cron job)
   */
  async resetMonthlyCosts(): Promise<{ resetCount: number; error?: string }> {
    try {
      const supabase = createServiceClient()
      
      const { data, error } = await supabase
        .from('sms_usage')
        .update({
          monthly_count: 0,
          monthly_cost_usd: 0,
          last_reset_month: new Date().toISOString()
        })
        .neq('monthly_count', 0) // Only update records that have usage
        .select('user_id')

      if (error) {
        return { resetCount: 0, error: error.message }
      }

      const resetCount = data?.length || 0
      logger.info(`Reset monthly SMS costs for ${resetCount} users`)
      
      return { resetCount }
    } catch (error) {
      logger.error('Failed to reset monthly costs:', error)
      return { 
        resetCount: 0, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Get cost projection based on current usage
   */
  async getCostProjection(userId: string): Promise<{
    currentMonthlyCost: number
    projectedMonthlyCost: number
    daysIntoMonth: number
    isOnTrackToExceedLimit: boolean
  } | null> {
    try {
      const supabase = createServiceClient()
      
      const { data, error } = await supabase
        .from('sms_usage')
        .select('monthly_cost_usd, last_reset_month')
        .eq('user_id', userId)
        .single()

      if (error || !data) {
        return null
      }

      const currentCost = data.monthly_cost_usd || 0
      const resetDate = new Date(data.last_reset_month)
      const now = new Date()
      
      // Calculate days into the month
      const daysIntoMonth = Math.max(1, Math.floor((now.getTime() - resetDate.getTime()) / (1000 * 60 * 60 * 24)))
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
      
      // Project monthly cost based on current usage rate
      const dailyRate = currentCost / daysIntoMonth
      const projectedMonthlyCost = dailyRate * daysInMonth
      
      const isOnTrackToExceedLimit = projectedMonthlyCost > this.maxMonthlyCostUSD

      return {
        currentMonthlyCost: currentCost,
        projectedMonthlyCost,
        daysIntoMonth,
        isOnTrackToExceedLimit
      }
    } catch (error) {
      logger.error('Failed to get cost projection:', error)
      return null
    }
  }
}