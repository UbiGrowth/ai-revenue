-- ============================================================
-- PHASE 3 DEPLOYMENT - COPY & PASTE INTO SUPABASE SQL EDITOR
-- ============================================================
-- Dashboard: https://supabase.com/dashboard/project/nyzgsizvtqhafoxixyrd
-- Navigate to: Database → SQL Editor → New Query
-- Copy this entire file and run it
-- ============================================================

BEGIN;

-- Step 1: Migrate data from old column to new (if exists)
DO $$
BEGIN
    -- Only migrate if target_segments column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'cmo_campaigns' 
        AND column_name = 'target_segments'
    ) THEN
        UPDATE public.cmo_campaigns
        SET target_segment_codes = target_segments
        WHERE target_segments IS NOT NULL 
          AND target_segment_codes IS NULL;
        
        RAISE NOTICE 'Migrated data from target_segments to target_segment_codes';
    END IF;
END $$;

-- Step 2: Drop duplicate column (if exists)
ALTER TABLE public.cmo_campaigns 
DROP COLUMN IF EXISTS target_segments;

-- Step 3: Ensure target_segment_codes exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'cmo_campaigns' 
        AND column_name = 'target_segment_codes'
    ) THEN
        ALTER TABLE public.cmo_campaigns 
        ADD COLUMN target_segment_codes text[] DEFAULT NULL;
        
        RAISE NOTICE 'Created target_segment_codes column';
    END IF;
END $$;

-- Step 4: Add index for performance
CREATE INDEX IF NOT EXISTS idx_cmo_campaigns_target_segment_codes 
ON public.cmo_campaigns USING GIN (target_segment_codes);

-- Step 5: Update column comment
COMMENT ON COLUMN public.cmo_campaigns.target_segment_codes IS 
'Array of segment codes to filter leads for this campaign. References tenant_segments.code. Leads are filtered WHERE segment_code = ANY(target_segment_codes).';

-- Step 6: Ensure target_tags exists and has index
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'cmo_campaigns' 
        AND column_name = 'target_tags'
    ) THEN
        ALTER TABLE public.cmo_campaigns 
        ADD COLUMN target_tags text[] DEFAULT NULL;
        
        RAISE NOTICE 'Created target_tags column';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cmo_campaigns_target_tags 
ON public.cmo_campaigns USING GIN (target_tags);

COMMENT ON COLUMN public.cmo_campaigns.target_tags IS 
'Array of lead tags to target. Campaign execution filters leads where lead.tags && campaign.target_tags';

-- Step 7: Verification
DO $$
DECLARE
    col_count INTEGER;
    tag_count INTEGER;
    seg_count INTEGER;
BEGIN
    -- Count targeting columns
    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns 
    WHERE table_name = 'cmo_campaigns' 
    AND column_name IN ('target_tags', 'target_segment_codes');
    
    IF col_count != 2 THEN
        RAISE EXCEPTION 'Expected 2 targeting columns, found %', col_count;
    END IF;
    
    -- Check for old column (should not exist)
    SELECT COUNT(*) INTO tag_count
    FROM information_schema.columns 
    WHERE table_name = 'cmo_campaigns' 
    AND column_name = 'target_segments';
    
    IF tag_count > 0 THEN
        RAISE WARNING 'Old target_segments column still exists!';
    END IF;
    
    RAISE NOTICE '✅ Migration successful! Schema verified.';
END $$;

-- Step 8: Display final schema
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'cmo_campaigns' 
AND column_name LIKE 'target_%'
ORDER BY column_name;

COMMIT;

-- ============================================================
-- SUCCESS! 
-- Expected output: 
--   target_segment_codes | ARRAY | YES
--   target_tags          | ARRAY | YES
-- 
-- Next steps:
-- 1. Deploy edge functions via Dashboard → Edge Functions
-- 2. Run smoke tests (see SMOKE_TEST.md)
-- ============================================================

