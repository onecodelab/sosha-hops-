-- Migration: Add Account Name to Bank Settings
-- Description: Adds account_name column to bank_settings for better customer visibility.

ALTER TABLE public.bank_settings ADD COLUMN IF NOT EXISTS account_name TEXT;

-- Update existing records with a placeholder if needed
UPDATE public.bank_settings SET account_name = 'Restaurant Owner' WHERE account_name IS NULL;

NOTIFY pgrst, 'reload schema';
