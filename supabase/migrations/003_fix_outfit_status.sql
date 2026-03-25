-- ============================================================================
-- Fix outfit status values to match mobile app types
-- ============================================================================
-- Mobile OutfitStatus: 'pending' | 'processing' | 'complete' | 'failed'
-- Old DB constraint: 'processing' | 'ready' | 'failed'
-- ============================================================================

-- Update existing 'ready' rows to 'complete'
UPDATE outfits SET status = 'complete' WHERE status = 'ready';

-- Drop old constraint and add new one
ALTER TABLE outfits DROP CONSTRAINT IF EXISTS outfits_status_check;
ALTER TABLE outfits ADD CONSTRAINT outfits_status_check
  CHECK (status IN ('pending', 'processing', 'complete', 'failed'));

-- Set default to 'pending' (captures start as pending before processing)
ALTER TABLE outfits ALTER COLUMN status SET DEFAULT 'pending';
