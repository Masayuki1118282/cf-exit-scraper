ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_sns_url text,
  ADD COLUMN IF NOT EXISTS contact_note text;
