-- ============================================
-- SINGLE QUERY TEST - Most Basic Version
-- If this fails, we have a bigger issue
-- ============================================

-- Just count all leads (should work even with RLS)
SELECT COUNT(*) as total_leads FROM leads;

