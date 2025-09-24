# Requirements Document

## Introduction

This feature will create a declarative schema representation tool that converts Supabase migration SQL scripts into a human-readable, declarative schema format. The tool will parse existing migration files and generate a structured schema document that's easier to understand and maintain than raw SQL, particularly for developers who aren't deeply familiar with SQL and PostgreSQL.

## Requirements

### Requirement 1

**User Story:** As a developer with limited SQL knowledge, I want to view my database schema in a declarative format, so that I can easily understand the structure and relationships without parsing complex SQL migration files.

#### Acceptance Criteria

1. WHEN I run the schema generator THEN the system SHALL parse all migration files in the migrations directory
2. WHEN the system processes migration files THEN it SHALL extract table definitions, columns, constraints, and relationships
3. WHEN the system generates the schema THEN it SHALL output a structured format (JSON/YAML) that clearly shows tables, fields, types, and relationships
4. WHEN the system encounters unsupported SQL constructs THEN it SHALL log warnings but continue processing other elements

### Requirement 2

**User Story:** As a developer, I want the schema generator to capture Row Level Security (RLS) policies, so that I can understand the security model without reading complex SQL policy definitions.

#### Acceptance Criteria

1. WHEN the system processes tables with RLS enabled THEN it SHALL extract and document all security policies
2. WHEN the system finds RLS policies THEN it SHALL represent them in a readable format showing the policy name, operation type, and conditions
3. WHEN the system generates the schema THEN it SHALL group policies by table for easy reference
4. WHEN policies reference other tables or functions THEN the system SHALL document these relationships

### Requirement 3

**User Story:** As a developer, I want the schema generator to document indexes and triggers, so that I can understand performance optimizations and automated behaviors without analyzing SQL.

#### Acceptance Criteria

1. WHEN the system processes CREATE INDEX statements THEN it SHALL extract index names, columns, and conditions
2. WHEN the system finds triggers THEN it SHALL document trigger names, events, and associated functions
3. WHEN the system encounters functions THEN it SHALL extract function signatures and purposes from comments
4. WHEN the system generates the schema THEN it SHALL organize indexes and triggers by their associated tables

### Requirement 4

**User Story:** As a developer, I want the schema generator to preserve comments and documentation, so that I can understand the purpose and context of database elements.

#### Acceptance Criteria

1. WHEN the system finds SQL comments THEN it SHALL extract and preserve them in the schema output
2. WHEN tables or columns have COMMENT statements THEN the system SHALL include these descriptions
3. WHEN the system generates the schema THEN it SHALL maintain the relationship between comments and their database elements
4. WHEN comments contain structured information THEN the system SHALL preserve the formatting

### Requirement 5

**User Story:** As a developer, I want the schema generator to handle complex data types and constraints, so that I can understand validation rules and data relationships clearly.

#### Acceptance Criteria

1. WHEN the system encounters JSONB columns THEN it SHALL document the column type and any default values
2. WHEN the system finds foreign key constraints THEN it SHALL clearly show the relationship between tables
3. WHEN the system processes CHECK constraints THEN it SHALL document the validation rules in readable format
4. WHEN the system finds UNIQUE constraints THEN it SHALL document uniqueness requirements

### Requirement 6

**User Story:** As a developer, I want the schema generator to be configurable, so that I can customize the output format and level of detail based on my needs.

#### Acceptance Criteria

1. WHEN I specify an output format THEN the system SHALL support both JSON and YAML formats
2. WHEN I configure detail levels THEN the system SHALL allow filtering of indexes, triggers, or policies
3. WHEN I specify migration file paths THEN the system SHALL process files from custom directories
4. WHEN I enable verbose mode THEN the system SHALL include additional metadata and processing information