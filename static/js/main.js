const { useState, useRef, useCallback } = React;

function ScoreRing({ score, decision }) {
    const r = 26, circ = 2 * Math.PI * r;
    const dash = (score / 100) * circ;
    const color = decision === "CALIFICA" ? "#166534" : "#991b1b";
    const track = decision === "CALIFICA" ? "#dcfce7" : "#ffe4e6";
    return (
        <div style={{ position: "relative", width: 68, height: 68, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="68" height="68" style={{ transform: "rotate(-90deg)", position: "absolute" }}>
                <circle cx="34" cy="34" r={r} fill="none" stroke={track} strokeWidth="5" />
                <circle cx="34" cy="34" r={r} fill="none" stroke={color} strokeWidth="5"
                    strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
                    style={{ transition: "stroke-dasharray 1s ease" }} />
            </svg>
            <div style={{ textAlign: "center", zIndex: 1 }}>
                <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, color, lineHeight: 1 }}>{score}</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, color: "#b0b0b0", letterSpacing: 1.5, textTransform: "uppercase", marginTop: 2 }}>pts</div>
            </div>
        </div>
    );
}

function CandidateCard({ result, index, onRemove }) {
    const [open, setOpen] = useState(false);
    const isQ = result.decision === "CALIFICA";
    return (
        <div className={`card ${isQ ? "qualifies" : "no-qualify"}`}>
            <div className="card-header">
                <ScoreRing score={result.score} decision={result.decision} />
                <div className="card-meta">
                    <div className="card-meta-top">
                        <span className="candidate-index">#{String(index + 1).padStart(2, "0")}</span>
                        <span className={`badge ${isQ ? "badge-q" : "badge-nq"}`}>{result.decision}</span>
                    </div>
                    <div className="candidate-name">{result.name || "Candidato"}</div>
                    {result.filename && <div className="candidate-filename">&#8627; {result.filename}</div>}
                    <div className="candidate-summary">{result.summary}</div>
                </div>
                <button className="card-remove" onClick={onRemove} title="Eliminar">&#10005;</button>
            </div>
            <div className="card-tags">
                {result.strengths && result.strengths.map((s, i) => (
                    <span key={"s" + i} className="badge badge-s">&#10003; {s}</span>
                ))}
                {result.weaknesses && result.weaknesses.map((w, i) => (
                    <span key={"w" + i} className="badge badge-w">&#8599; {w}</span>
                ))}
            </div>
            <button className="card-toggle" onClick={() => setOpen(!open)}>
                {open ? "Ocultar razonamiento" : "Ver razonamiento"}
            </button>
            {open && <div className="card-reasoning">{result.reasoning}</div>}
        </div>
    );
}

function DropZone({ accept, icon, title, hint, file, onFile, dragging, onDragOver, onDragLeave, onDrop, inputRef }) {
    return (
        <div
            className={"drop-zone" + (dragging ? " drag-over" : "") + (file ? " has-file" : "")}
            onClick={() => inputRef.current.click()}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
            <div className="dz-icon">{file ? "\u2713" : icon}</div>
            <div className="dz-title">{file ? file.name : title}</div>
            <div className="dz-hint">{file ? "clic para cambiar" : hint}</div>
            <input ref={inputRef} type="file" accept={accept} hidden onChange={e => onFile(e.target.files[0])} />
        </div>
    );
}

function HRAgent() {
    const [tab, setTab] = useState("analyze");
    const [requirements, setRequirements] = useState("");
    const [reqFile, setReqFile] = useState(null);
    const [resumeFile, setResumeFile] = useState(null);
    const [candidates, setCandidates] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [reqDrag, setReqDrag] = useState(false);
    const [cvDrag, setCvDrag] = useState(false);
    const reqInputRef = useRef();
    const cvInputRef = useRef();

    async function handleReqFile(file) {
        if (!file || !file.name.endsWith(".txt")) { setError("Los requisitos deben ser un archivo .txt"); return; }
        const fd = new FormData();
        fd.append("file", file);
        try {
            const res = await fetch("/api/load-requirements", { method: "POST", body: fd });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setRequirements(data.text);
            setReqFile(file);
            setError("");
        } catch (e) { setError(e.message); }
    }

    function handleCvFile(file) {
        if (!file || !file.name.toLowerCase().endsWith(".pdf")) { setError("El CV debe ser un archivo PDF"); return; }
        setResumeFile(file);
        setError("");
    }

    const onDrop = useCallback((e, type) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (type === "req") { handleReqFile(file); setReqDrag(false); }
        else { handleCvFile(file); setCvDrag(false); }
    }, []);

    async function handleAnalyze() {
        if (!resumeFile) { setError("Adjunta el CV en PDF del candidato."); return; }
        if (!requirements.trim()) { setError("Carga primero los requisitos del puesto (.txt)."); return; }
        setError(""); setLoading(true);
        try {
            const fd = new FormData();
            fd.append("resume", resumeFile);
            fd.append("requirements", requirements);
            const res = await fetch("/api/analyze", { method: "POST", body: fd });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setCandidates(prev => [{ ...data, id: Date.now() }, ...prev]);
            setResumeFile(null);
            setTab("candidates");
        } catch (e) { setError(e.message || "Error al analizar."); }
        finally { setLoading(false); }
    }

    const sorted = [...candidates].sort((a, b) => b.score - a.score);
    const qualified = candidates.filter(c => c.decision === "CALIFICA").length;
    const avgScore = candidates.length ? Math.round(candidates.reduce((a, c) => a + c.score, 0) / candidates.length) : 0;
    const canAnalyze = resumeFile && requirements.trim() && !loading;

    const steps = [
        ["01", "Carga el archivo .txt con los requisitos del puesto"],
        ["02", "Adjunta el PDF del curriculo del candidato"],
        ["03", "El agente extrae y evalua el contenido automaticamente"],
        ["04", "Repite para comparar multiples candidatos"],
    ];

    const statsData = [
        { label: "Evaluados", value: candidates.length, color: "var(--ink)" },
        { label: "Califican", value: qualified, color: "var(--green)" },
        { label: "No califican", value: candidates.length - qualified, color: "var(--red)" },
        { label: "Score prom.", value: avgScore, color: "var(--amber)" },
    ];

    return (
        <div className="app">
            <header className="header">
                <div className="logo-lockup">
                    <div className="logo-wordmark">HR <em>Agent</em></div>
                    <div className="logo-sub">Candidate Analysis System</div>
                </div>
                <nav className="tabs">
                    <button className={"tab" + (tab === "analyze" ? " active" : "")} onClick={() => setTab("analyze")}>Analizar CV</button>
                    <button className={"tab" + (tab === "candidates" ? " active" : "")} onClick={() => setTab("candidates")}>
                        {"Candidatos" + (candidates.length > 0 ? " (" + candidates.length + ")" : "")}
                    </button>
                </nav>
            </header>

            {tab === "analyze" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
                    <div className="grid-2">
                        <div className="field">
                            <div className="section-label">Requisitos del Puesto</div>
                            <DropZone accept=".txt" icon="&#128203;" title="Arrastra o selecciona el archivo" hint=".txt - requisitos del puesto"
                                file={reqFile} onFile={handleReqFile} dragging={reqDrag}
                                onDragOver={e => { e.preventDefault(); setReqDrag(true); }}
                                onDragLeave={() => setReqDrag(false)}
                                onDrop={e => onDrop(e, "req")} inputRef={reqInputRef} />
                            {reqFile && (
                                <div className="req-loaded">
                                    <span>&#10003;</span>
                                    <span>{reqFile.name} cargado correctamente</span>
                                </div>
                            )}
                            <textarea value={requirements} onChange={e => setRequirements(e.target.value)}
                                rows={reqFile ? 7 : 9} placeholder="O escribe los requisitos directamente aqui..." />
                        </div>

                        <div className="field">
                            <div className="section-label">CV del Candidato</div>
                            <DropZone accept=".pdf" icon="&#128196;" title="Arrastra o selecciona el CV" hint=".pdf - curriculum vitae"
                                file={resumeFile} onFile={handleCvFile} dragging={cvDrag}
                                onDragOver={e => { e.preventDefault(); setCvDrag(true); }}
                                onDragLeave={() => setCvDrag(false)}
                                onDrop={e => onDrop(e, "cv")} inputRef={cvInputRef} />
                            <div style={{ border: "1px solid var(--rule)", borderRadius: "var(--r)", padding: "16px 18px", background: "var(--surface)", fontSize: 12.5, color: "var(--ink-4)", lineHeight: 1.9 }}>
                                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: "var(--ink-4)", marginBottom: 10 }}>Flujo de trabajo</div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    {steps.map(item => (
                                        <div key={item[0]} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                                            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--rule-2)", letterSpacing: 1, paddingTop: 2, flexShrink: 0 }}>{item[0]}</span>
                                            <span style={{ color: "var(--ink-3)" }}>{item[1]}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {error && <div className="error-box">{error}</div>}

                    <button className="btn btn-primary" onClick={handleAnalyze} disabled={!canAnalyze}>
                        {loading
                            ? <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}><span className="spinner" />Analizando candidato...</span>
                            : "Analizar Candidato \u2192"
                        }
                    </button>
                </div>
            )}

            {tab === "candidates" && (
                <div>
                    {candidates.length > 0 && (
                        <div className="stats">
                            {statsData.map(s => (
                                <div key={s.label} className="stat">
                                    <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                                    <div className="stat-label">{s.label}</div>
                                </div>
                            ))}
                        </div>
                    )}
                    {candidates.length === 0 ? (
                        <div className="empty">
                            <div className="empty-icon">&#8212;</div>
                            <div className="empty-title">Sin candidatos evaluados</div>
                            <div className="empty-sub">Analiza CVs en la seccion <strong>Analizar CV</strong></div>
                        </div>
                    ) : (
                        <div className="candidates">
                            {sorted.map((c, i) => (
                                <CandidateCard key={c.id} result={c} index={i}
                                    onRemove={() => setCandidates(prev => prev.filter(x => x.id !== c.id))} />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

ReactDOM.createRoot(document.getElementById("root")).render(<HRAgent />);