-- Safely drop existing constraint if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'crm_activities_activity_type_check'
  ) THEN
    ALTER TABLE public.crm_activities DROP CONSTRAINT crm_activities_activity_type_check;
  END IF;
END $$;

-- Add comprehensive activity_type constraint
ALTER TABLE public.crm_activities
ADD CONSTRAINT crm_activities_activity_type_check
CHECK (
  activity_type IN (
    'landing_form_submit',
    'email_sent',
    'email_open',
    'email_click',
    'email_reply',
    'email_bounce',
    'sms_sent',
    'sms_reply',
    'voice_call',
    'meeting_booked',
    'status_change',
    'note',
    'linkedin_sent',
    'linkedin_reply',
    'task_created',
    'task_completed'
  )
);

-- Add index for efficient activity_type queries
CREATE INDEX IF NOT EXISTS idx_crm_activities_type ON public.crm_activities(activity_type);

-- Add index for timeline queries (contact + lead + time)
CREATE INDEX IF NOT EXISTS idx_crm_activities_timeline ON public.crm_activities(contact_id, lead_id, created_at DESC);