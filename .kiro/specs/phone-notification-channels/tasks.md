# Implementation Plan

- [x] 1. Set up core phone validation infrastructure
  - Install libphonenumber-js dependency for phone number validation
  - Create phone validation utility with normalize and format functions
  - Write unit tests for phone validation covering various formats and edge cases
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 2. Create SMS service integration with Twilio
  - Install Twilio SDK dependency
  - Create SMS service class with send and delivery validation methods
  - Implement error handling, retry logic, and rate limiting
  - Write unit tests for SMS service with mocked Twilio API
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 3. Build phone input UI component
  - Create reusable PhoneInput component with validation and formatting
  - Implement real-time validation feedback and error display
  - Add phone number formatting for better user experience
  - Write component tests for various input scenarios
  - _Requirements: 5.1, 5.2, 5.4, 5.5_

- [x] 4. Create notification channel management component
  - Build NotificationChannels component to manage email and SMS channels
  - Implement add/remove functionality for multiple notification channels
  - Add validation for duplicate phone numbers and channel limits
  - Write tests for channel management interactions
  - _Requirements: 1.5, 2.2, 2.3_

- [x] 5. Update monitor creation form for phone notifications
  - Integrate PhoneInput and NotificationChannels components into new monitor form
  - Add phone number validation to form submission logic
  - Update form state management to handle multiple notification channels
  - Implement client-side validation and Supabase insert with notification_channels JSONB
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 6. Enhance monitor editing interface for phone channels
  - Update existing monitor edit functionality to support phone number channels
  - Display current phone notification channels from Supabase monitors table
  - Allow adding and removing phone numbers with Supabase updates to notification_channels
  - Implement server-side validation for monitor updates using Supabase RLS policies
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 7. Create enhanced notification service abstraction
  - Build NotificationService class to handle both email and SMS routing
  - Implement notification payload formatting for different channel types
  - Add error handling and fallback logic for failed notifications
  - Write integration tests for notification service with both channel types
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 8. Update monitor check API to support SMS notifications
  - Modify sendNotification function to use new NotificationService
  - Add SMS message formatting with monitor details and content snippets
  - Implement proper error logging for SMS delivery failures using Supabase logging
  - Update Supabase notifications table inserts to track SMS channel notifications
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 9. Enhance notification history display for SMS
  - Update notifications page to query Supabase for SMS notifications with phone icons
  - Add channel type filtering using Supabase queries to filter by email/SMS
  - Display phone numbers in notification details (formatted for privacy)
  - Show delivery status and failure reasons from Supabase notifications table
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 10. Add environment configuration and security measures
  - Add Twilio environment variables to configuration
  - Implement secure API key management and validation
  - Add rate limiting for SMS notifications per user
  - Create cost monitoring and safeguards for SMS usage
  - _Requirements: 6.1, 6.5_

- [x] 11. Write comprehensive integration tests
  - Create end-to-end tests for monitor creation with phone notifications
  - Test monitor editing workflows with phone number management
  - Verify SMS notification delivery in monitor check flow
  - Test error scenarios and fallback behavior
  - _Requirements: All requirements validation_

- [ ] 12. Add phone number validation API endpoint
  - Create Next.js API route for real-time phone number validation
  - Implement server-side validation with Supabase client for user authentication
  - Add rate limiting using Supabase or middleware to prevent validation API abuse
  - Write API tests for validation endpoint with Supabase integration
  - _Requirements: 1.4, 5.4_