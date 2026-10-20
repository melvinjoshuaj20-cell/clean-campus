import { useEffect, useState } from "react";
import { supabase, signInWithGoogle } from "./supabase";
import { useTheme } from "./useTheme";
import { compress } from "./image";
import MapPicker from "./MapPicker";

const ts = (r) => r.created_at ? new Date(r.created_at).getTime() : Date.now();
const fmt = (r) => new Date(ts(r)).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

function Header({ theme, toggle, user }) {
  return (
    <header className="header">
      <span className="brand">Clean Campus</span>
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
          <h1>Spot waste. Report it.</h1>
          <p className="muted" style={{ margin: "8px 0 20px" }}>
            Mark litter on the campus map and the management will get it cleaned.
          </p>
          <button
            className="btn primary block"
            onClick={() => signInWithGoogle().catch((e) => setErr(e.message))}
          >
            Continue with Google
          </button>
          {err && <p className="msg err">{err}</p>}
        </div>
      </div>
    </div>
  );
}

function Reporter({ user, theme, toggle }) {
  const [tab, setTab] = useState("report");
  const [pos, setPos] = useState(null);
  const [note, setNote] = useState("");
  const [imgs, setImgs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ text: "", err: false });
  const [mine, setMine] = useState([]);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data, error } = await supabase.from("reports").select("*").order("created_at", { ascending: false });
      if (active && !error) setMine(data || []);
    }
    load();
    const channel = supabase.channel(`student-reports-${user.id}`).on("postgres_changes", { event: "*", schema: "public", table: "reports" }, load).subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, [user.id]);

  async function addPhotos(e) {
    const files = [...e.target.files].slice(0, 2 - imgs.length);
    e.target.value = "";
    try {
      const out = await Promise.all(files.map((f) => compress(f)));
      setImgs((p) => [...p, ...out.map((blob) => ({ blob, preview: URL.createObjectURL(blob) }))].slice(0, 2));
    } catch {
      setMsg({ text: "Could not read that photo.", err: true });
    }
  }

  async function submit() {
    if (!pos) return;
    setBusy(true);
    setMsg({ text: "", err: false });
    try {
      const urls = [];
      for (const item of imgs) {
        const blob = item.blob;
        const path = `${user.id}/${crypto.randomUUID()}.jpg`;
        const { error: uploadError } = await supabase.storage.from("report-images").upload(path, blob, { contentType: "image/jpeg" });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("report-images").getPublicUrl(path);
        urls.push(urlData.publicUrl);
      }
      const { error } = await supabase.from("reports").insert({
        lat: pos[0], lng: pos[1], note: note.trim(), image_urls: urls,
        user_name: user.user_metadata?.full_name || "", user_email: user.email || "",
      });
      if (error) throw error;
      setPos(null);
      setNote("");
      imgs.forEach((item) => URL.revokeObjectURL(item.preview));
      setImgs([]);
      setMsg({ text: "Sent. The management has been notified.", err: false });
      setTab("mine");
    } catch (e) {
      setMsg({ text: "Could not send. Check your connection and try again.", err: true });
    }
    setBusy(false);
  }

  return (
    <div className="app">
      <Header theme={theme} toggle={toggle} user={user} />
      <div className="main">
        <MapPicker value={pos} onChange={setPos} reports={mine} theme={theme} />
        <aside className="panel">
          <div className="tabs">
            <button className={`tab ${tab === "report" ? "active" : ""}`} onClick={() => setTab("report")}>Report</button>
            <button className={`tab ${tab === "mine" ? "active" : ""}`} onClick={() => setTab("mine")}>
              My reports{mine.length ? ` (${mine.length})` : ""}
            </button>
          </div>

          {tab === "report" && (
            <>
              <p className="coords">
                {pos ? `Spot selected (${pos[0].toFixed(5)}, ${pos[1].toFixed(5)})` : "Tap the map to mark where the waste is."}
              </p>
              <label className="field">
                <textarea
                  placeholder="What is it? (optional)"
                  value={note}
                  maxLength={300}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
              <div className="field">
                {imgs.length < 2 && (
                  <label className="btn" style={{ display: "inline-block" }}>
                    Add photo
                    <input type="file" accept="image/*" multiple hidden onChange={addPhotos} />
                  </label>
                )}
                <span className="hint" style={{ marginLeft: 10 }}>Up to 2</span>
                {imgs.length > 0 && (
                  <div className="thumbs">
                    {imgs.map((src, i) => (
                      <div className="thumb" key={i}>
                        <img src={src.preview} alt="" />
                        <button onClick={() => setImgs(imgs.filter((_, j) => j !== i))} aria-label="Remove photo">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button className="btn primary block" disabled={!pos || busy} onClick={submit}>
                {busy ? "Sending…" : "Send report"}
              </button>
              {msg.text && <p className={`msg ${msg.err ? "err" : ""}`}>{msg.text}</p>}
            </>
          )}

          {tab === "mine" && (
            <>
              {msg.text && !msg.err && <p className="msg" style={{ marginBottom: 8 }}>{msg.text}</p>}
              {mine.length === 0 && <p className="empty">You haven't reported anything yet.</p>}
              {mine.map((r) => (
                <div className="item" key={r.id}>
                  <div className="item-top">
                    <span><span className={`dot ${r.status}`} />{r.status === "cleaned" ? "Cleaned" : "Waiting"}</span>
                    <span>{fmt(r)}</span>
                  </div>
                  {r.note && <p className="item-note">{r.note}</p>}
                  {r.image_urls?.map((src, i) => <img key={i} src={src} alt="" />)}
                </div>
              ))}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

export default function App() {
  const [theme, toggle] = useTheme();
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (user === undefined) return <div className="center muted">Loading…</div>;
  if (!user) return <Login theme={theme} toggle={toggle} />;
  return <Reporter user={user} theme={theme} toggle={toggle} />;
}
