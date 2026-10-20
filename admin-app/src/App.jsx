import { useEffect, useMemo, useState } from "react";
import { supabase, signInWithGoogle } from "./supabase";
import { useTheme } from "./useTheme";
import AdminMap from "./AdminMap";

const ts = (r) => r.created_at ? new Date(r.created_at).getTime() : Date.now();
const fmt = (r) => new Date(ts(r)).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

function Header({ theme, toggle, user, openCount }) {
  return (
    <header className="header">
      <span className="brand">
        Clean Campus · Admin
        {openCount > 0 && <span className="badge">{openCount}</span>}
      </span>
      <div className="header-right">
        <button className="link" onClick={toggle}>{theme === "dark" ? "Light" : "Dark"}</button>
        {user && <button className="link" onClick={() => supabase.auth.signOut()}>Sign out</button>}
      </div>
    </header>
  );
}

function Login({ theme, toggle }) {
  const [err, setErr] = useState("");
  return (
    <div className="app">
      <Header theme={theme} toggle={toggle} />
      <div className="center">
        <div className="login-box">
          <h1>Management sign in</h1>
          <p className="muted" style={{ margin: "8px 0 20px" }}>Only approved staff accounts can open the dashboard.</p>
          <button className="btn primary block" onClick={() => signInWithGoogle().catch((e) => setErr(e.message))}>
            Continue with Google
          </button>
          {err && <p className="msg err">{err}</p>}
        </div>
      </div>
    </div>
  );
}

function NoAccess({ user, theme, toggle }) {
  return (
    <div className="app">
      <Header theme={theme} toggle={toggle} user={user} />
      <div className="center">
        <h1>No access</h1>
        <p className="muted">{user.email} is not on the management list.</p>
      </div>
    </div>
  );
}

function Detail({ r, onClose, onZoom, userEmail }) {
  const [busy, setBusy] = useState(false);
  const cleaned = r.status === "cleaned";

  async function setStatus(status) {
    setBusy(true);
    try {
      const { error } = await supabase.rpc("set_report_status", { report_id: r.id, new_status: status });
      if (error) throw error;
    } catch {
      alert("Update failed. Check your permissions.");
    }
    setBusy(false);
  }

  async function remove() {
    if (!confirm("Delete this report permanently?")) return;
    try {
      const { error } = await supabase.from("reports").delete().eq("id", r.id);
      if (error) throw error;
      onClose();
    } catch {
      alert("Delete failed.");
    }
  }

  return (
    <div className="detail">
      <div className="item-top">
        <span><span className={`dot ${r.status}`} />{cleaned ? "Cleaned" : "Needs cleaning"}</span>
        <button className="link" style={{ padding: 0 }} onClick={onClose}>Close</button>
      </div>
      <p className="item-note">{r.note || <span className="muted">No description</span>}</p>
      {r.image_urls?.length > 0 && (
        <div className="photos">
          {r.image_urls.map((src, i) => <img key={i} src={src} alt="" onClick={() => onZoom(src)} />)}
        </div>
      )}
      <p className="meta">
        {fmt(r)} · {r.user_name || r.user_email}<br />
        {Number(r.lat).toFixed(5)}, {Number(r.lng).toFixed(5)} ·{" "}
        <a href={`https://www.google.com/maps?q=${r.lat},${r.lng}`} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
          Open in Google Maps
        </a>
      </p>
      <div className="actions">
        {cleaned ? (
          <button className="btn" disabled={busy} onClick={() => setStatus("open")}>Reopen</button>
        ) : (
          <button className="btn primary" disabled={busy} onClick={() => setStatus("cleaned")}>Mark cleaned</button>
        )}
        <button className="btn danger" onClick={remove}>Delete</button>
      </div>
    </div>
  );
}

function Dashboard({ user, theme, toggle }) {
  const [reports, setReports] = useState([]);
  const [filter, setFilter] = useState("open");
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState("list");
  const [zoom, setZoom] = useState(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data, error } = await supabase.from("reports").select("*").order("created_at", { ascending: false });
      if (active && !error) setReports(data || []);
    }
    load();
    const channel = supabase.channel("admin-reports").on("postgres_changes", { event: "*", schema: "public", table: "reports" }, load).subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, []);

  const openCount = reports.filter((r) => r.status === "open").length;
  useEffect(() => {
    document.title = openCount ? `(${openCount}) Clean Campus Admin` : "Clean Campus Admin";
  }, [openCount]);

  const shown = useMemo(
    () => reports.filter((r) => filter === "all" || r.status === filter),
    [reports, filter]
  );
  const sel = reports.find((r) => r.id === selected);

  function pick(id) {
    setSelected(id);
    if (window.innerWidth < 800) setView("list");
  }

  return (
    <div className="app">
      <Header theme={theme} toggle={toggle} user={user} openCount={openCount} />
      <div className={`main admin view-${view}`}>
        <AdminMap reports={shown} selectedId={selected} onSelect={pick} theme={theme} visible={view === "map"} />
        <aside className="sidebar">
          <div className="toolbar">
            <div className="tabs" style={{ margin: 0, border: "none", flex: 1 }}>
              {[["open", "Open"], ["cleaned", "Cleaned"], ["all", "All"]].map(([k, label]) => (
                <button key={k} className={`tab ${filter === k ? "active" : ""}`} onClick={() => setFilter(k)}>{label}</button>
              ))}
            </div>
            <div className="view-switch">
              <button className="tab" onClick={() => setView("map")}>Map</button>
            </div>
          </div>
          {sel && <Detail r={sel} onClose={() => setSelected(null)} onZoom={setZoom} userEmail={user.email} />}
          {shown.length === 0 && <p className="empty">Nothing here.</p>}
          {shown.map((r) => (
            <div key={r.id} className={`row ${r.id === selected ? "sel" : ""}`} onClick={() => pick(r.id)}>
              <div className="item-top">
                <span><span className={`dot ${r.status}`} />{r.status === "cleaned" ? "Cleaned" : "Open"}</span>
                <span>{fmt(r)}</span>
              </div>
              <p className="item-note">{r.note || <span className="muted">No description</span>}</p>
            </div>
          ))}
        </aside>
        {view === "list" && (
          <button className="locate" style={{ top: "auto", bottom: 16, left: "50%", transform: "translateX(-50%)", display: window.innerWidth < 800 ? "block" : "none" }} onClick={() => setView("map")}>
            Show map
          </button>
        )}
      </div>
      {zoom && (
        <div className="lightbox" onClick={() => setZoom(null)}>
          <img src={zoom} alt="" />
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [theme, toggle] = useTheme();
  const [user, setUser] = useState(undefined);
  const [isAdmin, setIsAdmin] = useState(null);

  useEffect(() => {
    let active = true;
    async function check(u) {
      setUser(u); setIsAdmin(null);
      if (!u) return;
      const { data, error } = await supabase.from("admins").select("email").maybeSingle();
      if (active) setIsAdmin(!error && !!data);
    }
    supabase.auth.getSession().then(({ data }) => check(data.session?.user ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => check(session?.user ?? null));
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  if (user === undefined || (user && isAdmin === null)) return <div className="center muted">Loading…</div>;
  if (!user) return <Login theme={theme} toggle={toggle} />;
  if (!isAdmin) return <NoAccess user={user} theme={theme} toggle={toggle} />;
  return <Dashboard user={user} theme={theme} toggle={toggle} />;
}
