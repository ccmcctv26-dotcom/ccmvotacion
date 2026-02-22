import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart3,
  Users,
  Vote,
  Settings,
  FileText,
  LogOut,
  Plus,
  Trash2,
  Edit,
  Play,
  Square,
  Upload,
  Download,
  PieChart,
  TrendingUp,
  User,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RPieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import logo from "@/assets/logo.png";

type Tab = "dashboard" | "candidates" | "control" | "reports";

type Candidate = {
  id: string;
  full_name: string;
  photo_url: string | null;
  area: string;
  session_id: string | null;
};

type VotingSession = {
  id: string;
  total_eligible_voters: number;
  status: string;
  started_at: string | null;
  ended_at: string | null;
};

type VoteRecord = {
  id: string;
  area: string;
  candidate_id: string | null;
  is_blank: boolean;
};

const AREAS = ["Administración", "Vigilancia", "Tribunal de Honor"];
const CHART_COLORS = ["#e8740a", "#f59e0b", "#06b6d4", "#8b5cf6", "#ef4444", "#10b981", "#6366f1"];

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [session, setSession] = useState<VotingSession | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [votes, setVotes] = useState<VoteRecord[]>([]);
  const [totalVoters, setTotalVoters] = useState(100);

  // Candidate form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formArea, setFormArea] = useState(AREAS[0]);
  const [formPhoto, setFormPhoto] = useState<File | null>(null);

  useEffect(() => {
    const auth = sessionStorage.getItem("adminAuth");
    if (auth !== "true") {
      navigate("/admin/login");
      return;
    }
    fetchData();
    setupRealtime();
  }, [navigate]);

  const fetchData = async () => {
    // Get latest session
    const { data: sessions } = await supabase
      .from("voting_sessions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);

    if (sessions && sessions.length > 0) {
      setSession(sessions[0]);
      setTotalVoters(sessions[0].total_eligible_voters);

      // Get candidates
      const { data: cands } = await supabase
        .from("candidates")
        .select("*")
        .eq("session_id", sessions[0].id);
      if (cands) setCandidates(cands);

      // Get votes
      const { data: voteData } = await supabase
        .from("votes")
        .select("*")
        .eq("session_id", sessions[0].id);
      if (voteData) setVotes(voteData);
    }
  };

  const setupRealtime = () => {
    const channel = supabase
      .channel("admin-votes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "votes" }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleLogout = () => {
    sessionStorage.removeItem("adminAuth");
    navigate("/admin/login");
  };

  // Session management
  const createOrUpdateSession = async (status: "open" | "closed") => {
    if (session) {
      const updates: Record<string, unknown> = { status, total_eligible_voters: totalVoters };
      if (status === "open") updates.started_at = new Date().toISOString();
      if (status === "closed") updates.ended_at = new Date().toISOString();

      await supabase.from("voting_sessions").update(updates).eq("id", session.id);
    } else {
      await supabase.from("voting_sessions").insert({
        total_eligible_voters: totalVoters,
        status,
        started_at: status === "open" ? new Date().toISOString() : null,
      });
    }
    fetchData();
  };

  // Candidate CRUD
  const handleSaveCandidate = async () => {
    if (!formName.trim()) return;

    let photoUrl: string | null = null;

    if (formPhoto && session) {
      const ext = formPhoto.name.split(".").pop();
      const path = `${session.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("candidate-photos")
        .upload(path, formPhoto);

      if (!error) {
        const { data: urlData } = supabase.storage
          .from("candidate-photos")
          .getPublicUrl(path);
        photoUrl = urlData.publicUrl;
      }
    }

    if (editingId) {
      const updates: Record<string, unknown> = { full_name: formName, area: formArea };
      if (photoUrl) updates.photo_url = photoUrl;
      await supabase.from("candidates").update(updates).eq("id", editingId);
    } else {
      await supabase.from("candidates").insert({
        full_name: formName,
        area: formArea,
        photo_url: photoUrl,
        session_id: session?.id,
      });
    }

    resetForm();
    fetchData();
  };

  const handleDeleteCandidate = async (id: string) => {
    await supabase.from("candidates").delete().eq("id", id);
    fetchData();
  };

  const handleEditCandidate = (c: Candidate) => {
    setEditingId(c.id);
    setFormName(c.full_name);
    setFormArea(c.area);
    setShowForm(true);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormName("");
    setFormArea(AREAS[0]);
    setFormPhoto(null);
  };

  // Stats
  const uniqueVoters = new Set(votes.map((v) => v.id.slice(0, -2))).size;
  const totalVotesCast = votes.length / 3 || 0; // Each voter casts 3 votes
  const actualVoterCount = new Set(
    votes.reduce<string[]>((acc, v) => {
      // Group by voter_token - but we don't have it in the select, so count unique vote triplets
      return acc;
    }, [])
  ).size;

  // Better vote counting: group votes by area
  const getAreaResults = (area: string) => {
    const areaVotes = votes.filter((v) => v.area === area);
    const totalAreaVotes = areaVotes.length;
    const blankVotes = areaVotes.filter((v) => v.is_blank).length;

    const candidateVotes = candidates
      .filter((c) => c.area === area)
      .map((c) => ({
        name: c.full_name,
        votes: areaVotes.filter((v) => v.candidate_id === c.id).length,
        percentage:
          totalAreaVotes > 0
            ? ((areaVotes.filter((v) => v.candidate_id === c.id).length / totalAreaVotes) * 100).toFixed(1)
            : "0",
      }));

    return {
      total: totalAreaVotes,
      blank: blankVotes,
      blankPercentage: totalAreaVotes > 0 ? ((blankVotes / totalAreaVotes) * 100).toFixed(1) : "0",
      candidates: candidateVotes,
    };
  };

  const totalUniqueVoters = Math.floor(votes.length / 3);
  const participationPct = totalVoters > 0 ? ((totalUniqueVoters / totalVoters) * 100).toFixed(1) : "0";

  // Export functions
  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Cooperativa Comarapa R.L.", 14, 20);
    doc.setFontSize(14);
    doc.text("Elecciones 2026 - Resultados", 14, 30);
    doc.setFontSize(10);
    doc.text(`Fecha: ${new Date().toLocaleString()}`, 14, 38);
    doc.text(`Total Habilitados: ${totalVoters}`, 14, 44);
    doc.text(`Total Votos: ${totalUniqueVoters}`, 14, 50);
    doc.text(`Participación: ${participationPct}%`, 14, 56);

    let startY = 65;

    AREAS.forEach((area) => {
      const results = getAreaResults(area);
      doc.setFontSize(12);
      doc.text(area, 14, startY);
      startY += 5;

      const rows = results.candidates.map((c) => [c.name, c.votes.toString(), `${c.percentage}%`]);
      rows.push(["Votos en Blanco", results.blank.toString(), `${results.blankPercentage}%`]);

      autoTable(doc, {
        startY,
        head: [["Candidato", "Votos", "Porcentaje"]],
        body: rows,
        theme: "grid",
        headStyles: { fillColor: [232, 116, 10] },
      });

      startY = (doc as any).lastAutoTable.finalY + 15;
    });

    doc.save("resultados-elecciones-2026.pdf");
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    AREAS.forEach((area) => {
      const results = getAreaResults(area);
      const data = results.candidates.map((c) => ({
        Candidato: c.name,
        Votos: c.votes,
        Porcentaje: `${c.percentage}%`,
      }));
      data.push({
        Candidato: "Votos en Blanco",
        Votos: results.blank,
        Porcentaje: `${results.blankPercentage}%`,
      });

      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, area);
    });

    XLSX.writeFile(wb, "resultados-elecciones-2026.xlsx");
  };

  const tabs = [
    { id: "dashboard" as Tab, label: "Dashboard", icon: BarChart3 },
    { id: "candidates" as Tab, label: "Candidatos", icon: Users },
    { id: "control" as Tab, label: "Control", icon: Settings },
    { id: "reports" as Tab, label: "Reportes", icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border flex flex-col">
        <div className="p-6 border-b border-border flex items-center gap-3">
          <img src={logo} alt="Logo" className="w-10 h-10 object-contain" />
          <div>
            <h2 className="font-display font-bold text-sm text-card-foreground">
              Comarapa R.L.
            </h2>
            <p className="text-xs text-muted-foreground">Admin Panel</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <t.icon className="w-5 h-5" />
              {t.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-border">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <AnimatePresence mode="wait">
            {/* ===== DASHBOARD ===== */}
            {tab === "dashboard" && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div>
                  <h1 className="text-3xl font-display font-bold text-foreground">Dashboard</h1>
                  <p className="text-muted-foreground">Resumen en tiempo real de las elecciones</p>
                </div>

                {/* Stats cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    {
                      label: "Habilitados",
                      value: totalVoters,
                      icon: Users,
                      color: "text-info",
                    },
                    {
                      label: "Votos Emitidos",
                      value: totalUniqueVoters,
                      icon: Vote,
                      color: "text-primary",
                    },
                    {
                      label: "Participación",
                      value: `${participationPct}%`,
                      icon: TrendingUp,
                      color: "text-success",
                    },
                    {
                      label: "Estado",
                      value: session?.status === "open" ? "Abierta" : "Cerrada",
                      icon: Settings,
                      color: session?.status === "open" ? "text-success" : "text-destructive",
                    },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="bg-card rounded-xl border border-border p-6 shadow-card"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">{stat.label}</span>
                        <stat.icon className={`w-5 h-5 ${stat.color}`} />
                      </div>
                      <p className="text-3xl font-bold text-card-foreground">{stat.value}</p>
                    </div>
                  ))}
                </div>

                {/* Quick charts */}
                {votes.length > 0 && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {AREAS.map((area) => {
                      const results = getAreaResults(area);
                      const chartData = [
                        ...results.candidates.map((c) => ({ name: c.name, votos: c.votes })),
                        { name: "Blanco", votos: results.blank },
                      ];

                      return (
                        <div
                          key={area}
                          className="bg-card rounded-xl border border-border p-6 shadow-card"
                        >
                          <h3 className="font-display font-bold text-lg mb-4 text-card-foreground">
                            {area}
                          </h3>
                          <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                              <YAxis />
                              <Tooltip />
                              <Bar dataKey="votos" fill="hsl(25, 91%, 50%)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* ===== CANDIDATES ===== */}
            {tab === "candidates" && (
              <motion.div
                key="candidates"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-3xl font-display font-bold text-foreground">Candidatos</h1>
                    <p className="text-muted-foreground">Gestión de candidatos por área</p>
                  </div>
                  <button
                    onClick={() => {
                      resetForm();
                      setShowForm(true);
                    }}
                    disabled={!session}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg gradient-primary text-primary-foreground font-medium disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    Agregar Candidato
                  </button>
                </div>

                {!session && (
                  <div className="bg-accent/50 border border-primary/20 rounded-lg p-4 text-accent-foreground">
                    Primero debe crear una sesión de votación en la pestaña "Control".
                  </div>
                )}

                {/* Candidate form */}
                {showForm && (
                  <div className="bg-card rounded-xl border border-border p-6 shadow-card space-y-4">
                    <h3 className="font-semibold text-lg text-card-foreground">
                      {editingId ? "Editar Candidato" : "Nuevo Candidato"}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          Nombre Completo
                        </label>
                        <input
                          type="text"
                          value={formName}
                          onChange={(e) => setFormName(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          Área
                        </label>
                        <select
                          value={formArea}
                          onChange={(e) => setFormArea(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          {AREAS.map((a) => (
                            <option key={a} value={a}>
                              {a}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          Foto
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setFormPhoto(e.target.files?.[0] || null)}
                          className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveCandidate}
                        className="px-4 py-2 rounded-lg gradient-primary text-primary-foreground font-medium"
                      >
                        {editingId ? "Guardar Cambios" : "Agregar"}
                      </button>
                      <button
                        onClick={resetForm}
                        className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {/* Candidates by area */}
                {AREAS.map((area) => {
                  const areaCands = candidates.filter((c) => c.area === area);
                  if (areaCands.length === 0 && !session) return null;
                  return (
                    <div key={area}>
                      <h3 className="font-display font-bold text-lg text-foreground mb-3">
                        {area}
                      </h3>
                      {areaCands.length === 0 ? (
                        <p className="text-muted-foreground text-sm mb-4">
                          No hay candidatos registrados
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                          {areaCands.map((c) => (
                            <div
                              key={c.id}
                              className="bg-card rounded-xl border border-border p-4 shadow-card flex items-center gap-4"
                            >
                              <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-border flex-shrink-0">
                                {c.photo_url ? (
                                  <img
                                    src={c.photo_url}
                                    alt={c.full_name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full bg-muted flex items-center justify-center">
                                    <User className="w-6 h-6 text-muted-foreground" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-card-foreground truncate">
                                  {c.full_name}
                                </p>
                                <p className="text-xs text-muted-foreground">{c.area}</p>
                              </div>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleEditCandidate(c)}
                                  className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteCandidate(c.id)}
                                  className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </motion.div>
            )}

            {/* ===== CONTROL ===== */}
            {tab === "control" && (
              <motion.div
                key="control"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div>
                  <h1 className="text-3xl font-display font-bold text-foreground">
                    Control de Votación
                  </h1>
                  <p className="text-muted-foreground">
                    Administrar sesión de votación
                  </p>
                </div>

                <div className="bg-card rounded-xl border border-border p-6 shadow-card space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Total de Votantes Habilitados
                    </label>
                    <input
                      type="number"
                      value={totalVoters}
                      onChange={(e) => setTotalVoters(parseInt(e.target.value) || 0)}
                      min={0}
                      className="w-full max-w-xs px-4 py-3 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-lg"
                    />
                  </div>

                  <div className="flex items-center gap-4 pt-4 border-t border-border">
                    <div
                      className={`px-4 py-2 rounded-full text-sm font-semibold ${
                        session?.status === "open"
                          ? "bg-success/10 text-success"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {session?.status === "open" ? "● Votación Abierta" : "● Votación Cerrada"}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    {(!session || session.status === "closed") && (
                      <button
                        onClick={() => createOrUpdateSession("open")}
                        className="flex items-center gap-2 px-6 py-3 rounded-lg bg-success text-success-foreground font-semibold hover:opacity-90 transition-opacity"
                      >
                        <Play className="w-5 h-5" />
                        {session ? "Reabrir Votación" : "Crear e Iniciar Votación"}
                      </button>
                    )}

                    {session?.status === "open" && (
                      <button
                        onClick={() => createOrUpdateSession("closed")}
                        className="flex items-center gap-2 px-6 py-3 rounded-lg bg-destructive text-destructive-foreground font-semibold hover:opacity-90 transition-opacity"
                      >
                        <Square className="w-5 h-5" />
                        Cerrar Votación
                      </button>
                    )}
                  </div>

                  {session && (
                    <div className="text-sm text-muted-foreground space-y-1 pt-4 border-t border-border">
                      {session.started_at && (
                        <p>Inicio: {new Date(session.started_at).toLocaleString()}</p>
                      )}
                      {session.ended_at && (
                        <p>Fin: {new Date(session.ended_at).toLocaleString()}</p>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ===== REPORTS ===== */}
            {tab === "reports" && (
              <motion.div
                key="reports"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-3xl font-display font-bold text-foreground">Reportes</h1>
                    <p className="text-muted-foreground">
                      Resultados detallados por área
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={exportPDF}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted font-medium"
                    >
                      <Download className="w-4 h-4" />
                      PDF
                    </button>
                    <button
                      onClick={exportExcel}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted font-medium"
                    >
                      <Download className="w-4 h-4" />
                      Excel
                    </button>
                  </div>
                </div>

                {/* Summary */}
                <div className="bg-card rounded-xl border border-border p-6 shadow-card">
                  <h3 className="font-display font-bold text-lg mb-2 text-card-foreground">
                    Resumen General
                  </h3>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-foreground">{totalVoters}</p>
                      <p className="text-sm text-muted-foreground">Habilitados</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-primary">{totalUniqueVoters}</p>
                      <p className="text-sm text-muted-foreground">Votaron</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-success">{participationPct}%</p>
                      <p className="text-sm text-muted-foreground">Participación</p>
                    </div>
                  </div>
                </div>

                {/* Results per area */}
                {AREAS.map((area) => {
                  const results = getAreaResults(area);
                  const pieData = [
                    ...results.candidates.map((c) => ({
                      name: c.name,
                      value: c.votes,
                    })),
                    { name: "Blanco", value: results.blank },
                  ].filter((d) => d.value > 0);

                  const barData = [
                    ...results.candidates.map((c) => ({
                      name: c.name,
                      votos: c.votes,
                    })),
                    { name: "Blanco", votos: results.blank },
                  ];

                  return (
                    <div
                      key={area}
                      className="bg-card rounded-xl border border-border p-6 shadow-card space-y-4"
                    >
                      <h3 className="font-display font-bold text-xl text-card-foreground">
                        {area}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Total votos: {results.total}
                      </p>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Bar chart */}
                        <div>
                          <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={barData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                              <YAxis />
                              <Tooltip />
                              <Bar dataKey="votos" radius={[6, 6, 0, 0]}>
                                {barData.map((_, i) => (
                                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Pie chart */}
                        <div>
                          <ResponsiveContainer width="100%" height={250}>
                            <RPieChart>
                              <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                outerRadius={90}
                                dataKey="value"
                                label={({ name, percent }) =>
                                  `${name} ${(percent * 100).toFixed(0)}%`
                                }
                              >
                                {pieData.map((_, i) => (
                                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                            </RPieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left py-2 px-3 font-semibold text-foreground">
                                Candidato
                              </th>
                              <th className="text-right py-2 px-3 font-semibold text-foreground">
                                Votos
                              </th>
                              <th className="text-right py-2 px-3 font-semibold text-foreground">
                                Porcentaje
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {results.candidates.map((c) => (
                              <tr key={c.name} className="border-b border-border/50">
                                <td className="py-2 px-3 text-foreground">{c.name}</td>
                                <td className="py-2 px-3 text-right font-semibold text-foreground">
                                  {c.votes}
                                </td>
                                <td className="py-2 px-3 text-right text-muted-foreground">
                                  {c.percentage}%
                                </td>
                              </tr>
                            ))}
                            <tr className="bg-muted/50">
                              <td className="py-2 px-3 font-medium text-foreground">
                                Votos en Blanco
                              </td>
                              <td className="py-2 px-3 text-right font-semibold text-foreground">
                                {results.blank}
                              </td>
                              <td className="py-2 px-3 text-right text-muted-foreground">
                                {results.blankPercentage}%
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
