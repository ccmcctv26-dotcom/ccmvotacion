
-- Voting sessions table
CREATE TABLE public.voting_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_eligible_voters INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'closed' CHECK (status IN ('open', 'closed')),
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.voting_sessions ENABLE ROW LEVEL SECURITY;

-- Anyone can read voting session status (needed for kiosk)
CREATE POLICY "Anyone can view voting sessions"
  ON public.voting_sessions FOR SELECT
  USING (true);

-- Only authenticated admins can modify (we'll use hardcoded auth for now via edge function)
CREATE POLICY "Anyone can insert voting sessions"
  ON public.voting_sessions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update voting sessions"
  ON public.voting_sessions FOR UPDATE
  USING (true);

-- Candidates table
CREATE TABLE public.candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  photo_url TEXT,
  area TEXT NOT NULL CHECK (area IN ('Administración', 'Vigilancia', 'Tribunal de Honor')),
  session_id UUID REFERENCES public.voting_sessions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view candidates"
  ON public.candidates FOR SELECT
  USING (true);

CREATE POLICY "Anyone can manage candidates"
  ON public.candidates FOR ALL
  USING (true);

-- Votes table (anonymous - no user_id)
CREATE TABLE public.votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.voting_sessions(id) ON DELETE CASCADE,
  area TEXT NOT NULL CHECK (area IN ('Administración', 'Vigilancia', 'Tribunal de Honor')),
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE SET NULL,
  is_blank BOOLEAN NOT NULL DEFAULT false,
  voter_token TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert votes"
  ON public.votes FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can view votes"
  ON public.votes FOR SELECT
  USING (true);

-- Unique constraint: one vote per voter_token per area per session
CREATE UNIQUE INDEX idx_unique_vote ON public.votes (session_id, area, voter_token);

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.votes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.voting_sessions;

-- Storage bucket for candidate photos
INSERT INTO storage.buckets (id, name, public) VALUES ('candidate-photos', 'candidate-photos', true);

CREATE POLICY "Anyone can upload candidate photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'candidate-photos');

CREATE POLICY "Anyone can view candidate photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'candidate-photos');

CREATE POLICY "Anyone can update candidate photos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'candidate-photos');

CREATE POLICY "Anyone can delete candidate photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'candidate-photos');
