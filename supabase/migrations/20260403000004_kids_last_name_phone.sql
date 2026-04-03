-- Add last_name and phone to kids table
ALTER TABLE kids
  ADD COLUMN last_name TEXT,
  ADD COLUMN phone     TEXT;
