import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Clock3,
  ExternalLink,
  Globe2,
  LoaderCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { api } from "./api";
import type { CheckResult, MonitorState, Website } from "./types";

type Notice = { kind: "success" | "error"; text: string } | null;

function hostname(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function timeAgo(date: string | null) {
  if (!date) return "No checks yet";
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function displayTime(date: string) {
  return new Date(date).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StateBadge({ state }: { state: MonitorState }) {
  return (
    <span className={`state-badge state-${state}`}>
      <span className="state-dot" />
      {state}
    </span>
  );
}

function Brand() {
  return (
    <a className="brand" href="/" aria-label="RenderKeep home">
      <span className="brand-mark"><Activity size={19} strokeWidth={2.5} /></span>
      <span>render<span className="brand-light">keep</span></span>
    </a>
  );
}

function AddWebsiteModal({ onClose, onAdd, busy }: {
  onClose: () => void;
  onAdd: (url: string) => Promise<void>;
  busy: boolean;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await onAdd(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add this website.");
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal" aria-labelledby="add-title" role="dialog" aria-modal="true">
        <button className="icon-button modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button>
        <div className="modal-icon"><Globe2 size={21} /></div>
        <span className="eyebrow">NEW MONITOR</span>
        <h2 id="add-title">Add a website</h2>
        <p>Enter the full address you want us to keep an eye on. We’ll check it every five minutes.</p>
        <form onSubmit={submit}>
          <label htmlFor="website-url">Website URL</label>
          <div className="url-input-wrap"><span>https://</span><input
            id="website-url"
            autoFocus
            type="url"
            placeholder="example.com"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            required
          /></div>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="button button-quiet" onClick={onClose}>Cancel</button>
            <button className="button button-primary" disabled={busy}>
              {busy ? <LoaderCircle className="spin" size={17} /> : <><Plus size={17} /> Add website</>}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function WebsiteCard({ website, onCheck, onRemove, onHistory, checking, removing }: {
  website: Website;
  onCheck: () => void;
  onRemove: () => void;
  onHistory: () => void;
  checking: boolean;
  removing: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <article className="website-card">
      <div className="website-main">
        <span className="site-icon"><Globe2 size={19} /></span>
        <div className="site-copy">
          <a className="site-name" href={website.url} target="_blank" rel="noreferrer">
            {hostname(website.url)} <ExternalLink size={13} />
          </a>
          <span className="site-url">{website.url}</span>
        </div>
        <StateBadge state={website.current_state} />
      </div>
      <div className="website-metrics">
        <div className="metric"><span>HTTP STATUS</span><strong>{website.status_code ?? "—"}</strong></div>
        <div className="metric"><span>RESPONSE TIME</span><strong>{website.response_time_ms == null ? "—" : `${website.response_time_ms} ms`}</strong></div>
        <div className="metric metric-checked"><span>LAST CHECKED</span><strong>{timeAgo(website.last_checked_at)}</strong></div>
      </div>
      <div className="website-actions">
        <button className="button button-check" onClick={onCheck} disabled={checking || removing}>
          {checking ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />}
          Check now
        </button>
        <div className="menu-wrap">
          <button className="icon-button menu-trigger" aria-label="Website options" onClick={() => setMenuOpen(!menuOpen)}>
            <ChevronDown size={17} />
          </button>
          {menuOpen && <div className="action-menu">
            <button onClick={() => { setMenuOpen(false); onHistory(); }}><Clock3 size={15} /> View history</button>
            <button className="danger-action" disabled={removing} onClick={() => { setMenuOpen(false); onRemove(); }}><Trash2 size={15} /> Remove website</button>
          </div>}
        </div>
      </div>
    </article>
  );
}

function HistoryModal({ website, history, loading, onClose }: {
  website: Website;
  history: CheckResult[];
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal history-modal" role="dialog" aria-modal="true" aria-labelledby="history-title">
        <button className="icon-button modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button>
        <div className="history-heading">
          <span className="site-icon"><Globe2 size={19} /></span>
          <div><span className="eyebrow">CHECK HISTORY</span><h2 id="history-title">{hostname(website.url)}</h2></div>
        </div>
        {loading ? <div className="loading-history"><LoaderCircle className="spin" size={20} /> Loading check history…</div> :
          history.length === 0 ? <div className="history-empty">No checks have been recorded yet.</div> :
            <div className="history-list">{history.map((check) => (
              <div className="history-row" key={check.id}>
                <span className={`history-indicator history-${check.state}`} />
                <span className="history-date">{displayTime(check.checked_at)}</span>
                <StateBadge state={check.state} />
                <span className="history-code">{check.status_code ?? "—"}</span>
                <span className="history-latency">{check.response_time_ms == null ? "—" : `${check.response_time_ms} ms`}</span>
              </div>
            ))}</div>}
        <p className="history-caption">Showing the latest 100 checks.</p>
      </section>
    </div>
  );
}

export default function App() {
  const [websites, setWebsites] = useState<Website[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [checkingId, setCheckingId] = useState("");
  const [removingId, setRemovingId] = useState("");
  const [modal, setModal] = useState<"add" | null>(null);
  const [historySite, setHistorySite] = useState<Website | null>(null);
  const [history, setHistory] = useState<CheckResult[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const loadWebsites = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await api.list();
      setWebsites(result.websites);
    } catch (error) {
      if (!quiet) throw error;
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Could not refresh websites." });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadWebsites().catch((error) => {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Could not connect to RenderKeep." });
    });
  }, [loadWebsites]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const counts = useMemo(() => ({
    live: websites.filter((website) => website.current_state === "live").length,
    down: websites.filter((website) => website.current_state === "down").length,
    unknown: websites.filter((website) => website.current_state === "unknown").length,
  }), [websites]);

  async function addWebsite(url: string) {
    setAdding(true);
    try {
      const result = await api.add(url);
      setWebsites((current) => [result.website, ...current]);
      setModal(null);
      setNotice({ kind: "success", text: "Website added. Its first check is on the way." });
      api.check(result.website.id).then(({ result: check }) => {
        setWebsites((current) => current.map((site) => site.id === result.website.id
          ? { ...site, current_state: check.state, status_code: check.status_code, response_time_ms: check.response_time_ms, last_checked_at: check.checked_at }
          : site));
      }).catch((error) => setNotice({ kind: "error", text: error instanceof Error ? error.message : "The first check failed." }));
    } finally {
      setAdding(false);
    }
  }

  async function checkWebsite(website: Website) {
    setCheckingId(website.id);
    try {
      const { result } = await api.check(website.id);
      setWebsites((current) => current.map((site) => site.id === website.id
        ? { ...site, current_state: result.state, status_code: result.status_code, response_time_ms: result.response_time_ms, last_checked_at: result.checked_at }
        : site));
      setNotice({ kind: result.state === "down" ? "error" : "success", text: `${hostname(website.url)} is ${result.state}${result.status_code ? ` · HTTP ${result.status_code}` : ""}.` });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Could not check this website." });
    } finally {
      setCheckingId("");
    }
  }

  async function removeWebsite(website: Website) {
    if (!window.confirm(`Remove ${hostname(website.url)} and its check history?`)) return;
    setRemovingId(website.id);
    try {
      await api.remove(website.id);
      setWebsites((current) => current.filter((site) => site.id !== website.id));
      setNotice({ kind: "success", text: "Website and its history removed." });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Could not remove this website." });
    } finally {
      setRemovingId("");
    }
  }

  async function openHistory(website: Website) {
    setHistorySite(website);
    setHistory([]);
    setHistoryLoading(true);
    try {
      const result = await api.history(website.id);
      setHistory(result.history);
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Could not load check history." });
    } finally {
      setHistoryLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Brand />
          <div className="topbar-right">
            <span className="secure-label"><span className="secure-dot" /> Monitoring active</span>
          </div>
        </div>
      </header>
      <main className="dashboard">
        <section className="welcome-row">
          <div>
            <div className="eyebrow welcome-eyebrow"><span className="eyebrow-line" /> YOUR MONITORING WORKSPACE</div>
            <h1>Keep your websites <span>alive.</span></h1>
            <p className="welcome-subtitle">A little peace of mind, every five minutes.</p>
          </div>
          <button className="button button-primary add-top" onClick={() => setModal("add")}><Plus size={18} /> Add website</button>
        </section>

        <section className="overview" aria-label="Website monitoring summary">
          <div className="overview-intro"><span className="overview-icon"><Activity size={18} /></span><div><strong>Your overview</strong><span>Live snapshot across your websites</span></div></div>
          <div className="overview-stat"><span className="overview-stat-icon live-stat"><ArrowUpRight size={16} /></span><div><strong>{counts.live}</strong><span>Live</span></div></div>
          <div className="overview-stat"><span className="overview-stat-icon down-stat"><ArrowDownRight size={16} /></span><div><strong>{counts.down}</strong><span>Down</span></div></div>
          <div className="overview-stat"><span className="overview-stat-icon unknown-stat"><Clock3 size={15} /></span><div><strong>{counts.unknown}</strong><span>Unknown</span></div></div>
          <div className="overview-total"><strong>{websites.length}</strong><span>Total websites</span></div>
        </section>

        <section className="sites-section">
          <div className="section-heading">
            <div><h2>Your websites <span className="count-pill">{websites.length}</span></h2><p>We check every site automatically, so you don’t have to.</p></div>
            <button className="button button-quiet refresh-button" onClick={() => loadWebsites(true)} disabled={refreshing}>
              <RefreshCw className={refreshing ? "spin" : ""} size={15} /> Refresh
            </button>
          </div>
          {loading ? <div className="loading-state"><LoaderCircle className="spin" size={21} /><span>Loading your websites…</span></div> :
            websites.length === 0 ? <div className="empty-state">
              <div className="empty-art"><span className="empty-orbit orbit-one" /><span className="empty-orbit orbit-two" /><span className="empty-globe"><Globe2 size={30} /></span><span className="empty-spark spark-one"><Check size={13} /></span><span className="empty-spark spark-two"><Zap size={13} /></span></div>
              <span className="eyebrow">A CLEAR VIEW STARTS HERE</span>
              <h3>Your websites. All in one place.</h3>
              <p>Add a website URL, and RenderKeep will automatically check if it’s up every five minutes—even while your phone is off.</p>
              <button className="button button-primary empty-add" onClick={() => setModal("add")}><Plus size={17} /> Add your first website</button>
              <span className="empty-note"><ShieldCheck size={14} /> No code. Just paste a URL and you’re all set.</span>
            </div> :
              <div className="website-list">{websites.map((website) => <WebsiteCard
                key={website.id}
                website={website}
                checking={checkingId === website.id}
                removing={removingId === website.id}
                onCheck={() => checkWebsite(website)}
                onRemove={() => removeWebsite(website)}
                onHistory={() => openHistory(website)}
              />)}</div>}
        </section>
        <footer className="dashboard-footer">
          <div><span className="footer-pulse" /> <span>Checks run every <strong>5 minutes</strong></span><span className="footer-separator">·</span><span>in the cloud, while you’re away</span></div>
          <span>Made to keep things up.</span>
        </footer>
      </main>
      {notice && <div className={`toast toast-${notice.kind}`} role="status">{notice.kind === "success" ? <Check size={17} /> : <X size={17} />}{notice.text}</div>}
      {modal === "add" && <AddWebsiteModal onClose={() => setModal(null)} onAdd={addWebsite} busy={adding} />}
      {historySite && <HistoryModal website={historySite} history={history} loading={historyLoading} onClose={() => setHistorySite(null)} />}
    </div>
  );
}
