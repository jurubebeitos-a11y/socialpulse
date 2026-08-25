import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Legend, Area, AreaChart, Cell
} from "recharts";
import {
  Instagram, Youtube, Facebook, Music2, Zap, Image as ImageIcon,
  Upload, X, Plus, Sparkles, Loader2, Pencil, Trash2, ChevronDown,
  TrendingUp, TrendingDown, Minus, Users, Eye, Check
} from "lucide-react";

/* ---------- tokens ---------- */
const PLATFORMS = {
  instagram: { name: "Instagram", short: "IG", color: "#E1306C", grad: "linear-gradient(135deg,#F9CE34,#EE2A7B,#6228D7)", icon: Instagram },
  tiktok:    { name: "TikTok",    short: "TT", color: "#25F4EE", grad: "linear-gradient(135deg,#25F4EE,#FE2C55)",         icon: Music2 },
  youtube:   { name: "YouTube",   short: "YT", color: "#FF0033", grad: "linear-gradient(135deg,#FF0033,#7A0000)",         icon: Youtube },
  kwai:      { name: "Kwai",      short: "KW", color: "#FF8000", grad: "linear-gradient(135deg,#FFD600,#FF8000)",         icon: Zap },
  facebook:  { name: "Facebook",  short: "FB", color: "#1877F2", grad: "linear-gradient(135deg,#42A5F5,#1877F2)",         icon: Facebook },
  pinterest: { name: "Pinterest", short: "PT", color: "#E60023", grad: "linear-gradient(135deg,#FF6B81,#E60023)",         icon: ImageIcon },
};
const PLATFORM_KEYS = Object.keys(PLATFORMS);
const BG = "#08070F";
const SURFACE = "#131120";
const SURFACE_2 = "#1B1830";
const INK = "#F3F0FF";
const MUTED = "#8B85AC";
const VIOLET = "#8B5CF6";
const LIME = "#C6FF3D";

/* ---------- helpers ---------- */
const uid = () => Math.random().toString(36).slice(2, 10);
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtInt = (n) => (n === null || n === undefined ? "—" : Math.round(n).toLocaleString("pt-BR"));
const fmtCompact = (n) => {
  if (n === null || n === undefined) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(".0", "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(".0", "") + "K";
  return String(Math.round(n));
};
const fmtDate = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
};
const withinPeriod = (iso, period) => {
  if (period === "all") return true;
  const days = period === "7d" ? 7 : 30;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return new Date(iso + "T00:00:00") >= cutoff;
};

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(",")[1]);
    r.onerror = () => reject(new Error("Falha ao ler arquivo"));
    r.readAsDataURL(file);
  });
}

