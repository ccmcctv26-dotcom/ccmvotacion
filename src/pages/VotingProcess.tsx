import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import CandidateCard from "@/components/CandidateCard";
import BlankVoteCard from "@/components/BlankVoteCard";
import { Pause } from "lucide-react";
import logo from "@/assets/logo.png";

const AREAS = ["Administración", "Vigilancia", "Tribunal de Honor", "Comité Electoral"] as const;

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
  const [sessionStatus, setSessionStatus] = useState<string | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const [isBlankSelected, setIsBlankSelected] = useState(false);
  const [votes, setVotes] = useState<VoteSelection[]>([]);
  const [voterToken] = useState(() => crypto.randomUUID());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const { data: sessions } = await supabase
        .from("voting_sessions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1);

      if (!sessions || sessions.length === 0) {
        navigate("/");
        return;
      }

      const currentSession = sessions[0];
      if (currentSession.status !== "open") {
        setSessionStatus(currentSession.status);
        if (currentSession.status === "closed") {
          navigate("/");
          return;
        }
      } else {
        setSessionStatus("open");
      }

      setSessionId(currentSession.id);

      const { data: candidateData } = await supabase
        .from("candidates")
        .select("*")
        .eq("session_id", currentSession.id);

      if (candidateData) {
        setCandidates(candidateData);
      }
    };

    fetchData();

    // Listen for session status changes (pause/resume/close)
    const channel = supabase
      .channel("voter-session-status")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "voting_sessions" }, (payload) => {
        const newStatus = (payload.new as any).status;
        setSessionStatus(newStatus);
        if (newStatus === "closed") {
          navigate("/");
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [navigate]);

  useEffect(() => {
    const voted = sessionStorage.getItem("hasVoted");
    if (voted === "true") {
      setHasVoted(true);
      navigate("/");
    }
  }, [navigate]);

  const isPaused = sessionStatus === "paused";
  const currentArea = AREAS[step];
  const areaCandidates = candidates.filter((c) => c.area === currentArea);
  const totalSteps = AREAS.length;

  const handleSelectCandidate = (candidateId: string) => {
    if (isPaused) return;
    if (selectedCandidate === candidateId) {
      setSelectedCandidate(null);
    } else {
      setSelectedCandidate(candidateId);
      setIsBlankSelected(false);
    }
  };

  const handleSelectBlank = () => {
    if (isPaused) return;
    setIsBlankSelected(!isBlankSelected);
    setSelectedCandidate(null);
  };

  const handleNext = useCallback(() => {
    if (isPaused) return;
    if (!selectedCandidate && !isBlankSelected) return;

    const newVote: VoteSelection = {
      area: currentArea,
      candidateId: isBlankSelected ? null : selectedCandidate,
      isBlank: isBlankSelected,
    };

    const newVotes = [...votes, newVote];
    setVotes(newVotes);
    setSelectedCandidate(null);
    setIsBlankSelected(false);

    if (step < totalSteps - 1) {
      setStep(step + 1);
    } else {
      submitVotes(newVotes);
    }
  }, [selectedCandidate, isBlankSelected, currentArea, votes, step, isPaused]);

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

  const stepLabels = AREAS as unknown as string[];
  const hasSelection = selectedCandidate !== null || isBlankSelected;

  return (
    <div className="kiosk-fullscreen flex flex-col bg-background">
      {/* Header */}
      <div className="gradient-primary px-6 py-5 flex items-center gap-4 shadow-lg">
        <img src={logo} alt="Logo" className="w-12 h-12 object-contain" />
        <div>
          <h2 style={{fontFamily: "sans-serif"}} className="text-primary-foreground font-display font-bold text-xl">
            Elecciones 2026
          </h2>
          <p style={{fontFamily: "sans-serif"}} className="text-primary-foreground/80 text-base">
            Cooperativa Comarapa R.L.
          </p>
        </div>
      </div>

      {/* Paused overlay */}
      {isPaused && (
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-2xl p-12 shadow-elevated max-w-lg text-center space-y-6"
          >
            <div className="w-20 h-20 rounded-full bg-warning/10 flex items-center justify-center mx-auto">
              <Pause className="w-10 h-10 text-warning" />
            </div>
            <h2 className="text-3xl font-display font-bold text-foreground">
              Votación Pausada Temporalmente
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              El proceso de votación ha sido pausado temporalmente. Por favor espere.
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-warning animate-pulse" />
              Esperando reanudación...
            </div>
          </motion.div>
        </div>
      )}

      {!isPaused && (
        <>
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-1 py-4 px-4">
            {stepLabels.map((label, i) => (
              <div key={label} className="flex items-center gap-1">
                <div
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition-all ${
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
                  <span className="hidden md:inline text-sm">{label}</span>
                </div>
                {i < totalSteps - 1 && (
                  <div className={`w-4 h-0.5 ${i < step ? "bg-success" : "bg-border"}`} />
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
                className="w-full max-w-5xl"
              >
                <h1 className="text-3xl md:text-4xl font-display font-bold text-center text-foreground mb-2">
                  Votar por {currentArea}
                </h1>
                <p className="text-muted-foreground text-center mb-8 text-lg">
                  Seleccione un candidato o elija Voto en Blanco
                </p>

                {areaCandidates.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground text-xl">
                      No hay candidatos registrados para esta área
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
                    {areaCandidates.map((candidate) => (
                      <CandidateCard
                        key={candidate.id}
                        candidate={candidate}
                        isSelected={selectedCandidate === candidate.id}
                        onSelect={() => handleSelectCandidate(candidate.id)}
                      />
                    ))}
                    <BlankVoteCard
                      isSelected={isBlankSelected}
                      onSelect={handleSelectBlank}
                    />
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Action button */}
            <motion.button
              onClick={handleNext}
              disabled={isSubmitting || !hasSelection}
              className="mt-auto px-14 py-5 text-xl font-semibold rounded-xl gradient-primary text-primary-foreground shadow-elevated hover:scale-105 active:scale-95 transition-transform disabled:opacity-40 disabled:hover:scale-100"
              whileHover={hasSelection ? { scale: 1.03 } : {}}
              whileTap={hasSelection ? { scale: 0.97 } : {}}
            >
              {isSubmitting
                ? "Enviando..."
                : step < totalSteps - 1
                ? "Siguiente →"
                : "Finalizar Votación ✓"}
            </motion.button>
          </div>
        </>
      )}
    </div>
  );
};

export default VotingProcess;
