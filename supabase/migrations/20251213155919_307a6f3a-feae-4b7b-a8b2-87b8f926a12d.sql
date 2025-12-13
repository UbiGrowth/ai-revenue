-- Extend cmo_campaign_channels with external ad system mapping columns
ALTER TABLE cmo_campaign_channels
ADD COLUMN IF NOT EXISTS external_source text,       -- 'google_ads', 'meta', 'linkedin', 'tiktok', etc.
ADD COLUMN IF NOT EXISTS external_account_id text,   -- e.g. Google Ads CID, Meta Ad Account ID
ADD COLUMN IF NOT EXISTS external_campaign_id text,  -- platform campaign ID
ADD COLUMN IF NOT EXISTS external_adset_id text,     -- ad set / ad group ID (optional)
ADD COLUMN IF NOT EXISTS external_ad_id text,        -- creative / ad ID (optional)
ADD COLUMN IF NOT EXISTS utm_source text,
ADD COLUMN IF NOT EXISTS utm_medium text,
ADD COLUMN IF NOT EXISTS utm_campaign text,
ADD COLUMN IF NOT EXISTS is_paid boolean DEFAULT false;

-- Indexes for efficient ad platform lookups
CREATE INDEX IF NOT EXISTS idx_cmo_campaign_channels_external_source
  ON cmo_campaign_channels (external_source);

CREATE INDEX IF NOT EXISTS idx_cmo_campaign_channels_external_ids
  ON cmo_campaign_channels (external_source, external_campaign_id);

-- Comment for documentation
COMMENT ON COLUMN cmo_campaign_channels.external_source IS 'Ad platform identifier: google_ads, meta, linkedin, tiktok, etc.';
COMMENT ON COLUMN cmo_campaign_channels.is_paid IS 'True for paid channels, false for organic';