/**
 * Supabase cron job management utilities
 * Handles creation, updating, and deletion of cron jobs for monitor scheduling
 */

import { createServiceClient } from './supabase.ts'

export interface CronJobConfig {
  monitorId: string
  checkInterval: number // seconds
  userId: string
}

export interface CronJobInfo {
  jobName: string
  cronExpression: string
  monitorId: string
  isActive: boolean
  lastRun?: Date
  nextRun?: Date
}

export interface CronJobResult {
  success: boolean
  jobName?: string
  error?: string
  details?: string
}

/**
 * Convert check interval in seconds to cron expression
 * @param intervalSeconds - Check interval in seconds
 * @returns Cron expression string
 */
export function intervalToCronExpression(intervalSeconds: number): string {
  // Validate input
  if (typeof intervalSeconds !== 'number' || intervalSeconds < 60) {
    throw new Error('Check interval must be at least 60 seconds')
  }

  // Convert seconds to minutes for cron expression
  const minutes = Math.floor(intervalSeconds / 60)
  
  if (minutes < 1) {
    // For intervals less than 1 minute, default to every minute
    return '* * * * *'
  } else if (minutes === 1) {
    // Every minute
    return '* * * * *'
  } else if (minutes < 60) {
    // For intervals less than 1 hour, use minute-based cron
    if (60 % minutes === 0) {
      // Use exact minute intervals if they divide evenly into an hour
      return `*/${minutes} * * * *`
    } else {
      // For non-divisible minutes, use the closest divisible interval
      const closestInterval = findClosestDivisibleInterval(minutes)
      return `*/${closestInterval} * * * *`
    }
  } else {
    // For hourly or longer intervals
    const hours = Math.floor(minutes / 60)
    if (hours === 1) {
      // Every hour
      return '0 * * * *'
    } else if (hours < 24) {
      if (24 % hours === 0) {
        // Use exact hour intervals if they divide evenly into a day
        return `0 */${hours} * * *`
      } else {
        // For non-divisible hours, use the closest divisible interval
        const closestInterval = findClosestDivisibleHourInterval(hours)
        return `0 */${closestInterval} * * *`
      }
    } else {
      // For daily or longer, run once per day at midnight
      const days = Math.floor(hours / 24)
      if (days === 1) {
        return '0 0 * * *'
      } else if (days <= 7) {
        // For weekly intervals, run once per day
        return '0 0 * * *'
      } else {
        // For longer than weekly, run once per day
        return '0 0 * * *'
      }
    }
  }
}

/**
 * Find the closest interval that divides evenly into 60 minutes
 * @param minutes - Target minutes
 * @returns Closest divisible interval
 */
function findClosestDivisibleInterval(minutes: number): number {
  const divisors = [1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30]
  let closest = 1
  let minDiff = Math.abs(minutes - 1)
  
  for (const divisor of divisors) {
    const diff = Math.abs(minutes - divisor)
    if (diff < minDiff) {
      minDiff = diff
      closest = divisor
    }
  }
  
  return closest
}

/**
 * Find the closest hour interval that divides evenly into 24 hours
 * @param hours - Target hours
 * @returns Closest divisible hour interval
 */
function findClosestDivisibleHourInterval(hours: number): number {
  const divisors = [1, 2, 3, 4, 6, 8, 12]
  let closest = 1
  let minDiff = Math.abs(hours - 1)
  
  for (const divisor of divisors) {
    const diff = Math.abs(hours - divisor)
    if (diff < minDiff) {
      minDiff = diff
      closest = divisor
    }
  }
  
  return closest
}

/**
 * Generate unique cron job name for a monitor
 * @param monitorId - Monitor UUID
 * @returns Cron job name
 */
export function generateCronJobName(monitorId: string): string {
  return `monitor_check_${monitorId.replace(/-/g, '_')}`
}

/**
 * Create a Supabase cron job for monitor checking
 * @param config - Cron job configuration
 * @returns Promise<CronJobResult> - Result with success status and details
 */
