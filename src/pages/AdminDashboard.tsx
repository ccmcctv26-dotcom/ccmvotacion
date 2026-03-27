import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart3, Users, Vote, Settings, FileText, LogOut, Plus, Trash2, Edit,
  Play, Square, Download, TrendingUp, User, Clock, Trophy, Medal, Award,
  AlertTriangle, Pause, RotateCcw, Lock,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RPieChart, Pie, Cell, Legend,
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import logo from "@/assets/logo.png";
import ImageCropper from "@/components/ImageCropper";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
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

const fontFamily = { fontFamily: "sans-serif" };

const AREAS = ["Administración", "Vigilancia", "Tribunal de Honor", "Comité Electoral"];
const CHART_COLORS = ["#e8740a", "#f59e0b", "#06b6d4", "#8b5cf6", "#ef4444", "#10b981", "#6366f1", "#ec4899"];
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
  const [showPauseConfirm, setShowPauseConfirm] = useState(false);
  const [showResumeConfirm, setShowResumeConfirm] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showDeleteCandidateConfirm, setShowDeleteCandidateConfirm] = useState(false);
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(null);
  const [isClearingData, setIsClearingData] = useState(false);
  const [showUpdateVotersConfirm, setShowUpdateVotersConfirm] = useState(false);
  const [preVotingError, setPreVotingError] = useState<string | null>(null);

  // Track initial voter count when voting started
  const [initialVoterCount, setInitialVoterCount] = useState<number | null>(null);

  const isVotingActive = session?.status === "open" || session?.status === "paused";
  const isVotingInProgress = session?.status === "open";
  const isLocked = isVotingActive;

  useEffect(() => {
    const auth = sessionStorage.getItem("adminAuth");
    if (auth !== "true") {
      navigate("/admin/login");
      return;
    }
    fetchData();
    setupRealtime();
  }, [navigate]);

  useEffect(() => {
    if (!session?.started_at || (session.status !== "open" && session.status !== "paused")) {
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
      if (sessions[0].status === "open") {
        setInitialVoterCount(sessions[0].total_eligible_voters);
      } else {
        setInitialVoterCount(null);
      }

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
      setInitialVoterCount(null);
    }
  };

  const setupRealtime = () => {
    const channel = supabase
      .channel("admin-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "votes" }, () => {
        fetchData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "voting_sessions" }, () => {
        fetchData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "candidates" }, () => {
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

  const updateSessionStatus = async (status: string, extras: Record<string, unknown> = {}) => {
    if (!session) return;

    const { error } = await supabase
      .from("voting_sessions")
      .update({ status, ...extras })
      .eq("id", session.id);

    if (error) {
      console.error("Error updating session status:", error);
      return;
    }

    fetchData();
  };

  const createOrUpdateSession = async (status: string) => {
    if (session) {
      const updates: Record<string, unknown> = { status, total_eligible_voters: totalVoters };
      if (status === "open" && !session.started_at) updates.started_at = new Date().toISOString();
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

  // Voting control handlers
  const handleOpenVotingClick = () => {
    // Validate: must have candidates and voter count > 0
    if (candidates.length === 0) {
      setPreVotingError("Debe registrar al menos un candidato antes de iniciar la votación.");
      return;
    }
    if (totalVoters <= 0) {
      setPreVotingError("Debe registrar la cantidad de votantes habilitados antes de iniciar la votación.");
      return;
    }
    setPreVotingError(null);
    setShowOpenVotingConfirm(true);
  };
  const handleConfirmOpenVoting = () => {
    setShowOpenVotingConfirm(false);
    createOrUpdateSession("open");
    setInitialVoterCount(totalVoters);
  };

  const handleCreateSession = async () => {
    await supabase.from("voting_sessions").insert({
      total_eligible_voters: totalVoters,
      status: "closed",
    });
    fetchData();
  };

  const handlePauseClick = () => setShowPauseConfirm(true);
  const handleConfirmPause = async () => {
    setShowPauseConfirm(false);
    await updateSessionStatus("paused");
  };

  const handleResumeClick = () => setShowResumeConfirm(true);
  const handleConfirmResume = async () => {
    setShowResumeConfirm(false);
    await updateSessionStatus("open");
  };

  const handleEndClick = () => setShowEndConfirm(true);
  const handleConfirmEnd = async () => {
    setShowEndConfirm(false);
    await updateSessionStatus("closed", { ended_at: new Date().toISOString() });
  };

  const handleClearDataClick = () => {
    if (isVotingActive) return;
    setShowClearDataConfirm(true);
  };

  const handleConfirmClearData = async () => {
    setShowClearDataConfirm(false);
    if (!session) return;
    setIsClearingData(true);
    try {
      await supabase.from("votes").delete().eq("session_id", session.id);
      await supabase.from("candidates").delete().eq("session_id", session.id);
      await supabase.from("voting_sessions").delete().eq("id", session.id);
      setSession(null);
      setCandidates([]);
      setVotes([]);
      setTotalVoters(100);
      setInitialVoterCount(null);
    } catch (err) {
      console.error("Error clearing data:", err);
    } finally {
      setIsClearingData(false);
    }
  };

  // Voter count change handler - block edits while voting is in progress
  const handleVoterCountChange = (newValue: number) => {
    if (isVotingInProgress) {
      setTotalVoters(session?.total_eligible_voters ?? totalVoters);
      return;
    }

    setTotalVoters(Math.max(0, newValue));
  };

  const handleUpdateVoterCountClick = () => {
    if (!session || isVotingInProgress) return;
    setShowUpdateVotersConfirm(true);
  };

  const handleConfirmUpdateVoterCount = async () => {
    setShowUpdateVotersConfirm(false);
    if (!session || isVotingInProgress) return;

    const { error } = await supabase
      .from("voting_sessions")
      .update({ total_eligible_voters: totalVoters })
      .eq("id", session.id);

    if (error) {
      console.error("Error updating eligible voters:", error);
      return;
    }

    fetchData();
  };

  // Candidate CRUD
  const handleSaveCandidate = async () => {
    if (!formName.trim() || isLocked) return;

    let photoUrl: string | null = null;
    if (formPhoto && session) {
      const ext = formPhoto.name.split(".").pop();
      const path = `${session.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("candidate-photos").upload(path, formPhoto);
      if (!error) {
        const { data: urlData } = supabase.storage.from("candidate-photos").getPublicUrl(path);
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

  const handleDeleteCandidateClick = (id: string) => {
    if (isLocked) return;
    setDeleteCandidateId(id);
    setShowDeleteCandidateConfirm(true);
  };

  const handleConfirmDeleteCandidate = async () => {
    setShowDeleteCandidateConfirm(false);
    if (deleteCandidateId) {
      await supabase.from("candidates").delete().eq("id", deleteCandidateId);
      setDeleteCandidateId(null);
      fetchData();
    }
  };

  const handleEditCandidate = (c: Candidate) => {
    if (isLocked) return;
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
        percentage: totalAreaVotes > 0
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
  const voterLimitReached = totalVoters > 0 && totalUniqueVoters >= totalVoters;

  const getStatusLabel = () => {
    if (!session) return { label: "Sin Iniciar", color: "text-muted-foreground", bg: "bg-muted/50" };
    switch (session.status) {
      case "open": return { label: "Votación Activa", color: "text-success", bg: "bg-success/10" };
      case "paused": return { label: "Votación Pausada", color: "text-warning", bg: "bg-warning/10" };
      case "closed": return { label: "Votación Cerrada", color: "text-destructive", bg: "bg-destructive/10" };
      default: return { label: "Sin Iniciar", color: "text-muted-foreground", bg: "bg-muted/50" };
    }
  };

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

    if (logoBase64) doc.addImage(logoBase64, "PNG", 14, 10, 20, 20);

    doc.setFontSize(18);
    doc.text("Cooperativa Comarapa R.L.", logoBase64 ? 40 : 14, 20);
    doc.setFontSize(14);
    doc.text("Elecciones 2026 - Resultados Oficiales", logoBase64 ? 40 : 14, 28);
    doc.setFontSize(10);
    doc.text(`Fecha: ${new Date().toLocaleString()}`, 14, 40);
    doc.text(`Total Habilitados: ${totalVoters}`, 14, 46);
    doc.text(`Total Votos: ${totalUniqueVoters}`, 14, 52);
    doc.text(`Participacion: ${participationPct}%`, 14, 58);
    if (session?.started_at) doc.text(`Inicio de votacion: ${new Date(session.started_at).toLocaleString()}`, 14, 64);
    if (session?.ended_at) doc.text(`Fin de votacion: ${new Date(session.ended_at).toLocaleString()}`, 14, 70);

    let startY = session?.ended_at ? 80 : session?.started_at ? 74 : 68;

    AREAS.forEach((area) => {
      const results = getAreaResults(area);
      if (startY > 240) { doc.addPage(); startY = 20; }

      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text(area, 14, startY);
      startY += 3;

      if (results.candidates.length > 0 && results.candidates[0].votes > 0) {
        doc.setFontSize(10);
        doc.setFont("helvetica", "italic");
        doc.text(`Ganador: ${results.candidates[0].name} (${results.candidates[0].votes} votos - ${results.candidates[0].percentage}%)`, 14, startY + 5);
        startY += 8;
      }

      doc.setFont("helvetica", "normal");
      startY += 2;

      const rows = results.candidates.map((c, i) => {
        const posLabel = i === 0 ? `${i + 1} GANADOR` : `${i + 1}`;
        return [posLabel, c.name, c.votes.toString(), `${c.percentage}%`];
      });
      rows.push(["--", "Votos en Blanco", results.blank.toString(), `${results.blankPercentage}%`]);

      autoTable(doc, {
        startY,
        head: [["Posicion", "Candidato", "Votos", "Porcentaje"]],
        body: rows,
        theme: "grid",
        headStyles: { fillColor: [232, 116, 10] },
        bodyStyles: { fontSize: 9 },
        didParseCell: (data) => {
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
    const summaryData: any[][] = [
      ["Cooperativa Comarapa R.L."],
      ["Elecciones 2026 - Resultados Oficiales"],
      [""],
      ["Fecha", new Date().toLocaleString()],
      ["Total Habilitados", totalVoters],
      ["Total Votos", totalUniqueVoters],
      ["Participacion", `${participationPct}%`],
    ];
    if (session?.started_at) summaryData.push(["Inicio", new Date(session.started_at).toLocaleString()]);
    if (session?.ended_at) summaryData.push(["Fin", new Date(session.ended_at).toLocaleString()]);

    summaryData.push([""], ["=== GANADORES POR AREA ==="]);
    AREAS.forEach((area) => {
      const results = getAreaResults(area);
      if (results.candidates.length > 0 && results.candidates[0].votes > 0) {
        summaryData.push([area, `${results.candidates[0].name} (${results.candidates[0].votes} votos - ${results.candidates[0].percentage}%)`]);
      } else {
        summaryData.push([area, "Sin votos"]);
      }
    });

    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, "Resumen");

    AREAS.forEach((area) => {
      const results = getAreaResults(area);
      const data = results.candidates.map((c, i) => ({
        Posicion: `${i + 1}${i === 0 ? " GANADOR" : ""}`,
        Candidato: c.name,
        Votos: c.votes,
        Porcentaje: `${c.percentage}%`,
      }));
      data.push({ Posicion: "--", Candidato: "Votos en Blanco", Votos: results.blank, Porcentaje: `${results.blankPercentage}%` });

      const ws = XLSX.utils.json_to_sheet(data);
      // Truncate sheet name to 31 chars (Excel limit)
      const sheetName = area.length > 31 ? area.substring(0, 31) : area;
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    XLSX.writeFile(wb, "resultados-elecciones-2026.xlsx");
  };

  const statusInfo = getStatusLabel();

  const tabs = [
    { id: "dashboard" as Tab, label: "Dashboard", icon: BarChart3 },
    { id: "candidates" as Tab, label: "Candidatos", icon: Users },
    { id: "control" as Tab, label: "Control", icon: Settings },
    { id: "reports" as Tab, label: "Reportes", icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border flex flex-col fixed top-0 left-0 h-screen z-30">
        <div className="p-6 border-b border-border flex items-center gap-3">
          <img src={logo} alt="Logo" className="w-10 h-10 object-contain" />
          <div>
            <h2 className="font-display font-bold text-sm text-card-foreground">Comarapa R.L.</h2>
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
      <main className="flex-1 ml-64 overflow-auto">
        <div className="p-8">
          <AnimatePresence mode="wait">
            {/* ===== DASHBOARD ===== */}
            {tab === "dashboard" && (
              <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                <div>
                  <h1 style={fontFamily} className="text-3xl font-display font-bold text-foreground">Dashboard</h1>
                  <p className="text-muted-foreground">Resumen en tiempo real de las elecciones</p>
                </div>

                {voterLimitReached && (
                  <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-center gap-3 text-foreground">
                    <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
                    <p className="text-sm font-semibold">Se ha alcanzado el límite de votantes habilitados ({totalVoters}). Ya no se pueden emitir más votos.</p>
                  </div>
                )}

                {/* Stats cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: "Habilitados", value: totalVoters, icon: Users, color: "text-info" },
                    { label: "Ya Votaron", value: totalUniqueVoters, icon: Vote, color: "text-primary" },
                    { label: "Faltan", value: remaining, icon: TrendingUp, color: "text-warning" },
                    { label: "Estado", value: statusInfo.label, icon: Settings, color: statusInfo.color },
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

                {/* Time + Progress */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-card rounded-xl border border-border p-6 shadow-card space-y-4">
                    <div className="flex items-center gap-2 text-card-foreground">
                      <Clock className="w-5 h-5 text-primary" />
                      <h3 style={fontFamily} className="font-display font-bold text-lg">Tiempo de Votación</h3>
                    </div>
                    {session?.started_at ? (
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm text-muted-foreground">Inicio</p>
                          <p className="text-foreground font-semibold">{new Date(session.started_at).toLocaleString()}</p>
                        </div>
                        {(session.status === "open" || session.status === "paused") && elapsedTime && (
                          <div>
                            <p className="text-sm text-muted-foreground">Tiempo transcurrido</p>
                            <p className="text-4xl font-bold text-primary font-mono tracking-wider">{elapsedTime}</p>
                          </div>
                        )}
                        {session.ended_at && (
                          <div>
                            <p className="text-sm text-muted-foreground">Finalización</p>
                            <p className="text-foreground font-semibold">{new Date(session.ended_at).toLocaleString()}</p>
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
                      <h3 style={fontFamily} className="font-display font-bold text-lg">Progreso de Participación</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Participación</span>
                        <span className="font-bold text-foreground">{participationPct}%</span>
                      </div>
                      <Progress value={progressPct} className="h-4" />
                      <div className="flex justify-between text-sm">
                        <span className="text-success font-medium">✓ {totalUniqueVoters} votaron</span>
                        <span className="text-muted-foreground">{remaining} pendientes</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rankings per area */}
                <div className="space-y-4">
                  <h2 style={fontFamily} className="text-xl font-display font-bold text-foreground">Posiciones por Área</h2>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {AREAS.map((area) => {
                      const results = getAreaResults(area);
                      return (
                        <div key={area} className="bg-card rounded-xl border border-border p-6 shadow-card">
                          <h3 style={fontFamily} className="font-display font-bold text-lg mb-4 text-card-foreground border-b border-border pb-3">{area}</h3>
                          {results.candidates.length === 0 ? (
                            <p className="text-muted-foreground text-sm">Sin candidatos</p>
                          ) : (
                            <div className="space-y-3">
                              {results.candidates.map((c, i) => {
                                const RankIcon = RANK_ICONS[i] || Award;
                                const rankColor = RANK_COLORS[i] || "text-muted-foreground";
                                return (
                                  <div key={c.id} className={`flex items-center gap-3 p-3 rounded-lg ${i === 0 ? "bg-accent/50 border border-primary/20" : "bg-muted/30"}`}>
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
                                      <p className="font-semibold text-sm text-card-foreground truncate">{c.name}</p>
                                      <p className="text-xs text-muted-foreground">{c.votes} votos · {c.percentage}%</p>
                                    </div>
                                    <span className="text-lg font-bold text-foreground">{i + 1}°</span>
                                  </div>
                                );
                              })}
                              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border-t border-border">
                                <span className="text-xs text-muted-foreground ml-8">Votos en blanco: {results.blank} ({results.blankPercentage}%)</span>
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
              <motion.div key="candidates" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 style={fontFamily} className="text-3xl font-display font-bold text-foreground">Candidatos</h1>
                    <p className="text-muted-foreground">Gestión de candidatos por área</p>
                  </div>
                  <button
                    onClick={() => { resetForm(); setShowForm(true); }}
                    disabled={!session || isLocked}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg gradient-primary text-primary-foreground font-medium disabled:opacity-50"
                  >
                    {isLocked ? <Lock className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    Agregar Candidato
                  </button>
                </div>

                {isLocked && (
                  <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 flex items-center gap-3 text-foreground">
                    <Lock className="w-5 h-5 text-warning flex-shrink-0" />
                    <p className="text-sm font-medium">La gestión de candidatos está bloqueada mientras la votación está activa.</p>
                  </div>
                )}

                {!session && (
                  <div className="bg-accent/50 border border-primary/20 rounded-lg p-4 text-accent-foreground">
                    Primero debe preparar una sesión de votación en la pestaña "Control" para poder agregar candidatos.
                  </div>
                )}

                {showForm && !isLocked && (
                  <div className="bg-card rounded-xl border border-border p-6 shadow-card space-y-4">
                    <h3 className="font-semibold text-lg text-card-foreground">
                      {editingId ? "Editar Candidato" : "Nuevo Candidato"}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Nombre Completo</label>
                        <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Área</label>
                        <select value={formArea} onChange={(e) => setFormArea(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                          {AREAS.map((a) => (<option key={a} value={a}>{a}</option>))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Foto</label>
                        <input type="file" accept="image/*" onChange={(e) => setFormPhoto(e.target.files?.[0] || null)}
                          className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleSaveCandidate} className="px-4 py-2 rounded-lg gradient-primary text-primary-foreground font-medium">
                        {editingId ? "Guardar Cambios" : "Agregar"}
                      </button>
                      <button onClick={resetForm} className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted">Cancelar</button>
                    </div>
                  </div>
                )}

                {AREAS.map((area) => {
                  const areaCands = candidates.filter((c) => c.area === area);
                  if (areaCands.length === 0 && !session) return null;
                  return (
                    <div key={area}>
                      <h3 style={fontFamily} className="font-display font-bold text-lg text-foreground mb-3">{area}</h3>
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
                                <button onClick={() => handleEditCandidate(c)} disabled={isLocked}
                                  className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed">
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDeleteCandidateClick(c.id)} disabled={isLocked}
                                  className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive disabled:opacity-30 disabled:cursor-not-allowed">
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
              <motion.div key="control" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                <div>
                  <h1 style={fontFamily} className="text-3xl font-display font-bold text-foreground">Control de Votación</h1>
                  <p className="text-muted-foreground">Administrar sesión de votación</p>
                </div>

                <div className="bg-card rounded-xl border border-border p-6 shadow-card space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Total de Votantes Habilitados
                      {isVotingInProgress ? (
                        <span className="ml-2 text-xs text-warning font-normal">(No editable durante votación en curso)</span>
                      ) : session?.status === "paused" ? (
                        <span className="ml-2 text-xs text-success font-normal">(Puede aumentar o disminuir con la votación detenida)</span>
                      ) : null}
                    </label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="number"
                        value={totalVoters}
                        onChange={(e) => handleVoterCountChange(parseInt(e.target.value) || 0)}
                        min={0}
                        disabled={isVotingInProgress}
                        className="w-full max-w-xs px-4 py-3 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-lg disabled:opacity-50"
                      />
                      {!isVotingInProgress && session && totalVoters !== session.total_eligible_voters && (
                        <button onClick={handleUpdateVoterCountClick}
                          className="px-4 py-3 rounded-lg gradient-primary text-primary-foreground font-medium text-sm">
                          Actualizar
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 pt-4 border-t border-border">
                    <div className={`px-4 py-2 rounded-full text-sm font-semibold ${statusInfo.bg} ${statusInfo.color}`}>
                      ● {statusInfo.label}
                    </div>
                  </div>

                  {preVotingError && (
                    <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-center gap-3 text-foreground">
                      <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
                      <p className="text-sm font-medium">{preVotingError}</p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3">
                    {/* Create Session (without starting) */}
                    {!session && (
                      <button onClick={handleCreateSession}
                        className="flex items-center gap-2 px-6 py-3 rounded-lg bg-info text-info-foreground font-semibold hover:opacity-90 transition-opacity">
                        <Plus className="w-5 h-5" />
                        Preparar Sesión
                      </button>
                    )}

                    {/* Start Voting */}
                    {session && session.status === "closed" && (
                      <button onClick={handleOpenVotingClick}
                        className="flex items-center gap-2 px-6 py-3 rounded-lg bg-success text-success-foreground font-semibold hover:opacity-90 transition-opacity">
                        <Play className="w-5 h-5" />
                        Iniciar Votación
                      </button>
                    )}

                    {/* Pause Voting */}
                    {session?.status === "open" && (
                      <button onClick={handlePauseClick}
                        className="flex items-center gap-2 px-6 py-3 rounded-lg bg-warning text-warning-foreground font-semibold hover:opacity-90 transition-opacity">
                        <Pause className="w-5 h-5" />
                        Pausar Votación
                      </button>
                    )}

                    {/* Resume Voting */}
                    {session?.status === "paused" && (
                      <button onClick={handleResumeClick}
                        className="flex items-center gap-2 px-6 py-3 rounded-lg bg-success text-success-foreground font-semibold hover:opacity-90 transition-opacity">
                        <RotateCcw className="w-5 h-5" />
                        Reanudar Votación
                      </button>
                    )}

                    {/* End Voting */}
                    {(session?.status === "open" || session?.status === "paused") && (
                      <button onClick={handleEndClick}
                        className="flex items-center gap-2 px-6 py-3 rounded-lg bg-destructive text-destructive-foreground font-semibold hover:opacity-90 transition-opacity">
                        <Square className="w-5 h-5" />
                        Finalizar Votación
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
              <motion.div key="reports" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 style={fontFamily} className="text-3xl font-display font-bold text-foreground">Reportes</h1>
                    <p className="text-muted-foreground">Resultados detallados por área</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={exportPDF} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted font-medium">
                      <Download className="w-4 h-4" /> PDF
                    </button>
                    <button onClick={exportExcel} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted font-medium">
                      <Download className="w-4 h-4" /> Excel
                    </button>
                    <button onClick={handleClearDataClick}
                      disabled={isVotingActive || isClearingData}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                      title={isVotingActive ? "Debe cerrar la votación antes de limpiar datos" : "Limpiar todos los datos del sistema"}>
                      <Trash2 className="w-4 h-4" />
                      {isClearingData ? "Limpiando..." : "Limpiar Datos"}
                    </button>
                  </div>
                </div>

                {isVotingActive && (
                  <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 flex items-center gap-3 text-foreground">
                    <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0" />
                    <p className="text-sm">La votación está activa. Debe finalizar la votación antes de poder limpiar los datos del sistema.</p>
                  </div>
                )}

                {voterLimitReached && (
                  <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-center gap-3 text-foreground">
                    <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
                    <p className="text-sm font-semibold">Se ha alcanzado el límite de votantes habilitados ({totalVoters}). Ya no se pueden emitir más votos.</p>
                  </div>
                )}

                {/* Summary */}
                <div className="bg-card rounded-xl border border-border p-6 shadow-card">
                  <h3 style={fontFamily} className="font-display font-bold text-lg mb-2 text-card-foreground">Resumen General</h3>
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
                          <h3 style={fontFamily} className="font-display font-bold text-xl text-card-foreground">{area}</h3>
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
                              <YAxis allowDecimals={false} />
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
                              <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} innerRadius={30} dataKey="value"
                                label={({ percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={true}>
                                {pieData.map((_, i) => (
                                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                              <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: "12px" }} />
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
                                <td className="py-2 px-3 font-bold text-foreground">{i + 1}°</td>
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
            <AlertDialogTitle className="font-display text-xl">Confirmar Apertura de Votación</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              ¿Está seguro que desea {session ? "reabrir" : "crear e iniciar"} la votación?
              {session && " Los votantes podrán emitir sus votos nuevamente."}
              {!session && ` Se creará una nueva sesión con ${totalVoters} votantes habilitados.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmOpenVoting} className="bg-success text-success-foreground hover:bg-success/90">
              Sí, Abrir Votación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation: Pause Voting */}
      <AlertDialog open={showPauseConfirm} onOpenChange={setShowPauseConfirm}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl flex items-center gap-2">
              <Pause className="w-5 h-5 text-warning" /> Pausar Votación
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              ¿Está seguro que desea pausar el proceso de votación? Los votantes no podrán emitir votos mientras el sistema esté pausado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmPause} className="bg-warning text-warning-foreground hover:bg-warning/90">
              Confirmar Pausa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation: Resume Voting */}
      <AlertDialog open={showResumeConfirm} onOpenChange={setShowResumeConfirm}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl">Reanudar Votación</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              ¿Está seguro que desea reanudar el proceso de votación?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmResume} className="bg-success text-success-foreground hover:bg-success/90">
              Confirmar Reanudación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation: End Voting */}
      <AlertDialog open={showEndConfirm} onOpenChange={setShowEndConfirm}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" /> Finalizar Votación
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              ¿Está seguro que desea finalizar la votación? Esta acción cerrará el proceso y los votantes ya no podrán emitir votos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmEnd} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sí, Finalizar Votación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation: Delete Candidate */}
      <AlertDialog open={showDeleteCandidateConfirm} onOpenChange={setShowDeleteCandidateConfirm}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" /> Eliminar Candidato
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              ¿Está seguro que desea eliminar permanentemente este candidato? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteCandidate} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Confirmar Eliminación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation: Clear Data */}
      <AlertDialog open={showClearDataConfirm} onOpenChange={setShowClearDataConfirm}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-destructive" /> Limpiar Todos los Datos
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              <span className="font-bold text-destructive">¡ATENCIÓN!</span> Esta acción eliminará permanentemente:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Todos los votos registrados</li>
                <li>Todos los </li>
                <li>La sesión de votación actual</li>
              </ul>
              <p className="mt-3 font-semibold">Esta acción NO se puede deshacer.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmClearData} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sí, Eliminar Todo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation: Update Voter Count */}
      <AlertDialog open={showUpdateVotersConfirm} onOpenChange={setShowUpdateVotersConfirm}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl">Confirmar Actualización</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              ¿Está seguro que desea actualizar el total de votantes habilitados a <span className="font-bold">{totalVoters}</span>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmUpdateVoterCount} className="gradient-primary text-primary-foreground">
              Confirmar Cambio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminDashboard;
