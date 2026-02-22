import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import CandidateCard from "@/components/CandidateCard";
import BlankVoteModal from "@/components/BlankVoteModal";
import logo from "@/assets/logo.png";

const AREAS = ["Administración", "Vigilancia", "Tribunal de Honor"] as const;

type Candidate = {
  id: string;
  full_name: string;
  photo_url: string | null;
  area: string;
};

type VoteSelection = {
  area: string;
  candidateId: string | null;
  isBlank: boolean;
};

const VotingProcess = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const [showBlankModal, setShowBlankModal] = useState(false);
  const [votes, setVotes] = useState<VoteSelection[]>([]);
  const [voterToken] = useState(() => crypto.randomUUID());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);

  useEffect(() => {
    // Check if there's an active voting session
    const fetchData = async () => {
      const { data: sessions } = await supabase
        .from("voting_sessions")
        .select("*")
        .eq("status", "open")
        .limit(1);

      if (!sessions || sessions.length === 0) {
        navigate("/");
        return;
      }

      setSessionId(sessions[0].id);

      const { data: candidateData } = await supabase
        .from("candidates")
        .select("*")
        .eq("session_id", sessions[0].id);

      if (candidateData) {
        setCandidates(candidateData);
      }
    };

    fetchData();
  }, [navigate]);

  // Check session storage for duplicate voting prevention
  useEffect(() => {
    const voted = sessionStorage.getItem("hasVoted");
    if (voted === "true") {
      setHasVoted(true);
      navigate("/");
    }
  }, [navigate]);

  const currentArea = AREAS[step];
  const areaCandidates = candidates.filter((c) => c.area === currentArea);

  const handleNext = useCallback(() => {
    if (!selectedCandidate) {
      setShowBlankModal(true);
      return;
    }

    const newVote: VoteSelection = {
      area: currentArea,
      candidateId: selectedCandidate,
      isBlank: false,
    };

    const newVotes = [...votes, newVote];
    setVotes(newVotes);
    setSelectedCandidate(null);

    if (step < 2) {
      setStep(step + 1);
    } else {
      submitVotes(newVotes);
    }
  }, [selectedCandidate, currentArea, votes, step]);

  const handleBlankVoteConfirm = useCallback(() => {
    setShowBlankModal(false);
    const newVote: VoteSelection = {
      area: currentArea,
      candidateId: null,
      isBlank: true,
    };

    const newVotes = [...votes, newVote];
    setVotes(newVotes);
    setSelectedCandidate(null);

    if (step < 2) {
      setStep(step + 1);
    } else {
      submitVotes(newVotes);
    }
  }, [currentArea, votes, step]);

  const submitVotes = async (allVotes: VoteSelection[]) => {
    if (!sessionId || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const voteRows = allVotes.map((v) => ({
        session_id: sessionId,
        area: v.area,
        candidate_id: v.isBlank ? null : v.candidateId,
        is_blank: v.isBlank,
        voter_token: voterToken,
      }));

      const { error } = await supabase.from("votes").insert(voteRows);

      if (error) {
        console.error("Error submitting votes:", error);
        return;
      }

      sessionStorage.setItem("hasVoted", "true");
      navigate("/vote/complete");
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepLabels = ["Administración", "Vigilancia", "Tribunal de Honor"];

  return (
    <div className="kiosk-fullscreen flex flex-col bg-background">
      {/* Header */}
      <div className="gradient-primary px-6 py-4 flex items-center gap-4 shadow-lg">
        <img src={logo} alt="Logo" className="w-10 h-10 object-contain" />
        <div>
          <h2 className="text-primary-foreground font-display font-bold text-lg">
            Elecciones 2026
          </h2>
          <p className="text-primary-foreground/80 text-sm">
            Cooperativa Comarapa R.L.
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 py-4 px-6">
        {stepLabels.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                i === step
                  ? "bg-primary text-primary-foreground shadow-elevated"
                  : i < step
                  ? "bg-success text-success-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <span className="w-6 h-6 rounded-full bg-primary-foreground/20 flex items-center justify-center text-xs font-bold">
                {i < step ? "✓" : i + 1}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </div>
            {i < 2 && (
              <div className={`w-8 h-0.5 ${i < step ? "bg-success" : "bg-border"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Voting area */}
      <div className="flex-1 flex flex-col items-center px-6 pb-6 overflow-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-4xl"
          >
            <h1 className="text-2xl md:text-3xl font-display font-bold text-center text-foreground mb-2">
              Votar por {currentArea}
            </h1>
            <p className="text-muted-foreground text-center mb-6">
              Seleccione un candidato o continúe para voto en blanco
            </p>

            {areaCandidates.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground text-lg">
                  No hay candidatos registrados para esta área
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {areaCandidates.map((candidate) => (
                  <CandidateCard
                    key={candidate.id}
                    candidate={candidate}
                    isSelected={selectedCandidate === candidate.id}
                    onSelect={() =>
                      setSelectedCandidate(
                        selectedCandidate === candidate.id ? null : candidate.id
                      )
                    }
                  />
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Action button */}
        <motion.button
          onClick={handleNext}
          disabled={isSubmitting}
          className="mt-auto px-12 py-4 text-lg font-semibold rounded-xl gradient-primary text-primary-foreground shadow-elevated hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 disabled:hover:scale-100"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          {isSubmitting
            ? "Enviando..."
            : step < 2
            ? "Siguiente →"
            : "Finalizar Votación ✓"}
        </motion.button>
      </div>

      {/* Blank vote modal */}
      <BlankVoteModal
        open={showBlankModal}
        onClose={() => setShowBlankModal(false)}
        onConfirm={handleBlankVoteConfirm}
        area={currentArea}
      />
    </div>
  );
};

export default VotingProcess;
