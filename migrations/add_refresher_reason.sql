-- Migration to add refresher_reason column to batch_events table

-- Add refresher_reason column
ALTER TABLE batch_events
ADD COLUMN refresher_reason TEXT;

-- Comment on the column to explain its purpose
COMMENT ON COLUMN batch_events.refresher_reason IS 'Reason for refresher training (e.g., "failed quiz", "failed certification")';