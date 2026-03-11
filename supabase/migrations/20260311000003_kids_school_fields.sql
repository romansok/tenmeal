-- =============================================================================
-- Migration: 20260311000003_kids_school_fields.sql
-- Description: Add school_name and school_address columns to kids table
-- =============================================================================

-- The name of the school the kid attends. Used to group or label orders
-- in the parent dashboard. Nullable — not all parents provide this upfront.
ALTER TABLE kids
  ADD COLUMN IF NOT EXISTS school_name TEXT;

-- Optional street address of the school. Useful for delivery logistics
-- or multi-campus school support in the future. Nullable.
ALTER TABLE kids
  ADD COLUMN IF NOT EXISTS school_address TEXT;
