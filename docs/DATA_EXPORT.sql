-- ============================================
-- DATA EXPORT - Lovable Cloud Database
-- Generated: 2026-01-07
-- ============================================
-- 
-- INSTRUCTIONS:
-- 1. First run docs/BACKUP_SCHEMA.sql to create tables
-- 2. Then run this file to populate data
-- 3. Note: UUIDs and timestamps are preserved from source
-- ============================================

-- Disable triggers during import for speed
SET session_replication_role = replica;

-- ============================================
-- WORKSPACES
-- ============================================
INSERT INTO workspaces (id, name, slug, owner_id, settings, demo_mode, stripe_connected, created_at, updated_at) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'UbiGrowth OS', 'ubigrowth', '00000000-0000-0000-0000-000000000000', '{"features": ["automation", "ai", "analytics"], "tier": "enterprise"}', false, false, '2025-12-03 03:31:14.834771+00', '2025-12-03 03:31:14.834771+00'),
('245f7faf-0fab-47ea-91b2-16ef6830fb8a', 'Silk', 'silk', 'c16b947a-185e-4116-bca7-3fce3a088385', '{}', false, false, '2025-12-10 22:41:48.902519+00', '2025-12-10 22:41:48.902519+00'),
('81dc2cb8-67ae-4608-9987-37ee864c87b0', 'Brain Surgery Inc', 'brain-surgery-inc', 'd93af444-8cbd-42a1-9c93-f7806b6dfda4', '{}', false, false, '2025-12-05 16:34:36.912519+00', '2025-12-10 23:47:16.251753+00'),
('b55dec7f-a940-403e-9a7e-13b6d067f7cd', 'Sesame Street', 'sesame-street', '42e61c6e-daa1-42b5-ad08-13051fc62acf', '{}', false, false, '2025-12-11 21:57:07.199552+00', '2025-12-11 21:57:07.199552+00'),
('4d120e41-2235-4392-baad-61538e200ca7', 'PlantPR', 'plantpr', '5a45dabf-dbfe-4647-8488-7554cf1a7d28', '{}', false, false, '2025-12-17 17:38:33.507439+00', '2025-12-17 17:38:33.507439+00'),
('4161ee82-be97-4fa8-9017-5c40be3ebe19', 'First Touch Soccer', 'first-touch-soccer', '248ea2ab-9633-4deb-8b61-30d75996d2a6', '{}', false, false, '2025-12-19 22:44:56.299888+00', '2025-12-19 22:44:56.299888+00'),
('ef17dc12-9912-4aef-8add-c87fc3c40b7b', 'Test Workspace', 'test-workspace', '864212c7-14e8-4856-8f7c-72ce407a72ae', '{}', false, false, '2026-01-05 22:51:34.706211+00', '2026-01-05 22:51:34.706211+00'),
('87415775-15fc-42f9-8fe4-cd7da28f0974', 'Demo Workspace', 'demo-workspace', 'db876aac-0713-4ec9-a13f-7abe2b701d8a', '{}', false, false, '2026-01-06 14:02:24.557627+00', '2026-01-06 14:02:24.557627+00')
ON CONFLICT (id) DO NOTHING;

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
('7363ecdb-11be-4860-9779-6a51d51f8acd', '4161ee82-be97-4fa8-9017-5c40be3ebe19', '248ea2ab-9633-4deb-8b61-30d75996d2a6', 'owner', '2025-12-19 22:44:56.299888+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- LEADS (Sample - first 10)
-- ============================================
INSERT INTO leads (id, workspace_id, first_name, last_name, email, phone, company, job_title, status, source, score, vertical, notes, data_mode, created_by, created_at, updated_at) VALUES
('58fcdf13-6156-498b-bf2d-70211d2506c5', '81dc2cb8-67ae-4608-9987-37ee864c87b0', 'Suzi', 'Chen', 'suzi@ubigrowth.com', '', 'UbiGrowth, Inc', '', 'new', 'user', 0, 'technology', 'Test Emails', 'live', 'd93af444-8cbd-42a1-9c93-f7806b6dfda4', '2026-01-05 14:34:02.71623+00', '2026-01-05 14:34:02.71623+00'),
('b17b1ea5-4dd1-49b0-bbbe-b1d95af6f699', '4161ee82-be97-4fa8-9017-5c40be3ebe19', 'Fjel', 'Maranan', 'fmaranan@iixglobal.com', '+65 6221 7051', 'Impact Investment Exchange', 'Associate Vice President for Training and OD', 'new', 'csv_import', 0, 'financial services', NULL, 'live', '248ea2ab-9633-4deb-8b61-30d75996d2a6', '2026-01-06 18:48:23.598842+00', '2026-01-06 18:48:23.598842+00'),
('0576457f-f803-4e95-8cab-16877e26ca0e', '4161ee82-be97-4fa8-9017-5c40be3ebe19', 'Tracy', 'Schuly', 'tschuly@its.jnj.com', '+32 14 60 21 11', 'The Janssen Pharmaceutical Companies of Johnson & Johnson', 'Associate Director, Training Strategy', 'new', 'csv_import', 0, 'pharmaceuticals', NULL, 'live', '248ea2ab-9633-4deb-8b61-30d75996d2a6', '2026-01-06 18:48:23.598842+00', '2026-01-06 18:48:23.598842+00'),
('5bda55fc-af7f-439e-9ba8-02b906a157f4', '81dc2cb8-67ae-4608-9987-37ee864c87b0', 'Test', 'User', 'bill@ubigrowth.com', '9496566842', 'Brain Surgery Inc', NULL, 'contacted', 'manual', 50, NULL, NULL, 'live', NULL, '2025-12-05 19:40:51.73301+00', '2025-12-23 01:31:28.190553+00'),
('11b9d662-aaab-4c1b-828c-2ba3b6829d0c', '4161ee82-be97-4fa8-9017-5c40be3ebe19', 'Bob', 'Dillman', 'bob.dillman@minervasurgical.com', '+1 855-646-7874', 'Minerva Surgical', 'Territory Manager, Field Sales Trainer', 'new', 'csv_import', 0, 'medical devices', NULL, 'live', '248ea2ab-9633-4deb-8b61-30d75996d2a6', '2026-01-06 18:48:23.598842+00', '2026-01-06 18:48:23.598842+00'),
('c495afa3-eb01-4e7f-9719-7343e526a073', '4161ee82-be97-4fa8-9017-5c40be3ebe19', 'Sarah', 'Draplin', 'srdr@oticon.com', '+1 855-400-9766', 'Oticon USA', 'Senior Manager, Government Services Training and Education', 'new', 'csv_import', 0, 'medical devices', NULL, 'live', '248ea2ab-9633-4deb-8b61-30d75996d2a6', '2026-01-06 18:48:23.598842+00', '2026-01-06 18:48:23.598842+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- DEALS
-- ============================================
INSERT INTO deals (id, workspace_id, lead_id, name, value, stage, status, probability, expected_close_date, actual_close_date, notes, source, data_mode, created_by, created_at, updated_at) VALUES
('7a36d1ba-6d7e-45eb-9656-83563acd8c33', 'b55dec7f-a940-403e-9a7e-13b6d067f7cd', '11df5215-6e27-4f7a-a51a-9e62670415cd', 'BrightWave Subsc. Deal', 0, 'negotiation', 'open', 75, '2025-12-24', '2025-12-20', 'Some interesting notes', 'user', 'live', '42e61c6e-daa1-42b5-ad08-13051fc62acf', '2025-12-15 16:07:15.101012+00', '2025-12-23 01:24:36.793554+00'),
('b781fd66-9a28-4118-ac37-fa3d9a725407', 'b55dec7f-a940-403e-9a7e-13b6d067f7cd', 'dfa0afc5-de65-492d-a836-0abc54e3d628', 'Embrace yourself', 1000, 'qualification', 'open', 25, '2025-12-19', NULL, NULL, 'user', 'live', '42e61c6e-daa1-42b5-ad08-13051fc62acf', '2025-12-20 01:23:06.132625+00', '2025-12-23 01:24:36.793554+00'),
('3b455844-a407-4eb8-8304-6fc724ca0728', 'b55dec7f-a940-403e-9a7e-13b6d067f7cd', '8342a9b1-c370-46bc-bdd7-4b38da8468d4', 'fdsafdsa', 50000, 'closed_lost', 'lost', 10, NULL, '2025-12-20', NULL, 'user', 'live', '42e61c6e-daa1-42b5-ad08-13051fc62acf', '2025-12-20 01:24:23.028264+00', '2025-12-23 01:24:36.793554+00'),
('e696b466-d1e2-4633-b68d-ad1390177f8a', 'b55dec7f-a940-403e-9a7e-13b6d067f7cd', 'df2ba75b-e41d-45e6-97af-023d66d5b070', 'Buying Toes for necklace', 700, 'qualification', 'open', 100, '2025-12-23', '2025-12-20', 'Winner Winner Chicken Dinner', 'user', 'live', '42e61c6e-daa1-42b5-ad08-13051fc62acf', '2025-12-20 01:21:37.780519+00', '2025-12-23 02:09:20.096075+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- CMO BRAND PROFILES
-- ============================================
INSERT INTO cmo_brand_profiles (id, workspace_id, tenant_id, brand_name, tagline, mission_statement, unique_value_proposition, industry, brand_voice, brand_tone, key_differentiators, core_values, messaging_pillars, created_at, updated_at) VALUES
('f7d516c3-ba2b-45f6-a02a-498e398e285a', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'UbiGrowth', 'Your AI Marketing Team', 'Democratize enterprise marketing capabilities for growing businesses', 'AI-powered marketing automation that thinks like a CMO', 'Marketing Technology', 'Expert yet approachable', 'Confident and data-driven', ARRAY['Full AI automation', 'Multi-tenant architecture', 'Real-time optimization'], ARRAY['Innovation', 'Simplicity', 'Results'], ARRAY['Automation', 'Intelligence', 'Growth'], '2025-12-04 03:22:01.986525+00', '2025-12-04 03:22:01.986525+00'),
('f25dd946-ae09-48ae-a813-169bc5e6f0bb', '4161ee82-be97-4fa8-9017-5c40be3ebe19', '4161ee82-be97-4fa8-9017-5c40be3ebe19', 'First Touch Coaching', 'Where Soccer Dreams Begin', 'Empowering young athletes to develop their soccer skills, confidence, and love for the game through personalized coaching and structured programs.', 'Expert youth soccer coaching with personalized attention, proven developmental curriculum, and a focus on building lifelong athletes.', 'Youth Sports / Soccer Coaching', 'Encouraging, Energetic, Supportive', 'Friendly and approachable with parents, motivating with players', ARRAY['Small group training for personalized attention', 'Age-appropriate skill development', 'Professional coaching staff', 'Flexible scheduling options'], ARRAY['Player Development', 'Fun & Engagement', 'Sportsmanship', 'Individual Growth', 'Community Building'], ARRAY[]::text[], '2025-12-06 03:03:03.685886+00', '2025-12-06 03:03:03.685886+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- BUSINESS PROFILES
-- ============================================
INSERT INTO business_profiles (id, user_id, workspace_id, business_name, business_description, industry, brand_voice, brand_tone, brand_colors, brand_fonts, content_tone, content_length, unique_selling_points, competitive_advantages, created_at, updated_at) VALUES
('8da74b3e-9cb1-4c1c-8b6c-d6afe4ee428a', 'c16b947a-185e-4116-bca7-3fce3a088385', '245f7faf-0fab-47ea-91b2-16ef6830fb8a', 'Silk', 'Silk - Information Technology', 'Information Technology', 'SILK''s brand voice is confident, intelligent, and empowering. It uses clear, direct language to convey efficiency and clarity, aiming to inspire trust and demonstrate expertise in solving complex information management problems.', 'Approachable yet authoritative', '{"accent": "#6E27F9", "primary": "#6E27F9", "secondary": "#290D59"}', '{"body": "Inter", "heading": "Inter"}', 'professional', 'medium', NULL, NULL, '2025-12-08 17:20:46.575206+00', '2025-12-17 20:07:32.603606+00'),
('ab4106ef-c639-493d-8a0e-6fc20d709a71', 'd93af444-8cbd-42a1-9c93-f7806b6dfda4', '81dc2cb8-67ae-4608-9987-37ee864c87b0', 'Brain Surgery Inc.', 'Brain Surgery Inc - Other', 'Marketing Neuroscience/Consulting', 'Expert, authoritative, and insightful, Brain Surgery Inc. uses clear and direct language to demonstrate its expertise in marketing neuroscience.', 'Approachable yet authoritative', '{"accent": "#e62817", "background": "#ffffff", "primary": "#000000", "secondary": "#0089c8", "text": "#000000"}', '{"primary": "Open Sans", "secondary": "sans-serif"}', 'professional', 'medium', NULL, NULL, '2025-12-05 15:25:11.70224+00', '2025-12-05 15:25:11.70224+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- EMAIL SEQUENCES
-- ============================================
INSERT INTO email_sequences (id, workspace_id, name, description, trigger_type, status, total_steps, enrolled_count, completed_count, created_by, created_at, updated_at) VALUES
('039d2f35-bcd2-42d5-940d-dd1e2345c21f', 'b55dec7f-a940-403e-9a7e-13b6d067f7cd', 'Nice to meet you series', 'Nice to meet you', 'new_lead', 'active', 0, 0, 0, '42e61c6e-daa1-42b5-ad08-13051fc62acf', '2025-12-11 22:13:31.974655+00', '2025-12-11 22:13:53.824033+00'),
('f868b1f6-9189-461d-99bb-167d0d2502be', 'b55dec7f-a940-403e-9a7e-13b6d067f7cd', 'Lunch series', 'time to each lunch', 'status_change', 'active', 6, 1, 0, '42e61c6e-daa1-42b5-ad08-13051fc62acf', '2025-12-19 21:55:09.800933+00', '2025-12-19 21:58:06.779269+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- TASKS
-- ============================================
INSERT INTO tasks (id, workspace_id, lead_id, deal_id, title, description, task_type, priority, status, due_date, completed_at, assigned_to, created_by, created_at, updated_at) VALUES
('350c04ed-7777-49b3-a817-aee353a295d6', 'b55dec7f-a940-403e-9a7e-13b6d067f7cd', '85cc99ba-a8a3-4451-af15-d180d0fa8736', NULL, 'Follow up with Sarah Johnson', 'Quick scheduled follow-up', 'follow_up', 'high', 'pending', '2025-12-19 22:38:07.765+00', NULL, NULL, '42e61c6e-daa1-42b5-ad08-13051fc62acf', '2025-12-19 21:38:08.310598+00', '2025-12-19 21:38:08.310598+00'),
('920be5ec-196d-4e9f-8d5a-deb0ece829c0', 'b55dec7f-a940-403e-9a7e-13b6d067f7cd', 'df2ba75b-e41d-45e6-97af-023d66d5b070', NULL, 'fda', NULL, 'follow_up', 'medium', 'completed', NULL, '2025-12-19 21:53:56.584+00', NULL, '42e61c6e-daa1-42b5-ad08-13051fc62acf', '2025-12-19 21:53:42.296506+00', '2025-12-19 21:53:56.752364+00'),
('596f3bca-5f09-40bc-9d90-4bc8ee145fc7', 'b55dec7f-a940-403e-9a7e-13b6d067f7cd', '658c9c51-6783-4510-a3fa-c4d59401bf1f', NULL, 'eat lunch', 'you must be hungry', 'meeting', 'medium', 'completed', NULL, '2025-12-19 21:53:59.376+00', NULL, '42e61c6e-daa1-42b5-ad08-13051fc62acf', '2025-12-19 21:52:48.785322+00', '2025-12-19 21:53:59.55052+00')
ON CONFLICT (id) DO NOTHING;

-- Re-enable triggers
SET session_replication_role = DEFAULT;

-- ============================================
-- NOTES:
-- ============================================
-- This export contains core data. For full export of all 100+ tables,
-- you may need to run additional queries for:
-- - assets (1000+ records)
-- - campaigns
-- - campaign_metrics
-- - email_events
-- - voice_call_records
-- - etc.
--
-- Contact your admin if you need complete data migration.
-- ============================================
