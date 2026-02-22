import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import logo from "@/assets/logo.png";

const ADMIN_USER = "tclavijograndon";
const ADMIN_PASS = "tsn9682545";

const AdminLogin = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === ADMIN_USER && password === ADMIN_PASS) {
      sessionStorage.setItem("adminAuth", "true");
      navigate("/admin");
    } else {
      setError("Credenciales incorrectas");
    }
  };

  return (
    <div className="kiosk-fullscreen flex items-center justify-center bg-background px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-card rounded-2xl shadow-elevated p-8 border border-border">
          <div className="flex flex-col items-center gap-4 mb-8">
            <img src={logo} alt="Logo" className="w-16 h-16 object-contain" />
            <div className="text-center">
              <h1 className="text-2xl font-display font-bold text-card-foreground">
                Panel de Administración
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Cooperativa Comarapa R.L. – Elecciones 2026
              </p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Usuario
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError("");
                }}
                className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Ingrese su usuario"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Ingrese su contraseña"
              />
            </div>

            {error && (
              <p className="text-destructive text-sm font-medium">{error}</p>
            )}

            <button
              type="submit"
              className="w-full py-3 rounded-lg gradient-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
            >
              <Lock className="w-4 h-4" />
              Iniciar Sesión
            </button>
          </form>
        </div>

        <button
          onClick={() => navigate("/")}
          className="block mx-auto mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Volver a la pantalla principal
        </button>
      </motion.div>
    </div>
  );
};

export default AdminLogin;
