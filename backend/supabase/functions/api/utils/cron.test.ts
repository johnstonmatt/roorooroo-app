/**
 * Tests for cron job management utilities
 */

import { assertEquals, assertThrows } from 'jsr:@std/assert'
import {
  intervalToCronExpression,
  generateCronJobName,
  validateCronJobConfig,
  isValidCronExpression,
  describeCronExpression,
  type CronJobConfig
} from './cron.ts'

Deno.test('intervalToCronExpression - basic intervals', () => {
  // Test minute-based intervals
  assertEquals(intervalToCronExpression(60), '* * * * *') // 1 minute
  assertEquals(intervalToCronExpression(300), '*/5 * * * *') // 5 minutes
  assertEquals(intervalToCronExpression(600), '*/10 * * * *') // 10 minutes
  assertEquals(intervalToCronExpression(1800), '*/30 * * * *') // 30 minutes
  
  // Test hour-based intervals
  assertEquals(intervalToCronExpression(3600), '0 * * * *') // 1 hour
  assertEquals(intervalToCronExpression(7200), '0 */2 * * *') // 2 hours
  assertEquals(intervalToCronExpression(21600), '0 */6 * * *') // 6 hours
  assertEquals(intervalToCronExpression(43200), '0 */12 * * *') // 12 hours
  
  // Test daily intervals
  assertEquals(intervalToCronExpression(86400), '0 0 * * *') // 24 hours (daily)
  assertEquals(intervalToCronExpression(172800), '0 0 * * *') // 48 hours (still daily)
})

Deno.test('intervalToCronExpression - edge cases', () => {
  // Test minimum interval
  assertThrows(() => intervalToCronExpression(30), Error, 'Check interval must be at least 60 seconds')
  assertThrows(() => intervalToCronExpression(-1), Error, 'Check interval must be at least 60 seconds')
  
  // Test non-divisible intervals get rounded to closest divisible
  assertEquals(intervalToCronExpression(420), '*/6 * * * *') // 7 minutes -> 6 minutes
  assertEquals(intervalToCronExpression(900), '*/15 * * * *') // 15 minutes
})

Deno.test('generateCronJobName', () => {
  const monitorId = '123e4567-e89b-12d3-a456-426614174000'
  const expected = 'monitor_check_123e4567_e89b_12d3_a456_426614174000'
  assertEquals(generateCronJobName(monitorId), expected)
})

Deno.test('validateCronJobConfig - valid config', () => {
  const validConfig: CronJobConfig = {
    monitorId: '123e4567-e89b-12d3-a456-426614174000',
    userId: '987fcdeb-51a2-43d1-9f12-123456789abc',
    checkInterval: 300
  }
  
  const errors = validateCronJobConfig(validConfig)
  assertEquals(errors.length, 0)
})

Deno.test('validateCronJobConfig - invalid configs', () => {
  // Missing monitor ID
  let config: CronJobConfig = {
    monitorId: '',
    userId: '987fcdeb-51a2-43d1-9f12-123456789abc',
    checkInterval: 300
  }
  let errors = validateCronJobConfig(config)
  assertEquals(errors.length >= 1, true)
  assertEquals(errors[0], 'Monitor ID is required and must be a string')
  
  // Invalid UUID format
  config = {
    monitorId: 'invalid-uuid',
    userId: '987fcdeb-51a2-43d1-9f12-123456789abc',
    checkInterval: 300
  }
  errors = validateCronJobConfig(config)
  assertEquals(errors.length >= 1, true)
  assertEquals(errors[0], 'Monitor ID must be a valid UUID')
  
  // Invalid check interval
  config = {
    monitorId: '123e4567-e89b-12d3-a456-426614174000',
    userId: '987fcdeb-51a2-43d1-9f12-123456789abc',
    checkInterval: 30
  }
  errors = validateCronJobConfig(config)
  assertEquals(errors.length >= 1, true)
  assertEquals(errors[0], 'Check interval must be a number and at least 60 seconds')
  
  // Check interval too large
  config = {
    monitorId: '123e4567-e89b-12d3-a456-426614174000',
    userId: '987fcdeb-51a2-43d1-9f12-123456789abc',
    checkInterval: 90000
  }
  errors = validateCronJobConfig(config)
  assertEquals(errors.length >= 1, true)
  assertEquals(errors[0], 'Check interval cannot exceed 24 hours (86400 seconds)')
})

Deno.test('isValidCronExpression', () => {
  // Valid expressions
  assertEquals(isValidCronExpression('* * * * *'), true)
  assertEquals(isValidCronExpression('*/5 * * * *'), true)
  assertEquals(isValidCronExpression('0 */2 * * *'), true)
  assertEquals(isValidCronExpression('0 0 * * *'), true)
  assertEquals(isValidCronExpression('30 14 * * 1'), true)
  
  // Invalid expressions
  assertEquals(isValidCronExpression(''), false)
  assertEquals(isValidCronExpression('* * * *'), false) // Too few fields
  assertEquals(isValidCronExpression('* * * * * *'), false) // Too many fields
  assertEquals(isValidCronExpression('60 * * * *'), false) // Invalid minute
  assertEquals(isValidCronExpression('* 25 * * *'), false) // Invalid hour
})

Deno.test('describeCronExpression', () => {
  assertEquals(describeCronExpression('* * * * *'), 'Every minute')
  assertEquals(describeCronExpression('*/5 * * * *'), 'Every 5 minutes')
  assertEquals(describeCronExpression('0 */2 * * *'), 'Every 2 hours')
  assertEquals(describeCronExpression('0 0 * * *'), 'Daily at midnight')
  assertEquals(describeCronExpression('0 * * * *'), 'Every hour')
  assertEquals(describeCronExpression('invalid'), 'Invalid cron expression')
})