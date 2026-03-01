
-- Allow deleting voting sessions (for clear data functionality)
CREATE POLICY "Anyone can delete voting sessions"
ON public.voting_sessions
FOR DELETE
USING (true);

-- Allow deleting votes (for clear data functionality)
CREATE POLICY "Anyone can delete votes"
ON public.votes
FOR DELETE
USING (true);

-- Allow deleting candidates (already has ALL policy but let's be explicit)
CREATE POLICY "Anyone can delete candidates"
ON public.candidates
FOR DELETE
USING (true);
