import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle } from "lucide-react";
import logo from "@/assets/logo.png";

const VotingComplete = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      sessionStorage.removeItem("hasVoted");
      navigate("/");
    }, 5000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="kiosk-fullscreen flex flex-col items-center justify-center bg-background px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="text-center flex flex-col items-center gap-8 max-w-lg"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
        >
          <CheckCircle className="w-24 h-24 text-success" strokeWidth={1.5} />
        </motion.div>

        <img src={logo} alt="Logo" className="w-20 h-20 object-contain" />

        <div className="space-y-4">
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">
            ¡Gracias por participar!
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Gracias por participar en las Elecciones 2026 de la Cooperativa Comarapa R.L.
          </p>
          <p className="text-primary font-semibold text-lg">
            Su voto ha sido registrado exitosamente.
          </p>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-4">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          Regresando a la pantalla principal...
        </div>
      </motion.div>
    </div>
  );
};

export default VotingComplete;
