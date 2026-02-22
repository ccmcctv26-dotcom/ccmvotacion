import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/logo.png";

const Index = () => {
  const navigate = useNavigate();

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
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-foreground tracking-tight">
            Cooperativa Comarapa R.L.
          </h1>
          <p className="text-xl md:text-2xl lg:text-3xl text-primary font-display font-semibold">
            Elecciones 2026
          </p>
        </div>

        <motion.button
          onClick={() => navigate("/vote")}
          className="mt-8 px-16 py-6 text-xl md:text-2xl font-semibold rounded-2xl gradient-primary text-primary-foreground shadow-elevated hover:scale-105 active:scale-95 transition-transform duration-200 animate-pulse-glow"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Iniciar Votación
        </motion.button>

        <p className="text-muted-foreground text-sm mt-4">
          Toque el botón para comenzar
        </p>
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