export async function createMonitorCronJob(config: CronJobConfig): Promise<CronJobResult> {
  try {
    // Validate configuration
    const validationErrors = validateCronJobConfig(config)
    if (validationErrors.length > 0) {
      return {
        success: false,
        error: 'Validation failed',
        details: validationErrors.join(', ')
      }
    }

    const supabase = createServiceClient()
    const cronExpression = intervalToCronExpression(config.checkInterval)
    const jobName = generateCronJobName(config.monitorId)
    
    // Check if job already exists
    const exists = await cronJobExists(config.monitorId)
    if (exists) {
      return {
        success: false,
        jobName,
        error: 'Cron job already exists',
        details: `Job ${jobName} already exists for monitor ${config.monitorId}`
      }
    }
    
    // Create cron job using Supabase's pg_cron extension
    const { error } = await supabase.rpc('create_monitor_cron_job', {
      job_name: jobName,
      cron_schedule: cronExpression,
      monitor_id: config.monitorId,
      user_id: config.userId
    })

    if (error) {
      console.error('Failed to create cron job:', error)
      return {
        success: false,
        jobName,
        error: 'Database error',
        details: error.message
      }
    }

    console.log(`Created cron job ${jobName} with schedule ${cronExpression}`)
    return {
      success: true,
      jobName,
      details: `Created cron job with schedule: ${cronExpression}`
    }
  } catch (error) {
    console.error('Error creating monitor cron job:', error)
    return {
      success: false,
      error: 'Unexpected error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Update an existing monitor cron job
 * @param config - Updated cron job configuration
 * @returns Promise<CronJobResult> - Result with success status and details
 */
export async function updateMonitorCronJob(config: CronJobConfig): Promise<CronJobResult> {
  try {
    // Validate configuration
    const validationErrors = validateCronJobConfig(config)
    if (validationErrors.length > 0) {
      return {
        success: false,
        error: 'Validation failed',
        details: validationErrors.join(', ')
      }
    }

    const supabase = createServiceClient()
    const cronExpression = intervalToCronExpression(config.checkInterval)
    const jobName = generateCronJobName(config.monitorId)
    
    // Check if job exists before updating
    const exists = await cronJobExists(config.monitorId)
    if (!exists) {
      return {
        success: false,
        jobName,
        error: 'Cron job not found',
        details: `Job ${jobName} does not exist for monitor ${config.monitorId}`
      }
    }
    
    // Update cron job schedule
    const { error } = await supabase.rpc('update_monitor_cron_job', {
      job_name: jobName,
      cron_schedule: cronExpression,
      monitor_id: config.monitorId
    })

    if (error) {
      console.error('Failed to update cron job:', error)
      return {
        success: false,
        jobName,
        error: 'Database error',
        details: error.message
      }
    }

    console.log(`Updated cron job ${jobName} with schedule ${cronExpression}`)
    return {
      success: true,
      jobName,
      details: `Updated cron job with schedule: ${cronExpression}`
    }
  } catch (error) {
    console.error('Error updating monitor cron job:', error)
    return {
      success: false,
      error: 'Unexpected error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Delete a monitor cron job
 * @param monitorId - Monitor UUID
 * @returns Promise<CronJobResult> - Result with success status and details
 */
export async function deleteMonitorCronJob(monitorId: string): Promise<CronJobResult> {
  try {
    if (!monitorId || typeof monitorId !== 'string') {
      return {
        success: false,
        error: 'Invalid monitor ID',
        details: 'Monitor ID is required and must be a string'
      }
    }

    const supabase = createServiceClient()
    const jobName = generateCronJobName(monitorId)
    
    // Check if job exists before deleting
    const exists = await cronJobExists(monitorId)
    if (!exists) {
      return {
        success: true, // Consider it successful if job doesn't exist
        jobName,
        details: `Cron job ${jobName} does not exist (already deleted)`
      }
    }
    
    // Delete cron job
    const { error } = await supabase.rpc('delete_monitor_cron_job', {
      job_name: jobName
    })

    if (error) {
      console.error('Failed to delete cron job:', error)
      return {
        success: false,
        jobName,
        error: 'Database error',
        details: error.message
      }
    }

    console.log(`Deleted cron job ${jobName}`)
    return {
      success: true,
      jobName,
      details: `Successfully deleted cron job ${jobName}`
    }
  } catch (error) {
    console.error('Error deleting monitor cron job:', error)
    return {
      success: false,
      error: 'Unexpected error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Check if a monitor cron job exists
 * @param monitorId - Monitor UUID
 * @returns Promise<boolean> - Whether the cron job exists
 */
export async function cronJobExists(monitorId: string): Promise<boolean> {
  try {
    const supabase = createServiceClient()
    const jobName = generateCronJobName(monitorId)
    
    const { data, error } = await supabase.rpc('check_cron_job_exists', {
      job_name: jobName
    })

    if (error) {
      console.error('Failed to check cron job existence:', error)
      return false
    }

    return data === true
  } catch (error) {
    console.error('Error checking cron job existence:', error)
    return false
  }
}

/**
 * List all monitor cron jobs for a user
 * @param userId - User UUID
 * @returns Promise<string[]> - Array of cron job names
 */
export async function listUserCronJobs(userId: string): Promise<string[]> {
  try {
    const supabase = createServiceClient()
    
    const { data, error } = await supabase.rpc('list_user_cron_jobs', {
      user_id: userId
    })

    if (error) {
      console.error('Failed to list user cron jobs:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error listing user cron jobs:', error)
    return []
  }
}

/**
 * Get detailed information about a monitor's cron job
 * @param monitorId - Monitor UUID
 * @returns Promise<CronJobInfo | null> - Cron job information or null if not found
 */
export async function getCronJobInfo(monitorId: string): Promise<CronJobInfo | null> {
  try {
    const supabase = createServiceClient()
    const jobName = generateCronJobName(monitorId)
    
    const { data, error } = await supabase.rpc('get_cron_job_info', {
      job_name: jobName
    })

    if (error) {
      console.error('Failed to get cron job info:', error)
      return null
    }

    if (!data) {
      return null
    }

    return {
      jobName,
      cronExpression: data.schedule,
      monitorId,
      isActive: data.active,
      lastRun: data.last_run ? new Date(data.last_run) : undefined,
      nextRun: data.next_run ? new Date(data.next_run) : undefined
    }
  } catch (error) {
    console.error('Error getting cron job info:', error)
    return null
  }
}

/**
 * Batch create cron jobs for multiple monitors
 * @param configs - Array of cron job configurations
 * @returns Promise<CronJobResult[]> - Array of results for each job
 */
export async function batchCreateCronJobs(configs: CronJobConfig[]): Promise<CronJobResult[]> {
  const results: CronJobResult[] = []
  
  for (const config of configs) {
    const result = await createMonitorCronJob(config)
    results.push(result)
    
    // Add a small delay between creations to avoid overwhelming the database
    if (configs.length > 1) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
  
  return results
}

/**
 * Batch delete cron jobs for multiple monitors
 * @param monitorIds - Array of monitor UUIDs
 * @returns Promise<CronJobResult[]> - Array of results for each deletion
 */
export async function batchDeleteCronJobs(monitorIds: string[]): Promise<CronJobResult[]> {
  const results: CronJobResult[] = []
  
  for (const monitorId of monitorIds) {
    const result = await deleteMonitorCronJob(monitorId)
    results.push(result)
    
    // Add a small delay between deletions
    if (monitorIds.length > 1) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
  
  return results
}

/**
 * Clean up orphaned cron jobs (jobs that exist but have no corresponding monitor)
 * @param userId - User UUID to clean up jobs for
 * @returns Promise<CronJobResult> - Cleanup result
 */
export async function cleanupOrphanedCronJobs(userId: string): Promise<CronJobResult> {
  try {
    const supabase = createServiceClient()
    
    // Get all cron jobs for the user
    const userJobs = await listUserCronJobs(userId)
    
    // Get all monitor IDs for the user
    const { data: monitors, error: monitorsError } = await supabase
      .from('monitors')
      .select('id')
      .eq('user_id', userId)
    
    if (monitorsError) {
      return {
        success: false,
        error: 'Failed to fetch monitors',
        details: monitorsError.message
      }
    }
    
    const monitorIds = new Set(monitors?.map(m => m.id) || [])
    const orphanedJobs: string[] = []
    
    // Find orphaned jobs
    for (const jobName of userJobs) {
      const monitorId = jobName.replace('monitor_check_', '').replace(/_/g, '-')
      if (!monitorIds.has(monitorId)) {
        orphanedJobs.push(jobName)
      }
    }
    
    // Delete orphaned jobs
    let deletedCount = 0
    for (const jobName of orphanedJobs) {
      const { error } = await supabase.rpc('delete_monitor_cron_job', {
        job_name: jobName
      })
      
      if (!error) {
        deletedCount++
        console.log(`Cleaned up orphaned cron job: ${jobName}`)
      }
    }
    
    return {
      success: true,
      details: `Cleaned up ${deletedCount} orphaned cron jobs out of ${orphanedJobs.length} found`
    }
  } catch (error) {
    console.error('Error cleaning up orphaned cron jobs:', error)
    return {
      success: false,
      error: 'Unexpected error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Validate cron expression format
 * @param cronExpression - Cron expression to validate
 * @returns boolean - Whether the expression is valid
 */
export function isValidCronExpression(cronExpression: string): boolean {
  // Basic validation for 5-field cron expression (minute hour day month weekday)
  const parts = cronExpression.trim().split(/\s+/)
  
  if (parts.length !== 5) {
    return false
  }
  
  const [minute, hour, day, month, weekday] = parts
  
  // Validate minute (0-59)
  if (!isValidCronField(minute, 0, 59)) return false
  
  // Validate hour (0-23)
  if (!isValidCronField(hour, 0, 23)) return false
  
  // Validate day (1-31)
  if (!isValidCronField(day, 1, 31)) return false
  
  // Validate month (1-12)
  if (!isValidCronField(month, 1, 12)) return false
  
  // Validate weekday (0-6)
  if (!isValidCronField(weekday, 0, 6)) return false
  
  return true
}

/**
 * Validate a single cron field
 * @param field - Cron field to validate
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns boolean - Whether the field is valid
 */
function isValidCronField(field: string, min: number, max: number): boolean {
  // Handle wildcard
  if (field === '*') return true
  
  // Handle step values (*/n)
  if (field.startsWith('*/')) {
    const step = parseInt(field.substring(2))
    return !isNaN(step) && step > 0 && step <= max
  }
  
  // Handle ranges (n-m)
  if (field.includes('-')) {
    const [start, end] = field.split('-').map(n => parseInt(n))
    return !isNaN(start) && !isNaN(end) && start >= min && end <= max && start <= end
  }
  
  // Handle single number
  const num = parseInt(field)
  return !isNaN(num) && num >= min && num <= max
}

/**
 * Parse cron expression to human-readable description
 * @param cronExpression - Cron expression to parse
 * @returns string - Human-readable description
 */
export function describeCronExpression(cronExpression: string): string {
  const parts = cronExpression.trim().split(/\s+/)
  if (parts.length !== 5) {
    return 'Invalid cron expression'
  }
  
  const [minute, hour, day, month, weekday] = parts
  
  // Handle common patterns
  if (cronExpression === '* * * * *') {
    return 'Every minute'
  }
  
  if (minute.startsWith('*/') && hour === '*' && day === '*' && month === '*' && weekday === '*') {
    const interval = minute.substring(2)
    return `Every ${interval} minutes`
  }
  
  if (minute === '0' && hour.startsWith('*/') && day === '*' && month === '*' && weekday === '*') {
    const interval = hour.substring(2)
    return `Every ${interval} hours`
  }
  
  if (minute === '0' && hour === '0' && day === '*' && month === '*' && weekday === '*') {
    return 'Daily at midnight'
  }
  
  if (minute === '0' && hour === '*' && day === '*' && month === '*' && weekday === '*') {
    return 'Every hour'
  }
  
  return `At ${minute} ${hour} ${day} ${month} ${weekday}`
}

/**
 * Validate cron job configuration
 * @param config - Cron job configuration to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validateCronJobConfig(config: CronJobConfig): string[] {
  const errors: string[] = []

  if (!config.monitorId || typeof config.monitorId !== 'string') {
    errors.push('Monitor ID is required and must be a string')
  } else if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(config.monitorId)) {
    errors.push('Monitor ID must be a valid UUID')
  }

  if (!config.userId || typeof config.userId !== 'string') {
    errors.push('User ID is required and must be a string')
  } else if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(config.userId)) {
    errors.push('User ID must be a valid UUID')
  }

  if (typeof config.checkInterval !== 'number' || config.checkInterval < 60) {
    errors.push('Check interval must be a number and at least 60 seconds')
  }

  if (config.checkInterval > 86400) {
    errors.push('Check interval cannot exceed 24 hours (86400 seconds)')
  }

  // Validate that the interval can be converted to a valid cron expression
  try {
    const cronExpression = intervalToCronExpression(config.checkInterval)
    if (!isValidCronExpression(cronExpression)) {
      errors.push('Check interval results in invalid cron expression')
    }
  } catch (error) {
    errors.push(`Invalid check interval: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  return errors
}