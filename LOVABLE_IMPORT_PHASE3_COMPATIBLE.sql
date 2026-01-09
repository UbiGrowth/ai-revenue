-- ============================================
-- LOVABLE CLOUD DATA IMPORT - Phase 3 Compatible
-- Generated: 2026-01-07
-- Source: Lovable Cloud Export (schema adjusted)
-- ============================================

-- Disable triggers during import for speed
SET session_replication_role = replica;

-- ============================================
-- WORKSPACES (Core tenant data)
-- ============================================
INSERT INTO workspaces (id, name, slug, owner_id, settings, demo_mode, stripe_connected, created_at, updated_at) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'UbiGrowth OS', 'ubigrowth', '00000000-0000-0000-0000-000000000000', '{"features": ["automation", "ai", "analytics"], "tier": "enterprise"}', false, false, '2025-12-03 03:31:14.834771+00', '2025-12-03 03:31:14.834771+00'),
('245f7faf-0fab-47ea-91b2-16ef6830fb8a', 'Silk', 'silk', 'c16b947a-185e-4116-bca7-3fce3a088385', '{}', false, false, '2025-12-10 22:41:48.902519+00', '2025-12-10 22:41:48.902519+00'),
('81dc2cb8-67ae-4608-9987-37ee864c87b0', 'Brain Surgery Inc', 'brain-surgery-inc', 'd93af444-8cbd-42a1-9c93-f7806b6dfda4', '{}', false, false, '2025-12-05 16:34:36.912519+00', '2025-12-10 23:47:16.251753+00'),
('b55dec7f-a940-403e-9a7e-13b6d067f7cd', 'Sesame Street', 'sesame-street', '42e61c6e-daa1-42b5-ad08-13051fc62acf', '{}', false, false, '2025-12-11 21:57:07.199552+00', '2025-12-11 21:57:07.199552+00'),
('4d120e41-2235-4392-baad-61538e200ca7', 'PlantPR', 'plantpr', '5a45dabf-dbfe-4647-8488-7554cf1a7d28', '{}', false, false, '2025-12-17 17:38:33.507439+00', '2025-12-17 17:38:33.507439+00'),
('4161ee82-be97-4fa8-9017-5c40be3ebe19', 'First Touch Soccer', 'first-touch-soccer', '248ea2ab-9633-4deb-8b61-30d75996d2a6', '{}', false, false, '2025-12-19 22:44:56.299888+00', '2025-12-19 22:44:56.299888+00'),
('ef17dc12-9912-4aef-8add-c87fc3c40b7b', 'Test Workspace', 'test-workspace', '864212c7-14e8-4856-8f7c-72ce407a72ae', '{}', false, false, '2026-01-05 22:51:34.706211+00', '2026-01-05 22:51:34.706211+00'),
('87415775-15fc-42f9-8fe4-cd7da28f0974', 'Demo Workspace', 'demo-workspace', 'db876aac-0713-4ec9-a13f-7abe2b701d8a', '{}', false, false, '2026-01-06 14:02:24.557627+00', '2026-01-06 14:02:24.557627+00'),
('05c5ca1d-3fd6-4527-9c14-b6449acf6497', 'AutoAcquire', 'autoacquire', '00000000-0000-0000-0000-000000000001', '{}', false, false, '2025-12-26 16:20:00+00', '2025-12-26 16:20:00+00'),
('8e5cda04-2380-41f8-ade3-a04cbbec6195', 'L3 Scale Workspace', 'l3-ws-1766356410310', '248ea2ab-9633-4deb-8b61-30d75996d2a6', '{}', false, false, '2025-12-21 22:33:30.633895+00', '2025-12-21 22:33:30.633895+00')
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  settings = EXCLUDED.settings,
  updated_at = EXCLUDED.updated_at;

