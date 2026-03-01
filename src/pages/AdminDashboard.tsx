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
  Download,
  TrendingUp,
  User,
  Clock,
  Trophy,
  Medal,
  Award,
  AlertTriangle,
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
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  voter_token: string;
};

const AREAS = ["Administración", "Vigilancia", "Tribunal de Honor"];
const CHART_COLORS = ["#e8740a", "#f59e0b", "#06b6d4", "#8b5cf6", "#ef4444", "#10b981", "#6366f1"];

const RANK_ICONS = [Trophy, Medal, Award];
const RANK_COLORS = ["text-yellow-500", "text-gray-400", "text-amber-700"];

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [session, setSession] = useState<VotingSession | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [votes, setVotes] = useState<VoteRecord[]>([]);
  const [totalVoters, setTotalVoters] = useState(100);
  const [elapsedTime, setElapsedTime] = useState("");

  // Candidate form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formArea, setFormArea] = useState(AREAS[0]);
  const [formPhoto, setFormPhoto] = useState<File | null>(null);

  // Confirmation dialogs
  const [showOpenVotingConfirm, setShowOpenVotingConfirm] = useState(false);
  const [showClearDataConfirm, setShowClearDataConfirm] = useState(false);
  const [isClearingData, setIsClearingData] = useState(false);

  useEffect(() => {
    const auth = sessionStorage.getItem("adminAuth");
    if (auth !== "true") {
      navigate("/admin/login");
      return;
    }
    fetchData();
    setupRealtime();
  }, [navigate]);

  // Timer for elapsed voting time
  useEffect(() => {
    if (!session?.started_at || session.status !== "open") {
      setElapsedTime("");
      return;
    }
    const startTime = new Date(session.started_at).getTime();
    const updateTimer = () => {
      const now = Date.now();
      const diff = now - startTime;
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setElapsedTime(
        `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      );
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [session?.started_at, session?.status]);

  const fetchData = async () => {
    const { data: sessions } = await supabase
      .from("voting_sessions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);

    if (sessions && sessions.length > 0) {
      setSession(sessions[0]);
      setTotalVoters(sessions[0].total_eligible_voters);

      const { data: cands } = await supabase
        .from("candidates")
        .select("*")
        .eq("session_id", sessions[0].id);
      if (cands) setCandidates(cands);

      const { data: voteData } = await supabase
        .from("votes")
        .select("*")
        .eq("session_id", sessions[0].id);
      if (voteData) setVotes(voteData);
    } else {
      setSession(null);
      setCandidates([]);
      setVotes([]);
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

  const handleOpenVotingClick = () => {
    setShowOpenVotingConfirm(true);
  };

  const handleConfirmOpenVoting = () => {
    setShowOpenVotingConfirm(false);
    createOrUpdateSession("open");
  };

  const handleClearDataClick = () => {
    if (session?.status === "open") return; // Can't clear if voting is open
    setShowClearDataConfirm(true);
  };

  const handleConfirmClearData = async () => {
    setShowClearDataConfirm(false);
    if (!session) return;
    setIsClearingData(true);
    try {
      // Delete votes first (FK dependency)
      await supabase.from("votes").delete().eq("session_id", session.id);
      // Delete candidates
      await supabase.from("candidates").delete().eq("session_id", session.id);
      // Delete session
      await supabase.from("voting_sessions").delete().eq("id", session.id);
      // Reset state
      setSession(null);
      setCandidates([]);
      setVotes([]);
      setTotalVoters(100);
    } catch (err) {
      console.error("Error clearing data:", err);
    } finally {
      setIsClearingData(false);
    }
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
  const getAreaResults = (area: string) => {
    const areaVotes = votes.filter((v) => v.area === area);
    const totalAreaVotes = areaVotes.length;
    const blankVotes = areaVotes.filter((v) => v.is_blank).length;

    const candidateVotes = candidates
      .filter((c) => c.area === area)
      .map((c) => ({
        id: c.id,
        name: c.full_name,
        photo_url: c.photo_url,
        votes: areaVotes.filter((v) => v.candidate_id === c.id).length,
        percentage:
          totalAreaVotes > 0
            ? ((areaVotes.filter((v) => v.candidate_id === c.id).length / totalAreaVotes) * 100).toFixed(1)
            : "0",
      }))
      .sort((a, b) => b.votes - a.votes);

    return {
      total: totalAreaVotes,
      blank: blankVotes,
      blankPercentage: totalAreaVotes > 0 ? ((blankVotes / totalAreaVotes) * 100).toFixed(1) : "0",
      candidates: candidateVotes,
    };
  };

  const totalUniqueVoters = new Set(votes.map((v) => v.voter_token)).size;
  const participationPct = totalVoters > 0 ? ((totalUniqueVoters / totalVoters) * 100).toFixed(1) : "0";
  const remaining = Math.max(0, totalVoters - totalUniqueVoters);
  const progressPct = totalVoters > 0 ? (totalUniqueVoters / totalVoters) * 100 : 0;

  // Export functions
  const getLogoBase64 = (): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => resolve("");
      img.src = logo;
    });
  };

  const exportPDF = async () => {
    const doc = new jsPDF();
    const logoBase64 = await getLogoBase64();

    if (logoBase64) {
      doc.addImage(logoBase64, "PNG", 14, 10, 20, 20);
    }

    doc.setFontSize(18);
    doc.text("Cooperativa Comarapa R.L.", logoBase64 ? 40 : 14, 20);
    doc.setFontSize(14);
    doc.text("Elecciones 2026 - Resultados Oficiales", logoBase64 ? 40 : 14, 28);
    doc.setFontSize(10);
    doc.text(`Fecha: ${new Date().toLocaleString()}`, 14, 40);
    doc.text(`Total Habilitados: ${totalVoters}`, 14, 46);
    doc.text(`Total Votos: ${totalUniqueVoters}`, 14, 52);
    doc.text(`Participación: ${participationPct}%`, 14, 58);
    if (session?.started_at) {
      doc.text(`Inicio de votación: ${new Date(session.started_at).toLocaleString()}`, 14, 64);
    }
    if (session?.ended_at) {
      doc.text(`Fin de votación: ${new Date(session.ended_at).toLocaleString()}`, 14, 70);
    }

    let startY = session?.ended_at ? 80 : session?.started_at ? 74 : 68;

    AREAS.forEach((area) => {
      const results = getAreaResults(area);

      // Check if we need a new page
      if (startY > 240) {
        doc.addPage();
        startY = 20;
      }

      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text(area, 14, startY);
      startY += 3;

      // Show winner
      if (results.candidates.length > 0 && results.candidates[0].votes > 0) {
        doc.setFontSize(10);
        doc.setFont("helvetica", "italic");
        doc.text(`🏆 Ganador: ${results.candidates[0].name} (${results.candidates[0].votes} votos - ${results.candidates[0].percentage}%)`, 14, startY + 5);
        startY += 8;
      }

      doc.setFont("helvetica", "normal");
      startY += 2;

      const rows = results.candidates.map((c, i) => {
        const posLabel = i === 0 ? `${i + 1}° 🏆` : `${i + 1}°`;
        return [posLabel, c.name, c.votes.toString(), `${c.percentage}%`];
      });
      rows.push(["—", "Votos en Blanco", results.blank.toString(), `${results.blankPercentage}%`]);

      autoTable(doc, {
        startY,
        head: [["Posición", "Candidato", "Votos", "Porcentaje"]],
        body: rows,
        theme: "grid",
        headStyles: { fillColor: [232, 116, 10] },
        bodyStyles: { fontSize: 9 },
        didParseCell: (data) => {
          // Highlight winner row
          if (data.section === "body" && data.row.index === 0) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = [255, 243, 224];
          }
        },
      });

      startY = (doc as any).lastAutoTable.finalY + 15;
    });

    doc.save("resultados-elecciones-2026.pdf");
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summaryData = [
      ["Cooperativa Comarapa R.L."],
      ["Elecciones 2026 - Resultados Oficiales"],
      [""],
      ["Fecha", new Date().toLocaleString()],
      ["Total Habilitados", totalVoters],
      ["Total Votos", totalUniqueVoters],
      ["Participación", `${participationPct}%`],
    ];
    if (session?.started_at) summaryData.push(["Inicio", new Date(session.started_at).toLocaleString()]);
    if (session?.ended_at) summaryData.push(["Fin", new Date(session.ended_at).toLocaleString()]);

    // Add winners summary
    summaryData.push([""], ["=== GANADORES POR ÁREA ==="]);
    AREAS.forEach((area) => {
      const results = getAreaResults(area);
      if (results.candidates.length > 0 && results.candidates[0].votes > 0) {
        summaryData.push([`${area}`, `${results.candidates[0].name} (${results.candidates[0].votes} votos - ${results.candidates[0].percentage}%)`]);
      } else {
        summaryData.push([`${area}`, "Sin votos"]);
      }
    });

    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, "Resumen");

    AREAS.forEach((area) => {
      const results = getAreaResults(area);
      const data = results.candidates.map((c, i) => ({
        "Posición": `${i + 1}°${i === 0 ? " 🏆 GANADOR" : ""}`,
        "Candidato": c.name,
        "Votos": c.votes,
        "Porcentaje": `${c.percentage}%`,
      }));
      data.push({
        "Posición": "—",
        "Candidato": "Votos en Blanco",
        "Votos": results.blank,
        "Porcentaje": `${results.blankPercentage}%`,
      });

      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, area);
    });

    XLSX.writeFile(wb, "resultados-elecciones-2026.xlsx");
  };

  // Custom pie label renderer
  const renderPieLabel = ({ name, percent, x, y, midAngle }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = 120;
    const cx2 = x + (midAngle > 90 && midAngle < 270 ? -10 : 10);
    return (
      <text
        x={cx2}
        y={y}
        fill="hsl(var(--foreground))"
        textAnchor={midAngle > 90 && midAngle < 270 ? "end" : "start"}
        dominantBaseline="central"
        fontSize={11}
      >
        {`${name} ${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  const tabs = [
    { id: "dashboard" as Tab, label: "Dashboard", icon: BarChart3 },
    { id: "candidates" as Tab, label: "Candidatos", icon: Users },
    { id: "control" as Tab, label: "Control", icon: Settings },
    { id: "reports" as Tab, label: "Reportes", icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar - Fixed */}
      <aside className="w-64 bg-card border-r border-border flex flex-col fixed top-0 left-0 h-screen z-30">
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

      {/* Main content - offset by sidebar width */}
      <main className="flex-1 ml-64 overflow-auto">
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
                    { label: "Habilitados", value: totalVoters, icon: Users, color: "text-info" },
                    { label: "Ya Votaron", value: totalUniqueVoters, icon: Vote, color: "text-primary" },
                    { label: "Faltan", value: remaining, icon: TrendingUp, color: "text-warning" },
                    {
                      label: "Estado",
                      value: session?.status === "open" ? "Abierta" : "Cerrada",
                      icon: Settings,
                      color: session?.status === "open" ? "text-success" : "text-destructive",
                    },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-card rounded-xl border border-border p-6 shadow-card">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">{stat.label}</span>
                        <stat.icon className={`w-5 h-5 ${stat.color}`} />
                      </div>
                      <p className="text-3xl font-bold text-card-foreground">{stat.value}</p>
                    </div>
                  ))}
                </div>

                {/* Voting info: time + progress */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-card rounded-xl border border-border p-6 shadow-card space-y-4">
                    <div className="flex items-center gap-2 text-card-foreground">
                      <Clock className="w-5 h-5 text-primary" />
                      <h3 className="font-display font-bold text-lg">Tiempo de Votación</h3>
                    </div>
                    {session?.started_at ? (
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm text-muted-foreground">Inicio</p>
                          <p className="text-foreground font-semibold">
                            {new Date(session.started_at).toLocaleString()}
                          </p>
                        </div>
                        {session.status === "open" && elapsedTime && (
                          <div>
                            <p className="text-sm text-muted-foreground">Tiempo transcurrido</p>
                            <p className="text-4xl font-bold text-primary font-mono tracking-wider">
                              {elapsedTime}
                            </p>
                          </div>
                        )}
                        {session.ended_at && (
                          <div>
                            <p className="text-sm text-muted-foreground">Finalización</p>
                            <p className="text-foreground font-semibold">
                              {new Date(session.ended_at).toLocaleString()}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">La votación aún no ha iniciado</p>
                    )}
                  </div>

                  <div className="bg-card rounded-xl border border-border p-6 shadow-card space-y-4">
                    <div className="flex items-center gap-2 text-card-foreground">
                      <TrendingUp className="w-5 h-5 text-primary" />
                      <h3 className="font-display font-bold text-lg">Progreso de Participación</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Participación</span>
                        <span className="font-bold text-foreground">{participationPct}%</span>
                      </div>
                      <Progress value={progressPct} className="h-4" />
                      <div className="flex justify-between text-sm">
                        <span className="text-success font-medium">
                          ✓ {totalUniqueVoters} votaron
                        </span>
                        <span className="text-muted-foreground">
                          {remaining} pendientes
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rankings per area */}
                <div className="space-y-4">
                  <h2 className="text-xl font-display font-bold text-foreground">Posiciones por Área</h2>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {AREAS.map((area) => {
                      const results = getAreaResults(area);
                      return (
                        <div key={area} className="bg-card rounded-xl border border-border p-6 shadow-card">
                          <h3 className="font-display font-bold text-lg mb-4 text-card-foreground border-b border-border pb-3">
                            {area}
                          </h3>
                          {results.candidates.length === 0 ? (
                            <p className="text-muted-foreground text-sm">Sin candidatos</p>
                          ) : (
                            <div className="space-y-3">
                              {results.candidates.map((c, i) => {
                                const RankIcon = RANK_ICONS[i] || Award;
                                const rankColor = RANK_COLORS[i] || "text-muted-foreground";
                                return (
                                  <div
                                    key={c.id}
                                    className={`flex items-center gap-3 p-3 rounded-lg ${
                                      i === 0 ? "bg-accent/50 border border-primary/20" : "bg-muted/30"
                                    }`}
                                  >
                                    <RankIcon className={`w-5 h-5 flex-shrink-0 ${rankColor}`} />
                                    <div className="w-8 h-8 rounded-full overflow-hidden border border-border flex-shrink-0">
                                      {c.photo_url ? (
                                        <img src={c.photo_url} alt={c.name} className="w-full h-full object-cover" />
                                      ) : (
                                        <div className="w-full h-full bg-muted flex items-center justify-center">
                                          <User className="w-4 h-4 text-muted-foreground" />
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-semibold text-sm text-card-foreground truncate">
                                        {c.name}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {c.votes} votos · {c.percentage}%
                                      </p>
                                    </div>
                                    <span className="text-lg font-bold text-foreground">{i + 1}°</span>
                                  </div>
                                );
                              })}
                              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border-t border-border">
                                <span className="text-xs text-muted-foreground ml-8">
                                  Votos en blanco: {results.blank} ({results.blankPercentage}%)
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
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
                    onClick={() => { resetForm(); setShowForm(true); }}
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

                {showForm && (
                  <div className="bg-card rounded-xl border border-border p-6 shadow-card space-y-4">
                    <h3 className="font-semibold text-lg text-card-foreground">
                      {editingId ? "Editar Candidato" : "Nuevo Candidato"}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Nombre Completo</label>
                        <input
                          type="text"
                          value={formName}
                          onChange={(e) => setFormName(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Área</label>
                        <select
                          value={formArea}
                          onChange={(e) => setFormArea(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          {AREAS.map((a) => (
                            <option key={a} value={a}>{a}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Foto</label>
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
                      <button onClick={resetForm} className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted">
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {AREAS.map((area) => {
                  const areaCands = candidates.filter((c) => c.area === area);
                  if (areaCands.length === 0 && !session) return null;
                  return (
                    <div key={area}>
                      <h3 className="font-display font-bold text-lg text-foreground mb-3">{area}</h3>
                      {areaCands.length === 0 ? (
                        <p className="text-muted-foreground text-sm mb-4">No hay candidatos registrados</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                          {areaCands.map((c) => (
                            <div key={c.id} className="bg-card rounded-xl border border-border p-4 shadow-card flex items-center gap-4">
                              <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-border flex-shrink-0">
                                {c.photo_url ? (
                                  <img src={c.photo_url} alt={c.full_name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full bg-muted flex items-center justify-center">
                                    <User className="w-6 h-6 text-muted-foreground" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-card-foreground truncate">{c.full_name}</p>
                                <p className="text-xs text-muted-foreground">{c.area}</p>
                              </div>
                              <div className="flex gap-1">
                                <button onClick={() => handleEditCandidate(c)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground">
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDeleteCandidate(c.id)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
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
                  <h1 className="text-3xl font-display font-bold text-foreground">Control de Votación</h1>
                  <p className="text-muted-foreground">Administrar sesión de votación</p>
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
                    <div className={`px-4 py-2 rounded-full text-sm font-semibold ${
                      session?.status === "open" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                    }`}>
                      {session?.status === "open" ? "● Votación Abierta" : "● Votación Cerrada"}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    {(!session || session.status === "closed") && (
                      <button
                        onClick={handleOpenVotingClick}
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
                      {session.started_at && <p>Inicio: {new Date(session.started_at).toLocaleString()}</p>}
                      {session.ended_at && <p>Fin: {new Date(session.ended_at).toLocaleString()}</p>}
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
                    <p className="text-muted-foreground">Resultados detallados por área</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={exportPDF} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted font-medium">
                      <Download className="w-4 h-4" /> PDF
                    </button>
                    <button onClick={exportExcel} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted font-medium">
                      <Download className="w-4 h-4" /> Excel
                    </button>
                    <button
                      onClick={handleClearDataClick}
                      disabled={session?.status === "open" || isClearingData}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                      title={session?.status === "open" ? "Debe cerrar la votación antes de limpiar datos" : "Limpiar todos los datos del sistema"}
                    >
                      <Trash2 className="w-4 h-4" />
                      {isClearingData ? "Limpiando..." : "Limpiar Datos"}
                    </button>
                  </div>
                </div>

                {session?.status === "open" && (
                  <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 flex items-center gap-3 text-foreground">
                    <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0" />
                    <p className="text-sm">La votación está abierta. Debe cerrar la votación antes de poder limpiar los datos del sistema.</p>
                  </div>
                )}

                {/* Summary */}
                <div className="bg-card rounded-xl border border-border p-6 shadow-card">
                  <h3 className="font-display font-bold text-lg mb-2 text-card-foreground">Resumen General</h3>
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
                    ...results.candidates.map((c) => ({ name: c.name, value: c.votes })),
                    { name: "Blanco", value: results.blank },
                  ].filter((d) => d.value > 0);

                  const barData = [
                    ...results.candidates.map((c) => ({ name: c.name, votos: c.votes })),
                    { name: "Blanco", votos: results.blank },
                  ];

                  return (
                    <div key={area} className="bg-card rounded-xl border border-border p-6 shadow-card space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-display font-bold text-xl text-card-foreground">{area}</h3>
                          <p className="text-sm text-muted-foreground">Total votos: {results.total}</p>
                        </div>
                        {results.candidates.length > 0 && results.candidates[0].votes > 0 && (
                          <div className="flex items-center gap-2 bg-accent/50 border border-primary/20 px-4 py-2 rounded-lg">
                            <Trophy className="w-5 h-5 text-yellow-500" />
                            <span className="font-bold text-card-foreground">{results.candidates[0].name}</span>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div>
                          <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={barData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
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
                        <div>
                          <ResponsiveContainer width="100%" height={300}>
                            <RPieChart>
                              <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                innerRadius={30}
                                dataKey="value"
                                label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                                labelLine={true}
                              >
                                {pieData.map((_, i) => (
                                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                              <Legend
                                layout="vertical"
                                align="right"
                                verticalAlign="middle"
                                wrapperStyle={{ fontSize: "12px" }}
                              />
                            </RPieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left py-2 px-3 font-semibold text-foreground">Pos.</th>
                              <th className="text-left py-2 px-3 font-semibold text-foreground">Candidato</th>
                              <th className="text-right py-2 px-3 font-semibold text-foreground">Votos</th>
                              <th className="text-right py-2 px-3 font-semibold text-foreground">Porcentaje</th>
                            </tr>
                          </thead>
                          <tbody>
                            {results.candidates.map((c, i) => (
                              <tr key={c.name} className={`border-b border-border/50 ${i === 0 ? "bg-accent/30" : ""}`}>
                                <td className="py-2 px-3 font-bold text-foreground">
                                  {i + 1}° {i === 0 && "🏆"}
                                </td>
                                <td className="py-2 px-3 text-foreground font-medium">{c.name}</td>
                                <td className="py-2 px-3 text-right font-semibold text-foreground">{c.votes}</td>
                                <td className="py-2 px-3 text-right text-muted-foreground">{c.percentage}%</td>
                              </tr>
                            ))}
                            <tr className="bg-muted/50">
                              <td className="py-2 px-3"></td>
                              <td className="py-2 px-3 font-medium text-foreground">Votos en Blanco</td>
                              <td className="py-2 px-3 text-right font-semibold text-foreground">{results.blank}</td>
                              <td className="py-2 px-3 text-right text-muted-foreground">{results.blankPercentage}%</td>
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

      {/* Confirmation: Open Voting */}
      <AlertDialog open={showOpenVotingConfirm} onOpenChange={setShowOpenVotingConfirm}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl">
              Confirmar Apertura de Votación
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              ¿Está seguro que desea {session ? "reabrir" : "crear e iniciar"} la votación?
              {session && " Los votantes podrán emitir sus votos nuevamente."}
              {!session && ` Se creará una nueva sesión con ${totalVoters} votantes habilitados.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmOpenVoting}
              className="bg-success text-success-foreground hover:bg-success/90"
            >
              Sí, Abrir Votación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation: Clear Data */}
      <AlertDialog open={showClearDataConfirm} onOpenChange={setShowClearDataConfirm}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-destructive" />
              Limpiar Todos los Datos
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              <span className="font-bold text-destructive">¡ATENCIÓN!</span> Esta acción eliminará permanentemente:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Todos los votos registrados</li>
                <li>Todos los candidatos</li>
                <li>La sesión de votación actual</li>
              </ul>
              <p className="mt-3 font-semibold">Esta acción NO se puede deshacer.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmClearData}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sí, Eliminar Todo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminDashboard;
