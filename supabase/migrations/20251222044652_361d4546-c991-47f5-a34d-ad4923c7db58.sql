-- Note: This migration skipped as required tables do not exist
-- (campaign_channel_stats_daily, channel_spend_daily, cmo_metrics_snapshots)
-- If you need these modifications, apply them manually when tables are present.

-- Drop view if it exists
DROP VIEW IF EXISTS public.v_impressions_clicks_by_workspace;
