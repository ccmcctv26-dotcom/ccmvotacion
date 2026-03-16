import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Pause } from "lucide-react";
import logo from "@/assets/logo.png";

const fontFamily = { fontFamily: "sans-serif" };

const Index = () => {
  const navigate = useNavigate();
  const [sessionStatus, setSessionStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      const { data: sessions } = await supabase
        .from("voting_sessions")
        .select("status")
        .order("created_at", { ascending: false })
        .limit(1);

      if (sessions && sessions.length > 0) {
        setSessionStatus(sessions[0].status);
      } else {
        setSessionStatus(null);
      }
      setLoading(false);
    };
    checkSession();

    const channel = supabase
      .channel("index-session")
      .on("postgres_changes", { event: "*", schema: "public", table: "voting_sessions" }, () => {
        checkSession();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const isClosed = sessionStatus === "closed";
  const isOpen = sessionStatus === "open";
  const isPaused = sessionStatus === "paused";

  return (
    <div className="kiosk-fullscreen flex flex-col items-center justify-center bg-background relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 left-0 w-96 h-96 rounded-full gradient-primary blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full gradient-primary blur-3xl translate-x-1/2 translate-y-1/2" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-center z-10 flex flex-col items-center gap-8 px-6"
      >
        <motion.img
          src={logo}
          alt="Cooperativa Comarapa R.L."
          className="w-32 h-32 md:w-40 md:h-40 object-contain"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        />

        <div className="space-y-3">
          <h1 style={fontFamily} className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-foreground tracking-tight">
            Cooperativa Comarapa R.L.
          </h1>
          <p style={fontFamily} className="text-xl md:text-2xl lg:text-3xl text-primary font-display font-semibold">
            Elecciones 2026
          </p>
        </div>

        {!loading && isClosed && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-2xl p-8 shadow-elevated max-w-lg space-y-4"
          >
            <div className="flex items-center justify-center gap-3 text-destructive">
              <AlertTriangle className="w-8 h-8" />
              <h2 className="text-2xl font-display font-bold">Votación Finalizada</h2>
            </div>
            <p className="text-muted-foreground text-lg leading-relaxed">
              El proceso de votación para las Elecciones 2026 de la Cooperativa Comarapa R.L. ha concluido.
            </p>
            <p className="text-muted-foreground text-base">
              Agradecemos su participación. Los resultados serán publicados oportunamente.
            </p>
          </motion.div>
        )}

        {!loading && isPaused && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-2xl p-8 shadow-elevated max-w-lg space-y-4"
          >
            <div className="flex items-center justify-center gap-3 text-warning">
              <Pause className="w-8 h-8" />
              <h2 className="text-2xl font-display font-bold text-foreground">Votación Pausada</h2>
            </div>
            <p className="text-muted-foreground text-lg leading-relaxed">
              El proceso de votación ha sido pausado temporalmente. Por favor espere.
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mt-2">
              <div className="w-2 h-2 rounded-full bg-warning animate-pulse" />
              Esperando reanudación...
            </div>
          </motion.div>
        )}

        {!loading && !isClosed && !isPaused && (
          <>
            <motion.button
              onClick={() => {
                if (isOpen) navigate("/vote");
              }}
              disabled={!isOpen}
              className="mt-8 px-16 py-6 text-xl md:text-2xl font-semibold rounded-2xl gradient-primary text-primary-foreground shadow-elevated hover:scale-105 active:scale-95 transition-transform duration-200 animate-pulse-glow disabled:opacity-50 disabled:hover:scale-100"
              whileHover={isOpen ? { scale: 1.05 } : {}}
              whileTap={isOpen ? { scale: 0.95 } : {}}
            >
              Iniciar Votación
            </motion.button>

            <p className="text-muted-foreground text-sm mt-4">
              {isOpen ? "Toque el botón para comenzar" : "La votación aún no ha sido habilitada"}
            </p>
          </>
        )}
      </motion.div>

      {/* Admin access - subtle link */}
      <button
        onClick={() => navigate("/admin/login")}
        className="absolute bottom-4 right-4 text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors"
      >
        Admin
      </button>
    </div>
  );
};

export default Index;