/* ---------- count-up hook ---------- */
function useCountUp(target, duration = 900) {
  const [val, setVal] = useState(0);
  const raf = useRef();
  useEffect(() => {
    const start = performance.now();
    const from = 0;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(from + (target - from) * eased);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return val;
}

/* ---------- sparkline ---------- */
function Sparkline({ data, color }) {
  if (!data || data.length < 2) {
    return <div style={{ height: 36, display: "flex", alignItems: "center", fontSize: 11, color: MUTED }}>sem histórico suficiente</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={36}>
      <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`spark-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.5} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#spark-${color.replace("#", "")})`} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ---------- main ---------- */
export default function App() {
  const [entries, setEntries] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [period, setPeriod] = useState("30d");
  const [activePlatforms, setActivePlatforms] = useState(new Set(PLATFORM_KEYS));
  const [tab, setTab] = useState("evolucao");

  // upload / analysis
  const [files, setFiles] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const [pending, setPending] = useState(null); // extracted results awaiting confirmation
  const fileInputRef = useRef(null);

  // manual entry
  const [manualOpen, setManualOpen] = useState(false);
  const [manualPlatform, setManualPlatform] = useState("instagram");
  const [manualViews, setManualViews] = useState("");
  const [manualFollowers, setManualFollowers] = useState("");
  const [manualDate, setManualDate] = useState(todayISO());

  const [editingId, setEditingId] = useState(null);
  const [saveStatus, setSaveStatus] = useState("");

  /* load from persistent storage */
  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("sm-entries", false);
        if (res && res.value) setEntries(JSON.parse(res.value));
      } catch (e) {
        // no data yet
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const persist = useCallback(async (next) => {
    setEntries(next);
    try {
      await window.storage.set("sm-entries", JSON.stringify(next), false);
    } catch (e) {
      setSaveStatus("Não consegui salvar automaticamente — seus dados podem se perder ao recarregar.");
      setTimeout(() => setSaveStatus(""), 4000);
    }
  }, []);

  /* derived data */
  const filteredEntries = useMemo(() => entries.filter((e) => withinPeriod(e.date, period)), [entries, period]);

  const latestByPlatform = useMemo(() => {
    const map = {};
    for (const k of PLATFORM_KEYS) {
      const list = entries.filter((e) => e.platform === k).sort((a, b) => a.date.localeCompare(b.date));
      map[k] = list;
    }
    return map;
  }, [entries]);

  const totalViews = useMemo(() => filteredEntries.reduce((s, e) => s + (e.views || 0), 0), [filteredEntries]);
  const totalFollowers = useMemo(() => {
    let sum = 0;
    for (const k of PLATFORM_KEYS) {
      const list = latestByPlatform[k];
      const last = [...list].reverse().find((e) => e.followers !== null && e.followers !== undefined);
      if (last) sum += last.followers;
    }
    return sum;
  }, [latestByPlatform]);

  const viewsCounted = useCountUp(totalViews);
  const followersCounted = useCountUp(totalFollowers);

  const evolutionData = useMemo(() => {
    const dates = Array.from(new Set(filteredEntries.map((e) => e.date))).sort();
    return dates.map((d) => {
      const row = { date: fmtDate(d), _raw: d };
      for (const k of PLATFORM_KEYS) {
        const hit = filteredEntries.find((e) => e.date === d && e.platform === k);
        if (hit) row[k] = hit.views;
      }
      return row;
    });
  }, [filteredEntries]);

  const comparisonData = useMemo(() => {
    return PLATFORM_KEYS.map((k) => ({
      name: PLATFORMS[k].short,
      key: k,
      views: filteredEntries.filter((e) => e.platform === k).reduce((s, e) => s + (e.views || 0), 0),
    }));
  }, [filteredEntries]);

  const togglePlatform = (k) => {
    setActivePlatforms((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  };

  /* ---- upload handling ---- */
  const onFilesSelected = (fileList) => {
    const arr = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    const withPreview = arr.map((f) => ({ id: uid(), file: f, url: URL.createObjectURL(f) }));
    setFiles((prev) => [...prev, ...withPreview]);
  };
  const removeFile = (id) => setFiles((prev) => prev.filter((f) => f.id !== id));

  const analyze = async () => {
    if (files.length === 0) return;
    setAnalyzing(true);
    setAnalyzeError("");
    setPending(null);
    try {
      const imageBlocks = await Promise.all(
        files.map(async (f) => ({
          type: "image",
          source: { type: "base64", media_type: f.file.type, data: await fileToBase64(f.file) },
        }))
      );
      const instructions = {
        type: "text",
        text:
          "Você recebeu prints de tela de insights/analytics de redes sociais (Instagram, TikTok, YouTube, Kwai, Facebook ou Pinterest). " +
          "Para CADA imagem, identifique a rede social pelo visual/ícones/texto e extraia, se estiverem visíveis: o número de visualizações (views/alcance/reproduções) e o número de seguidores. " +
          "Converta abreviações como '12,3 mil' ou '1.2M' para o número inteiro completo. " +
          "Responda APENAS com um array JSON, sem markdown, sem texto extra, no formato exato: " +
          '[{"platform":"instagram|tiktok|youtube|kwai|facebook|pinterest|desconhecido","views":numero_ou_null,"followers":numero_ou_null}]. ' +
          "Um item por imagem, na mesma ordem em que as imagens foram enviadas.",
      };
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [{ role: "user", content: [...imageBlocks, instructions] }],
        }),
      });
      const data = await response.json();
      const textBlock = (data.content || []).find((b) => b.type === "text");
      if (!textBlock) throw new Error("Sem resposta de texto");
      const clean = textBlock.text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      const rows = parsed.map((r) => ({
        id: uid(),
        platform: PLATFORM_KEYS.includes(r.platform) ? r.platform : "instagram",
        views: r.views ?? "",
        followers: r.followers ?? "",
        date: todayISO(),
      }));
      setPending(rows);
    } catch (e) {
      setAnalyzeError("Não consegui ler os prints automaticamente. Tente prints mais nítidos, ou adicione os números manualmente abaixo.");
    } finally {
      setAnalyzing(false);
    }
  };

  const updatePendingRow = (id, field, value) => {
    setPending((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };
  const removePendingRow = (id) => setPending((prev) => prev.filter((r) => r.id !== id));

  const confirmPending = async () => {
    const clean = pending
      .filter((r) => r.views !== "" || r.followers !== "")
      .map((r) => ({
        id: uid(),
        platform: r.platform,
        date: r.date,
        views: r.views === "" ? null : Number(r.views),
        followers: r.followers === "" ? null : Number(r.followers),
      }));
    await persist([...entries, ...clean]);
    setPending(null);
    setFiles([]);
    setSaveStatus("Salvo!");
    setTimeout(() => setSaveStatus(""), 2000);
  };

  const cancelPending = () => {
    setPending(null);
    setFiles([]);
  };

  /* ---- manual entry ---- */
  const addManual = async () => {
    if (manualViews === "" && manualFollowers === "") return;
    const row = {
      id: uid(),
      platform: manualPlatform,
      date: manualDate,
      views: manualViews === "" ? null : Number(manualViews),
      followers: manualFollowers === "" ? null : Number(manualFollowers),
    };
    await persist([...entries, row]);
    setManualViews("");
    setManualFollowers("");
    setManualOpen(false);
    setSaveStatus("Salvo!");
    setTimeout(() => setSaveStatus(""), 2000);
  };

  /* ---- history edit/delete ---- */
  const deleteEntry = async (id) => {
    await persist(entries.filter((e) => e.id !== id));
  };
  const [editDraft, setEditDraft] = useState(null);
  const startEdit = (e) => {
    setEditingId(e.id);
    setEditDraft({ ...e, views: e.views ?? "", followers: e.followers ?? "" });
  };
  const saveEdit = async () => {
    const next = entries.map((e) =>
      e.id === editingId
        ? { ...e, platform: editDraft.platform, date: editDraft.date, views: editDraft.views === "" ? null : Number(editDraft.views), followers: editDraft.followers === "" ? null : Number(editDraft.followers) }
        : e
    );
    await persist(next);
    setEditingId(null);
    setEditDraft(null);
  };

  const historySorted = useMemo(() => [...entries].sort((a, b) => b.date.localeCompare(a.date)), [entries]);

  /* ---------- render ---------- */
  return (
    <div style={{ minHeight: "100vh", background: BG, color: INK, fontFamily: "'Inter', sans-serif", position: "relative", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Unbounded:wght@500;700;900&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');
        * { box-sizing: border-box; }
        ::selection { background: ${VIOLET}; color: white; }
        .display { font-family: 'Unbounded', sans-serif; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        input, select { font-family: 'Inter', sans-serif; }
        input:focus, select:focus, button:focus-visible { outline: 2px solid ${LIME}; outline-offset: 2px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes drift { 0%{ transform: translate(0,0) scale(1);} 50%{ transform: translate(30px,-20px) scale(1.05);} 100%{ transform: translate(0,0) scale(1);} }
        @keyframes pulseRing { 0%{ box-shadow: 0 0 0 0 rgba(139,92,246,0.35);} 100%{ box-shadow: 0 0 0 14px rgba(139,92,246,0);} }
        .blob { position: absolute; border-radius: 999px; filter: blur(70px); opacity: 0.35; animation: drift 14s ease-in-out infinite; pointer-events: none; }
        .card { background: ${SURFACE}; border: 1px solid rgba(255,255,255,0.06); border-radius: 20px; }
        .chip { transition: all .15s ease; }
        .chip:hover { transform: translateY(-1px); }
        @media (prefers-reduced-motion: reduce) { .blob { animation: none; } }
        .scrollbar::-webkit-scrollbar { height: 6px; width: 6px; }
        .scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }
      `}</style>

      {/* ambient blobs */}
      <div className="blob" style={{ width: 420, height: 420, background: "#8B5CF6", top: -120, left: -100 }} />
      <div className="blob" style={{ width: 360, height: 360, background: "#FE2C55", top: 60, right: -140, animationDelay: "2s" }} />
      <div className="blob" style={{ width: 300, height: 300, background: "#25F4EE", bottom: -80, left: "35%", animationDelay: "5s" }} />

      <div style={{ position: "relative", maxWidth: 1180, margin: "0 auto", padding: "28px 20px 80px" }}>
        {/* ---- hero ---- */}
        <header style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: LIME, display: "inline-block", animation: "pulseRing 1.8s infinite" }} />
            <span className="mono" style={{ fontSize: 12, letterSpacing: 1.5, color: MUTED, textTransform: "uppercase" }}>painel pessoal · ao vivo</span>
          </div>
          <h1 className="display" style={{ fontSize: "clamp(28px,5vw,48px)", fontWeight: 900, lineHeight: 1.05, marginBottom: 22, letterSpacing: -0.5 }}>
            Suas redes,<br /><span style={{ color: VIOLET }}>um só radar.</span>
          </h1>

          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
            <div className="card" style={{ padding: "22px 26px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 90% 10%, rgba(139,92,246,0.18), transparent 60%)" }} />
              <div style={{ position: "relative" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, color: MUTED, fontSize: 13, marginBottom: 6 }}>
                  <Eye size={14} /> visualizações no período
                </div>
                <div className="mono" style={{ fontSize: "clamp(30px,5vw,46px)", fontWeight: 700 }}>{fmtInt(viewsCounted)}</div>
              </div>
            </div>
            <div className="card" style={{ padding: "22px 26px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 90% 10%, rgba(198,255,61,0.14), transparent 60%)" }} />
              <div style={{ position: "relative" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, color: MUTED, fontSize: 13, marginBottom: 6 }}>
                  <Users size={14} /> seguidores (total atual)
                </div>
                <div className="mono" style={{ fontSize: "clamp(30px,5vw,46px)", fontWeight: 700 }}>{fmtInt(followersCounted)}</div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
            {[["7d", "7 dias"], ["30d", "30 dias"], ["all", "tudo"]].map(([k, label]) => (
              <button
                key={k}
                onClick={() => setPeriod(k)}
                className="chip"
                style={{
                  padding: "8px 16px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer",
                  border: period === k ? `1px solid ${VIOLET}` : "1px solid rgba(255,255,255,0.1)",
                  background: period === k ? "rgba(139,92,246,0.18)" : "transparent",
                  color: period === k ? "#fff" : MUTED,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </header>

        {/* ---- add data ---- */}
        <section className="card" style={{ padding: 22, marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
            <h2 className="display" style={{ fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              <Sparkles size={18} color={LIME} /> Adicionar dados
            </h2>
            <button
              onClick={() => setManualOpen((v) => !v)}
              style={{ fontSize: 13, color: MUTED, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
            >
              digitar manualmente <ChevronDown size={14} style={{ transform: manualOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
            </button>
          </div>

          {manualOpen && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 18, padding: 14, background: SURFACE_2, borderRadius: 14 }}>
              <Field label="rede">
                <select value={manualPlatform} onChange={(e) => setManualPlatform(e.target.value)} style={selectStyle}>
                  {PLATFORM_KEYS.map((k) => <option key={k} value={k}>{PLATFORMS[k].name}</option>)}
                </select>
              </Field>
              <Field label="visualizações"><input type="number" value={manualViews} onChange={(e) => setManualViews(e.target.value)} style={inputStyle} placeholder="0" /></Field>
              <Field label="seguidores"><input type="number" value={manualFollowers} onChange={(e) => setManualFollowers(e.target.value)} style={inputStyle} placeholder="0" /></Field>
              <Field label="data"><input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} style={inputStyle} /></Field>
              <button onClick={addManual} style={{ ...btnPrimary, height: 40 }}><Plus size={15} /> adicionar</button>
            </div>
          )}

          {!pending && (
            <>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); onFilesSelected(e.dataTransfer.files); }}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: "1.5px dashed rgba(255,255,255,0.18)", borderRadius: 16, padding: 26, textAlign: "center",
                  cursor: "pointer", background: "rgba(255,255,255,0.02)",
                }}
              >
                <Upload size={22} color={MUTED} style={{ marginBottom: 8 }} />
                <div style={{ fontSize: 14, color: INK, fontWeight: 600 }}>Solte prints da tela de insights aqui</div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>pode enviar vários de uma vez — a IA identifica a rede e lê os números</div>
                <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFilesSelected(e.target.files)} />
              </div>

              {files.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div className="scrollbar" style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6 }}>
                    {files.map((f) => (
                      <div key={f.id} style={{ position: "relative", flex: "0 0 auto" }}>
                        <img src={f.url} alt="" style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)" }} />
                        <button onClick={() => removeFile(f.id)} style={{ position: "absolute", top: -6, right: -6, background: "#1B1830", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 99, width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                          <X size={11} color={INK} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button onClick={analyze} disabled={analyzing} style={{ ...btnPrimary, marginTop: 14 }}>
                    {analyzing ? <><Loader2 size={15} className="mono" style={{ animation: "spin 1s linear infinite" }} /> analisando prints…</> : <><Sparkles size={15} /> analisar {files.length} print{files.length > 1 ? "s" : ""}</>}
                  </button>
                  {analyzeError && <div style={{ color: "#FF8A8A", fontSize: 13, marginTop: 8 }}>{analyzeError}</div>}
                </div>
              )}
            </>
          )}

          {pending && (
            <div>
              <div style={{ fontSize: 13, color: MUTED, marginBottom: 10 }}>confira os valores lidos antes de salvar:</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {pending.map((r) => (
                  <div key={r.id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", background: SURFACE_2, padding: 10, borderRadius: 12 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 99, background: PLATFORMS[r.platform].color, flexShrink: 0 }} />
                    <select value={r.platform} onChange={(e) => updatePendingRow(r.id, "platform", e.target.value)} style={{ ...selectStyle, minWidth: 110 }}>
                      {PLATFORM_KEYS.map((k) => <option key={k} value={k}>{PLATFORMS[k].name}</option>)}
                    </select>
                    <input type="number" value={r.views} onChange={(e) => updatePendingRow(r.id, "views", e.target.value)} placeholder="visualizações" style={{ ...inputStyle, width: 130 }} />
                    <input type="number" value={r.followers} onChange={(e) => updatePendingRow(r.id, "followers", e.target.value)} placeholder="seguidores" style={{ ...inputStyle, width: 130 }} />
                    <input type="date" value={r.date} onChange={(e) => updatePendingRow(r.id, "date", e.target.value)} style={{ ...inputStyle, width: 140 }} />
                    <button onClick={() => removePendingRow(r.id)} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, marginLeft: "auto" }}><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                <button onClick={confirmPending} style={btnPrimary}><Check size={15} /> confirmar e salvar</button>
                <button onClick={cancelPending} style={btnGhost}>cancelar</button>
              </div>
            </div>
          )}
          {saveStatus && <div style={{ fontSize: 12, color: LIME, marginTop: 10 }}>{saveStatus}</div>}
        </section>

        {/* ---- platform cards ---- */}
        <section style={{ marginBottom: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: 12 }}>
            {PLATFORM_KEYS.map((k) => {
              const p = PLATFORMS[k];
              const Icon = p.icon;
              const list = latestByPlatform[k];
              const lastViews = [...list].reverse().find((e) => e.views !== null && e.views !== undefined);
              const lastFollowers = [...list].reverse().find((e) => e.followers !== null && e.followers !== undefined);
              const spark = list.filter((e) => e.views !== null && e.views !== undefined).map((e) => ({ v: e.views }));
              return (
                <div key={k} className="card" style={{ padding: 16, position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: p.grad }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 8, background: p.grad, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon size={14} color="#fff" />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</span>
                  </div>
                  <div className="mono" style={{ fontSize: 22, fontWeight: 700 }}>{fmtCompact(lastViews?.views ?? null)}</div>
                  <div style={{ fontSize: 11, color: MUTED, marginBottom: 8 }}>visualizações · {lastViews ? fmtDate(lastViews.date) : "sem dados"}</div>
                  <Sparkline data={spark} color={p.color} />
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 6 }}>{fmtInt(lastFollowers?.followers ?? null)} seguidores</div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ---- charts ---- */}
        <section className="card" style={{ padding: 22, marginBottom: 24 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {[["evolucao", "Evolução"], ["comparacao", "Comparação"]].map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)} style={{
                padding: "7px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer",
                border: "none", background: tab === k ? SURFACE_2 : "transparent", color: tab === k ? "#fff" : MUTED,
              }}>{label}</button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
            {PLATFORM_KEYS.map((k) => {
              const on = activePlatforms.has(k);
              return (
                <button key={k} onClick={() => togglePlatform(k)} className="chip" style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 999, fontSize: 12,
                  border: `1px solid ${on ? PLATFORMS[k].color : "rgba(255,255,255,0.1)"}`,
                  background: on ? `${PLATFORMS[k].color}22` : "transparent", color: on ? "#fff" : MUTED, cursor: "pointer",
                }}>
                  <span style={{ width: 7, height: 7, borderRadius: 99, background: PLATFORMS[k].color }} />
                  {PLATFORMS[k].short}
                </button>
              );
            })}
          </div>

          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              {tab === "evolucao" ? (
                <LineChart data={evolutionData}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="date" stroke={MUTED} fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke={MUTED} fontSize={11} tickLine={false} axisLine={false} tickFormatter={fmtCompact} width={44} />
                  <Tooltip contentStyle={{ background: SURFACE_2, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, fontSize: 12 }} labelStyle={{ color: INK }} formatter={(v, name) => [fmtInt(v), PLATFORMS[name]?.name || name]} />
                  {PLATFORM_KEYS.filter((k) => activePlatforms.has(k)).map((k) => (
                    <Line key={k} type="monotone" dataKey={k} stroke={PLATFORMS[k].color} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                  ))}
                </LineChart>
              ) : (
                <BarChart data={comparisonData.filter((d) => activePlatforms.has(d.key))}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="name" stroke={MUTED} fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke={MUTED} fontSize={11} tickLine={false} axisLine={false} tickFormatter={fmtCompact} width={44} />
                  <Tooltip contentStyle={{ background: SURFACE_2, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, fontSize: 12 }} formatter={(v) => fmtInt(v)} />
                  <Bar dataKey="views" radius={[8, 8, 0, 0]}>
                    {comparisonData.filter((d) => activePlatforms.has(d.key)).map((d) => <Cell key={d.key} fill={PLATFORMS[d.key].color} />)}
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </section>

        {/* ---- followers table ---- */}
        <section className="card" style={{ padding: 22, marginBottom: 24 }}>
          <h2 className="display" style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Seguidores por rede</h2>
          <div className="scrollbar" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 480 }}>
              <thead>
                <tr style={{ textAlign: "left", color: MUTED, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  <th style={{ padding: "6px 10px" }}>rede</th>
                  <th style={{ padding: "6px 10px" }}>seguidores atuais</th>
                  <th style={{ padding: "6px 10px" }}>variação</th>
                  <th style={{ padding: "6px 10px" }}>última atualização</th>
                </tr>
              </thead>
              <tbody>
                {PLATFORM_KEYS.map((k) => {
                  const withF = latestByPlatform[k].filter((e) => e.followers !== null && e.followers !== undefined);
                  const last = withF[withF.length - 1];
                  const prev = withF[withF.length - 2];
                  const delta = last && prev ? last.followers - prev.followers : null;
                  const Icon = PLATFORMS[k].icon;
                  return (
                    <tr key={k} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                      <td style={{ padding: "10px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 22, height: 22, borderRadius: 6, background: PLATFORMS[k].grad, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Icon size={12} color="#fff" />
                          </div>
                          {PLATFORMS[k].name}
                        </div>
                      </td>
                      <td className="mono" style={{ padding: "10px", fontWeight: 600 }}>{fmtInt(last?.followers ?? null)}</td>
                      <td style={{ padding: "10px" }}>
                        {delta === null ? <span style={{ color: MUTED }}>—</span> : (
                          <span style={{ display: "flex", alignItems: "center", gap: 4, color: delta > 0 ? "#7CFCA0" : delta < 0 ? "#FF8A8A" : MUTED }}>
                            {delta > 0 ? <TrendingUp size={13} /> : delta < 0 ? <TrendingDown size={13} /> : <Minus size={13} />}
                            {delta > 0 ? "+" : ""}{fmtInt(delta)}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "10px", color: MUTED }}>{last ? fmtDate(last.date) : "sem dados"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* ---- history ---- */}
        <section className="card" style={{ padding: 22 }}>
          <h2 className="display" style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Histórico de registros</h2>
          {historySorted.length === 0 ? (
            <div style={{ color: MUTED, fontSize: 13 }}>Nenhum dado ainda — envie prints ou adicione manualmente acima.</div>
          ) : (
            <div className="scrollbar" style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 560 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: MUTED, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    <th style={{ padding: "6px 10px" }}>data</th>
                    <th style={{ padding: "6px 10px" }}>rede</th>
                    <th style={{ padding: "6px 10px" }}>visualizações</th>
                    <th style={{ padding: "6px 10px" }}>seguidores</th>
                    <th style={{ padding: "6px 10px" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {historySorted.map((e) => (
                    <tr key={e.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                      {editingId === e.id ? (
                        <>
                          <td style={{ padding: 8 }}><input type="date" value={editDraft.date} onChange={(ev) => setEditDraft((d) => ({ ...d, date: ev.target.value }))} style={{ ...inputStyle, width: 130 }} /></td>
                          <td style={{ padding: 8 }}>
                            <select value={editDraft.platform} onChange={(ev) => setEditDraft((d) => ({ ...d, platform: ev.target.value }))} style={selectStyle}>
                              {PLATFORM_KEYS.map((k) => <option key={k} value={k}>{PLATFORMS[k].name}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: 8 }}><input type="number" value={editDraft.views} onChange={(ev) => setEditDraft((d) => ({ ...d, views: ev.target.value }))} style={{ ...inputStyle, width: 110 }} /></td>
                          <td style={{ padding: 8 }}><input type="number" value={editDraft.followers} onChange={(ev) => setEditDraft((d) => ({ ...d, followers: ev.target.value }))} style={{ ...inputStyle, width: 110 }} /></td>
                          <td style={{ padding: 8, display: "flex", gap: 6 }}>
                            <button onClick={saveEdit} style={{ background: "none", border: "none", cursor: "pointer", color: LIME }}><Check size={16} /></button>
                            <button onClick={() => setEditingId(null)} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED }}><X size={16} /></button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ padding: 10, color: MUTED }}>{fmtDate(e.date)}</td>
                          <td style={{ padding: 10 }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ width: 8, height: 8, borderRadius: 99, background: PLATFORMS[e.platform].color }} />
                              {PLATFORMS[e.platform].name}
                            </span>
                          </td>
                          <td className="mono" style={{ padding: 10 }}>{fmtInt(e.views)}</td>
                          <td className="mono" style={{ padding: 10 }}>{fmtInt(e.followers)}</td>
                          <td style={{ padding: 10, display: "flex", gap: 10 }}>
                            <button onClick={() => startEdit(e)} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED }}><Pencil size={14} /></button>
                            <button onClick={() => deleteEntry(e.id)} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED }}><Trash2 size={14} /></button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/* ---------- tiny pieces ---------- */
function Field({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</span>
      {children}
    </div>
  );
}

const inputStyle = {
  background: "#0F0D1C", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "8px 10px",
  color: INK, fontSize: 13, height: 38,
};
const selectStyle = { ...inputStyle };
const btnPrimary = {
  display: "flex", alignItems: "center", gap: 6, justifyContent: "center",
  background: VIOLET, color: "#fff", border: "none", borderRadius: 10, padding: "9px 18px",
  fontSize: 13, fontWeight: 600, cursor: "pointer",
};
const btnGhost = {
  background: "transparent", color: MUTED, border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10,
  padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer",
};
