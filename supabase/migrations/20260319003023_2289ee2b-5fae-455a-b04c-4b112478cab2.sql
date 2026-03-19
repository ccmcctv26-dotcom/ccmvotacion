ALTER TABLE public.voting_sessions DROP CONSTRAINT IF EXISTS voting_sessions_status_check;
ALTER TABLE public.voting_sessions
ADD CONSTRAINT voting_sessions_status_check
CHECK (status IN ('open', 'paused', 'closed'));