-- ============================================
-- WORKSPACE MEMBERS
-- ============================================
INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at) VALUES
('f4cd912a-afca-4ceb-8a31-360b78f85a9a', '81dc2cb8-67ae-4608-9987-37ee864c87b0', '9236ab25-dc46-4db9-b4e8-39d9cd017a85', 'admin', '2025-12-05 19:42:51.563165+00'),
('eed7fd5a-a3a2-47f0-9346-0c1e7b063bc4', '81dc2cb8-67ae-4608-9987-37ee864c87b0', 'd93af444-8cbd-42a1-9c93-f7806b6dfda4', 'admin', '2025-12-05 19:44:44.395164+00'),
('c24a627c-a519-4590-b1f8-5a5af679542a', '81dc2cb8-67ae-4608-9987-37ee864c87b0', 'df96e948-03b7-407a-a794-ce42bec084d8', 'admin', '2025-12-05 19:44:44.395164+00'),
('b9ed0d56-f8ea-4db2-ae48-902bcf08dda5', '81dc2cb8-67ae-4608-9987-37ee864c87b0', '73953c63-52cd-4402-a7c2-71f18212f0dc', 'admin', '2025-12-05 19:44:44.395164+00'),
('45ee7c4b-8396-475c-a73a-8c62add59b48', '81dc2cb8-67ae-4608-9987-37ee864c87b0', '248ea2ab-9633-4deb-8b61-30d75996d2a6', 'admin', '2025-12-05 19:44:44.395164+00'),
('625a73c2-ca9e-4dbe-9439-cb6f2a3cd44d', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '00000000-0000-0000-0000-000000000000', 'owner', '2025-12-19 22:44:56.299888+00'),
('0e239fab-2d93-4232-b193-582267c9fc97', 'b55dec7f-a940-403e-9a7e-13b6d067f7cd', '42e61c6e-daa1-42b5-ad08-13051fc62acf', 'owner', '2025-12-19 22:44:56.299888+00'),
('bcf44fbb-0cd6-4b2a-a361-ee1fd7f3f818', '245f7faf-0fab-47ea-91b2-16ef6830fb8a', 'c16b947a-185e-4116-bca7-3fce3a088385', 'owner', '2025-12-19 22:44:56.299888+00'),
('e99a7f25-f93c-4040-b740-f9302d834fb9', '4d120e41-2235-4392-baad-61538e200ca7', '5a45dabf-dbfe-4647-8488-7554cf1a7d28', 'owner', '2025-12-19 22:44:56.299888+00'),
('7363ecdb-11be-4860-9779-6a51d51f8acd', '4161ee82-be97-4fa8-9017-5c40be3ebe19', '248ea2ab-9633-4deb-8b61-30d75996d2a6', 'owner', '2025-12-19 22:44:56.299888+00'),
('fb06133e-59f0-4023-9900-f141e3bd7e30', 'ef17dc12-9912-4aef-8add-c87fc3c40b7b', '864212c7-14e8-4856-8f7c-72ce407a72ae', 'owner', '2026-01-05 22:51:34.706211+00'),
('87cdcdb4-3c14-4202-bce2-fdbb240f2344', '87415775-15fc-42f9-8fe4-cd7da28f0974', 'db876aac-0713-4ec9-a13f-7abe2b701d8a', 'owner', '2026-01-06 14:02:24.557627+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- CMO BRAND PROFILES (Schema-adjusted for Phase 3)
-- Note: Phase 3 schema uses different columns than Lovable
-- ============================================
INSERT INTO cmo_brand_profiles (
  id, workspace_id, brand_name, tagline, mission_statement, 
  industry, brand_voice, brand_tone, 
  core_values, created_at, updated_at
) VALUES
('f7d516c3-ba2b-45f6-a02a-498e398e285a', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 
 'UbiGrowth', 'Your AI Marketing Team', 
 'Democratize enterprise marketing capabilities for growing businesses', 
 'Marketing Technology', 'Expert yet approachable', 'Confident and data-driven', 
 '["Innovation", "Simplicity", "Results"]'::jsonb, 
 '2025-12-04 03:22:01.986525+00', '2025-12-04 03:22:01.986525+00'),
('f25dd946-ae09-48ae-a813-169bc5e6f0bb', '4161ee82-be97-4fa8-9017-5c40be3ebe19', 
 'First Touch Coaching', 'Where Soccer Dreams Begin', 
 'Empowering young athletes to develop their soccer skills, confidence, and love for the game through personalized coaching and structured programs.', 
 'Youth Sports / Soccer Coaching', 'Encouraging, Energetic, Supportive', 'Friendly and approachable with parents, motivating with players', 
 '["Player Development", "Fun & Engagement", "Sportsmanship", "Individual Growth", "Community Building"]'::jsonb, 
 '2025-12-06 03:03:03.685886+00', '2025-12-06 03:03:03.685886+00')
ON CONFLICT (id) DO UPDATE SET
  brand_name = EXCLUDED.brand_name,
  tagline = EXCLUDED.tagline,
  mission_statement = EXCLUDED.mission_statement,
  industry = EXCLUDED.industry,
  brand_voice = EXCLUDED.brand_voice,
  brand_tone = EXCLUDED.brand_tone,
  core_values = EXCLUDED.core_values,
  updated_at = EXCLUDED.updated_at;

-- ============================================
-- CMO ICP SEGMENTS (Schema-adjusted for Phase 3)
-- Note: Removed tenant_id, converted arrays to jsonb where needed
-- ============================================
INSERT INTO cmo_icp_segments (
  id, workspace_id, segment_name, segment_description, 
  is_primary, priority_score, company_size, 
  industry_verticals, job_titles, pain_points, goals, 
  preferred_channels, created_at, updated_at
) VALUES
('0c2f4b97-11ae-4135-8fcb-e47c262b04ae', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 
 'Growth-Stage CMOs', 'Marketing leaders at Series A-C startups seeking automation', 
 true, 90, '50-500 employees', 
 '["SaaS", "Fintech", "E-commerce"]'::jsonb, 
 '["CMO", "VP Marketing", "Head of Growth"]'::jsonb, 
 '["Manual campaign management", "Limited budget", "Small team"]'::jsonb, 
 '["Scale marketing output", "Improve ROI", "Automate repetitive tasks"]'::jsonb, 
 '["LinkedIn", "Email", "Webinars"]'::jsonb, 
 '2025-12-04 03:22:10.239523+00', '2025-12-04 03:22:10.239523+00'),
('ffd14eae-449b-40b0-b8bf-d1ad85d5d96d', '4161ee82-be97-4fa8-9017-5c40be3ebe19', 
 'Camp Parents', 'Parents of kids ages 6-14 looking for summer soccer camps', 
 true, 90, NULL, 
 '[]'::jsonb, '[]'::jsonb, 
 '["Finding quality summer activities for kids", "Keeping kids active and engaged", "Affordable camp options", "Flexible scheduling around work"]'::jsonb, 
 '["Kids develop soccer skills", "Children stay active during summer", "Social development through team sports", "Fun and safe environment"]'::jsonb, 
 '["email", "sms", "facebook"]'::jsonb, 
 '2025-12-06 03:03:03.685886+00', '2025-12-06 03:03:03.685886+00'),
('193a91bc-f676-4a70-b3e1-dfb6bce983c1', '4161ee82-be97-4fa8-9017-5c40be3ebe19', 
 'Private Lesson Seekers', 'Parents seeking personalized 1-on-1 or small group training for skill advancement', 
 false, 75, NULL, 
 '[]'::jsonb, '[]'::jsonb, 
 '["Kid wants to improve specific skills", "Team tryouts coming up", "Need more personalized attention", "Generic group sessions not challenging enough"]'::jsonb, 
 '["Accelerated skill development", "Make the travel/select team", "College soccer preparation", "Position-specific training"]'::jsonb, 
 '["email", "phone", "referral"]'::jsonb, 
 '2025-12-06 03:03:03.685886+00', '2025-12-06 03:03:03.685886+00')
ON CONFLICT (id) DO UPDATE SET
  segment_name = EXCLUDED.segment_name,
  segment_description = EXCLUDED.segment_description,
  is_primary = EXCLUDED.is_primary,
  priority_score = EXCLUDED.priority_score,
  updated_at = EXCLUDED.updated_at;

-- ============================================
-- CMO OFFERS (Schema-adjusted for Phase 3)
-- ============================================
INSERT INTO cmo_offers (
  id, workspace_id, offer_name, offer_type, description, 
  features, key_benefits, target_segments, 
  is_flagship, status, pricing_model, created_at, updated_at
) VALUES
('f3c254dc-d3fc-40ec-8fe2-c0129f3ac7ea', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 
 'AI CMO Pro', 'subscription', 'Full AI marketing automation suite with campaign orchestration', 
 '["90-day planning", "Funnel builder", "Content engine", "Analytics"]'::jsonb, 
 '["10x faster campaign creation", "AI-powered optimization", "Multi-channel automation"]'::jsonb, 
 '["Growth-Stage CMOs"]'::jsonb, 
 true, 'active', 'monthly_subscription', 
 '2025-12-04 03:22:13.931378+00', '2025-12-04 03:22:13.931378+00')
ON CONFLICT (id) DO UPDATE SET
  offer_name = EXCLUDED.offer_name,
  description = EXCLUDED.description,
  features = EXCLUDED.features,
  updated_at = EXCLUDED.updated_at;

-- ============================================
-- CMO FUNNELS (Schema-adjusted for Phase 3)
-- ============================================
INSERT INTO cmo_funnels (
  id, workspace_id, funnel_name, funnel_type, description, 
  target_icp_segments, target_offers, total_budget, 
  expected_conversion_rate, status, plan_id, created_at, updated_at
) VALUES
('c2fdbaf1-cc2c-4f92-8a05-86ef71bd238f', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 
 'Enterprise Lead Gen Funnel', 'lead_generation', 'Multi-stage funnel targeting growth-stage CMOs', 
 '["Growth-Stage CMOs"]'::jsonb, '["AI CMO Pro"]'::jsonb, 50000, 
 12.5, 'active', 'a517d29d-4fe5-456e-b05f-544e27032fc1', 
 '2025-12-04 03:22:28.561422+00', '2025-12-04 03:22:28.561422+00'),
('1c77ae83-9190-4737-82d6-ef6fee5e2bde', '4161ee82-be97-4fa8-9017-5c40be3ebe19', 
 'Camp Registration', 'lead_nurture', 'Nurture funnel for summer camp registrations - from inquiry to enrolled', 
 '["Camp Parents"]'::jsonb, '[]'::jsonb, 0, 
 0, 'active', NULL, 
 '2025-12-06 03:03:03.685886+00', '2025-12-06 03:03:03.685886+00'),
('a5bc5bc3-94f7-4e98-86f6-5662caf9dc56', '4161ee82-be97-4fa8-9017-5c40be3ebe19', 
 'Private Lessons', 'lead_nurture', 'Conversion funnel for private lesson inquiries to booking', 
 '["Private Lesson Seekers"]'::jsonb, '[]'::jsonb, 0, 
 0, 'active', NULL, 
 '2025-12-06 03:03:03.685886+00', '2025-12-06 03:03:03.685886+00')
ON CONFLICT (id) DO UPDATE SET
  funnel_name = EXCLUDED.funnel_name,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  updated_at = EXCLUDED.updated_at;

-- ============================================
-- CMO MARKETING PLANS
-- ============================================
INSERT INTO cmo_marketing_plans (
  id, workspace_id, plan_name, plan_type, status, 
  executive_summary, start_date, end_date, 
  primary_objectives, budget_allocation, key_metrics, 
  month_1_plan, month_2_plan, month_3_plan, created_at, updated_at
) VALUES
('a517d29d-4fe5-456e-b05f-544e27032fc1', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 
 'Q1 2025 Growth Initiative', '90-day', 'active', 
 'Drive 500 MQLs through multi-channel AI-powered campaigns', '2025-01-01', '2025-03-31', 
 '[{"metric": "mqls", "objective": "Generate 500 MQLs", "target": 500}, {"metric": "conversion_rate", "objective": "Achieve 15% conversion rate", "target": 15}]'::jsonb, 
 '{"content": 10000, "email": 15000, "events": 5000, "linkedin": 20000, "total": 50000}'::jsonb, 
 '[{"baseline": 100, "metric": "MQLs", "target": 500}, {"baseline": 150, "metric": "CAC", "target": 100}]'::jsonb, 
 '{"activities": ["Analytics setup", "Content creation", "Audience building"], "focus": "Foundation"}'::jsonb, 
 '{"activities": ["Campaign activation", "A/B testing", "Optimization"], "focus": "Launch"}'::jsonb, 
 '{"activities": ["Budget reallocation", "Winning campaign scale", "Q2 planning"], "focus": "Scale"}'::jsonb, 
 '2025-12-04 03:22:19.940367+00', '2025-12-04 03:22:19.940367+00')
ON CONFLICT (id) DO UPDATE SET
  plan_name = EXCLUDED.plan_name,
  executive_summary = EXCLUDED.executive_summary,
  status = EXCLUDED.status,
  updated_at = EXCLUDED.updated_at;

-- ============================================
-- INDUSTRY VERTICALS (Reference Data)
-- ============================================
INSERT INTO industry_verticals (id, name, aliases, created_at) VALUES
(1, 'Accounting & Finance', ARRAY['accounting', 'finance', 'financial'], '2025-12-19 22:52:05.349737+00'),
(2, 'Advertising & Marketing', ARRAY['advertising', 'marketing', 'ads', 'media buying'], '2025-12-19 22:52:05.349737+00'),
(3, 'Aerospace & Defense', ARRAY['aerospace', 'defense', 'aviation'], '2025-12-19 22:52:05.349737+00'),
(4, 'Agriculture & Farming', ARRAY['agriculture', 'farming', 'agri', 'agribusiness'], '2025-12-19 22:52:05.349737+00'),
(5, 'Automotive', ARRAY['auto', 'car', 'vehicle', 'cars'], '2025-12-19 22:52:05.349737+00'),
(6, 'Banking & Financial Services', ARRAY['banking', 'fintech', 'bank'], '2025-12-19 22:52:05.349737+00'),
(7, 'Biotechnology & Pharmaceuticals', ARRAY['biotech', 'pharma', 'pharmaceuticals'], '2025-12-19 22:52:05.349737+00'),
(8, 'Construction & Engineering', ARRAY['construction', 'engineering', 'building'], '2025-12-19 22:52:05.349737+00'),
(9, 'Consulting & Professional Services', ARRAY['consulting', 'professional services'], '2025-12-19 22:52:05.349737+00'),
(10, 'Consumer Goods & Retail', ARRAY['consumer goods', 'retail', 'cpg'], '2025-12-19 22:52:05.349737+00'),
(11, 'E-commerce', ARRAY['ecommerce', 'online retail', 'online store'], '2025-12-19 22:52:05.349737+00'),
(12, 'Education & Training', ARRAY['education', 'training', 'edtech', 'learning'], '2025-12-19 22:52:05.349737+00'),
(13, 'Energy & Utilities', ARRAY['energy', 'utilities', 'power', 'electricity'], '2025-12-19 22:52:05.349737+00'),
(14, 'Entertainment & Media', ARRAY['entertainment', 'media', 'content'], '2025-12-19 22:52:05.349737+00'),
(15, 'Environmental Services', ARRAY['environmental', 'sustainability', 'green'], '2025-12-19 22:52:05.349737+00'),
(16, 'Food & Beverage', ARRAY['food', 'beverage', 'f&b', 'restaurant'], '2025-12-19 22:52:05.349737+00'),
(17, 'Government & Public Sector', ARRAY['government', 'public sector', 'gov'], '2025-12-19 22:52:05.349737+00'),
(18, 'Healthcare & Medical', ARRAY['healthcare', 'medical', 'health', 'hospital'], '2025-12-19 22:52:05.349737+00'),
(19, 'Hospitality & Tourism', ARRAY['hospitality', 'tourism', 'hotel', 'travel'], '2025-12-19 22:52:05.349737+00'),
(20, 'Human Resources & Staffing', ARRAY['hr', 'human resources', 'staffing', 'recruiting'], '2025-12-19 22:52:05.349737+00'),
(21, 'Information Technology', ARRAY['it', 'tech', 'technology', 'software'], '2025-12-19 22:52:05.349737+00'),
(22, 'Insurance', ARRAY['insurance', 'insurtech'], '2025-12-19 22:52:05.349737+00'),
(23, 'Legal Services', ARRAY['legal', 'law', 'attorney', 'lawyer'], '2025-12-19 22:52:05.349737+00'),
(24, 'Logistics & Transportation', ARRAY['logistics', 'transportation', 'shipping'], '2025-12-19 22:52:05.349737+00'),
(25, 'Manufacturing', ARRAY['manufacturing', 'industrial', 'factory'], '2025-12-19 22:52:05.349737+00'),
(26, 'Non-Profit & NGO', ARRAY['nonprofit', 'ngo', 'charity'], '2025-12-19 22:52:05.349737+00'),
(27, 'Real Estate & Property', ARRAY['real estate', 'property', 'realty'], '2025-12-19 22:52:05.349737+00'),
(28, 'Restaurants & Food Service', ARRAY['restaurant', 'food service', 'dining'], '2025-12-19 22:52:05.349737+00'),
(29, 'SaaS & Software', ARRAY['saas', 'software', 'app'], '2025-12-19 22:52:05.349737+00'),
(30, 'Sports & Recreation', ARRAY['sports', 'recreation', 'fitness'], '2025-12-19 22:52:05.349737+00'),
(31, 'Telecommunications', ARRAY['telecom', 'telecommunications', 'telco'], '2025-12-19 22:52:05.349737+00'),
(32, 'Travel & Leisure', ARRAY['travel', 'leisure', 'vacation'], '2025-12-19 22:52:05.349737+00'),
(33, 'Other', ARRAY[]::text[], '2025-12-19 22:52:05.349737+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- EMAIL SEQUENCES
-- ============================================
INSERT INTO email_sequences (id, workspace_id, name, description, trigger_type, status, total_steps, enrolled_count, completed_count, created_by, created_at, updated_at) VALUES
('039d2f35-bcd2-42d5-940d-dd1e2345c21f', 'b55dec7f-a940-403e-9a7e-13b6d067f7cd', 'Nice to meet you series', 'Nice to meet you', 'new_lead', 'active', 0, 0, 0, '42e61c6e-daa1-42b5-ad08-13051fc62acf', '2025-12-11 22:13:31.974655+00', '2025-12-11 22:13:53.824033+00'),
('f868b1f6-9189-461d-99bb-167d0d2502be', 'b55dec7f-a940-403e-9a7e-13b6d067f7cd', 'Lunch series', 'time to each lunch', 'status_change', 'active', 6, 1, 0, '42e61c6e-daa1-42b5-ad08-13051fc62acf', '2025-12-19 21:55:09.800933+00', '2025-12-19 21:58:06.779269+00')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  updated_at = EXCLUDED.updated_at;

-- ============================================
-- EMAIL SEQUENCE STEPS
-- Note: workspace_id is derived from the parent sequence
-- ============================================
INSERT INTO email_sequence_steps (id, workspace_id, sequence_id, step_order, subject, body, delay_days, created_at, updated_at) VALUES
('08a2d026-6381-430e-a369-8ffe637c772d', 'b55dec7f-a940-403e-9a7e-13b6d067f7cd', 'f868b1f6-9189-461d-99bb-167d0d2502be', 1, 'A Quick Hello from [Your Company Name]', E'Hi A Koelink,\n\nHope you''re having a productive week.\n\nMy name is [Your Name] from [Your Company Name]. We specialize in helping businesses like yours [mention a broad, relevant benefit based on your company''s offering, even without industry info].\n\nBest regards,\n[Your Name]', 0, '2025-12-19 21:55:36.084862+00', '2025-12-19 21:55:36.084862+00'),
('1cb51371-9316-4334-ba19-a3e284f56e5e', 'b55dec7f-a940-403e-9a7e-13b6d067f7cd', 'f868b1f6-9189-461d-99bb-167d0d2502be', 2, 'A Koelink, thought this might be helpful...', E'Hi A Koelink,\n\nFollowing up on my previous email. I understand you''re busy, but I wanted to share something that might be relevant.\n\nCheers,\n[Your Name]', 3, '2025-12-19 21:55:36.28632+00', '2025-12-19 21:55:36.28632+00'),
('f5dd352f-b817-44d2-8b5b-5bd03e4a63b8', 'b55dec7f-a940-403e-9a7e-13b6d067f7cd', 'f868b1f6-9189-461d-99bb-167d0d2502be', 3, 'Quick question for you, A Koelink', E'Hi A Koelink,\n\nJust circling back one more time.\n\nBest,\n[Your Name]', 4, '2025-12-19 21:55:36.455972+00', '2025-12-19 21:55:36.455972+00'),
('ff9c4f98-69fd-4e75-820c-b6d6b12a3fd6', 'b55dec7f-a940-403e-9a7e-13b6d067f7cd', 'f868b1f6-9189-461d-99bb-167d0d2502be', 4, 'Could [Your Company Name] help with [generic problem statement]?', E'Hi A Koelink,\n\nI haven''t heard back, which is completely fine!\n\nThanks,\n[Your Name]', 5, '2025-12-19 21:55:36.622623+00', '2025-12-19 21:55:36.622623+00'),
('5f1f2cb2-5219-457e-8414-4dc3412211b8', 'b55dec7f-a940-403e-9a7e-13b6d067f7cd', 'f868b1f6-9189-461d-99bb-167d0d2502be', 5, 'Closing the loop with you, A Koelink', E'Hi A Koelink,\n\nThis will be my last email for now.\n\nSincerely,\n[Your Name]', 7, '2025-12-19 21:55:36.867973+00', '2025-12-19 21:55:36.867973+00'),
('b3069239-c547-474e-b96a-9ae6ddf97fcc', 'b55dec7f-a940-403e-9a7e-13b6d067f7cd', 'f868b1f6-9189-461d-99bb-167d0d2502be', 6, 'fdsafdsa', 'fdsfdsa', 5, '2025-12-19 21:57:20.492367+00', '2025-12-19 21:57:20.492367+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- SEQUENCE ENROLLMENTS, DEALS, TASKS
-- SKIPPED: Reference leads that don't exist in this import
-- These will be created as you work with leads in Phase 3
-- ============================================

-- ============================================
-- AI SETTINGS - EMAIL & VOICE
-- SKIPPED: Schema mismatch (tenant_id vs workspace_id)
-- Note: Phase 3 uses tenant_id (auth.users PK), Lovable uses workspace_id
-- These settings can be reconfigured manually in the UI after import
-- ============================================

-- ============================================
-- CAMPAIGN METRICS & PROSPECTS
-- SKIPPED: References non-existent campaigns/leads
-- These will be generated as campaigns are run in Phase 3
-- ============================================

-- Re-enable triggers
SET session_replication_role = DEFAULT;

-- ============================================
-- IMPORT COMPLETE
-- ============================================
-- Successfully imported:
-- ✅ 10 Workspaces
-- ✅ 12 Workspace Members
-- ✅ 2 CMO Brand Profiles
-- ✅ 3 CMO ICP Segments
-- ✅ 1 CMO Offer
-- ✅ 3 CMO Funnels
-- ✅ 1 CMO Marketing Plan
-- ✅ 33 Industry Verticals
-- ✅ 2 Email Sequences
-- ✅ 6 Email Sequence Steps
--
-- SKIPPED (Schema incompatibilities):
-- ⏭️ Sequence Enrollments (missing leads)
-- ⏭️ Deals (missing leads)
-- ⏭️ Tasks (missing leads)
-- ⏭️ AI Email/Voice Settings (tenant_id vs workspace_id mismatch)
-- ⏭️ Campaign Metrics (missing campaigns)
-- ⏭️ Prospects (reference missing tenants)
--
-- NOTE: Lovable Cloud had 100k+ leads and 1300+ assets
-- that were not included in their SQL export.
-- Use CSV export or pg_dump for complete data migration.
-- ============================================

