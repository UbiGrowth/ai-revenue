
-- Fix the status check constraint to include pending_acknowledgment
ALTER TABLE public.optimization_actions 
  DROP CONSTRAINT optimization_actions_status_check;

ALTER TABLE public.optimization_actions 
  ADD CONSTRAINT optimization_actions_status_check 
  CHECK (status = ANY (ARRAY[
    'pending'::text, 
    'pending_acknowledgment'::text,
    'scheduled'::text, 
    'executing'::text, 
    'completed'::text, 
    'aborted'::text, 
    'failed'::text
  ]));
