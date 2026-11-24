// Insight Hub front end. Plain JavaScript, no build step: each view is a function that returns a <section>.
const VIEWS = [
  { id: "personas", label: "Personas" },
  { id: "journeys", label: "Journey maps" },
  { id: "rice", label: "RICE prioritization" },
  { id: "backlog", label: "Backlog" },
  { id: "evidence", label: "Evidence & coverage" },
  { id: "ask", label: "Ask the interviews" },
  { id: "process", label: "Process" },
  { id: "settings", label: "Settings" },
];
const DATA_VIEWS = new Set(["personas", "journeys", "rice", "backlog", "evidence", "ask"]);
const STATUSES = [
  { id: "discovered", label: "Discovered" }, { id: "validated", label: "Validated" }, { id: "prioritized", label: "Prioritized" },
  { id: "backlog", label: "In backlog" }, { id: "in_progress", label: "In progress" }, { id: "shipped", label: "Shipped" }, { id: "measured", label: "Validated after launch" }];
const BOARD = ["backlog", "in_progress", "shipped", "measured"];
const IMPACT = [[0.25, "0.25 minimal"], [0.5, "0.5 low"], [1, "1 medium"], [2, "2 high"], [3, "3 massive"]];
const CONF = [[0.5, "50%"], [0.8, "80%"], [1, "100%"]];
const KANO = [["must", "Must-have"], ["performance", "Performance"], ["delighter", "Delighter"], ["indifferent", "Indifferent"]];
const ROWS = [["pains", "Pain points"], ["jobs", "Jobs to be done"], ["tools", "Existing tools & workarounds"], ["our_flow", "Flow with our product"], ["features", "Features to implement"]];
const TYPES = ["pain", "job", "need", "workaround", "tool", "feature_request", "wtp", "praise", "objection"];
const NO_ANSWER = "NO_INTERVIEW_ANSWER";
const NO_ANSWER_TEXT = "The interviews don't answer this. If you want an answer from outside the interviews, ask again and say so, e.g. \"look beyond the interviews\".";

const S = {
  cfg: null, kb: null, view: "personas", persona: "all", product: "all", jp: null, sols: new Map(),
  riceSort: { k: "score", d: -1 }, riceStatus: "all", riceQ: "", chat: [], asking: null,
  tax: null, transcripts: [], job: null, demo: false, wiz: null, pending: false,
};
const nugIndex = new Map(), srcIndex = new Map();
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const personaIdx = (id) => S.kb?.personas.findIndex((p) => p.id === id) ?? -1;
const pc = (id) => { const i = personaIdx(id); return i < 0 ? "var(--muted)" : `var(--p${i % 6})`; };
const pShort = (id) => { const p = S.kb?.personas.find((x) => x.id === id); return p ? p.short || p.name : id; };
const products = () => [...(S.kb?.products || []), ...((S.kb?.products || []).length > 1 ? [{ id: "cross", label: "Cross-product" }] : [])];
const prodLabel = (id) => products().find((p) => p.id === id)?.label || id;
const stLabel = (id) => STATUSES.find((s) => s.id === id)?.label || id;
const score = (s) => { const e = Number(s.effort) || 0; return e > 0 ? ((Number(s.reach) || 0) * (Number(s.impact) || 0) * (Number(s.confidence) || 0)) / e : 0; };
const fmt = (n) => (Math.round(n * 10) / 10).toLocaleString("en", { maximumFractionDigits: 1 });
const stageTitle = (id) => { for (const p of Object.values(S.kb?.stages || {})) { const s = p.find((x) => x.id === id); if (s) return s.title; } return id || "—"; };

function toast(msg) { const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.append(t); setTimeout(() => t.remove(), 2600); }

async function api(path, { method = "GET", body, signal } = {}) {
  const r = await fetch(path, { method, signal, headers: body !== undefined ? { "Content-Type": "application/json" } : {}, body: body !== undefined ? JSON.stringify(body) : undefined });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(data?.error || `Request failed (${r.status})`);
  return data;
}

// ---------- data ----------
async function loadKb() {
  try { S.kb = await api("/api/kb"); } catch { S.kb = null; }
  nugIndex.clear(); srcIndex.clear(); S.sols = new Map();
  if (!S.kb) return;
  for (const s of S.kb.sources) srcIndex.set(s.id, s);
  for (const n of S.kb.nuggets) nugIndex.set(n.id, n);
  for (const s of S.kb.solutions) S.sols.set(s.id, { ...s, log: s.log || [] });
  if (!S.kb.personas.some((p) => p.id === S.jp)) S.jp = S.kb.personas[0]?.id;
  if (S.persona !== "all" && !S.kb.personas.some((p) => p.id === S.persona)) S.persona = "all";
}
async function loadProcess() {
  const [t, tax, job, demo] = await Promise.all([api("/api/transcripts").catch(() => []), api("/api/taxonomy").catch(() => null), api("/api/pipeline/status").catch(() => null), api("/api/demo").catch(() => ({}))]);
  S.transcripts = t; S.tax = tax; S.job = job; S.demo = demo.available;
}

async function boot() {
  S.cfg = await api("/api/config");
  if (!S.cfg.setupDone) { S.wiz = { step: 0, draft: { ...S.cfg } }; return renderWizard(); }
  await Promise.all([loadKb(), loadProcess()]);
  const h = location.hash.slice(1);
  S.view = VIEWS.some((v) => v.id === h) ? h : S.kb ? "personas" : "process";
  if (S.job?.running) pollJob();
  renderChrome(); render();
}

function updateMeta() {
  $("#title").textContent = S.kb?.product?.name ? `${S.kb.product.name} · Insight Hub` : "Insight Hub";
  $("#meta").textContent = S.kb ? `${S.kb.sources.length} interviews · ${S.kb.nuggets.length} tagged quotes · built ${S.kb.generated}` : "No knowledge base yet: process your transcripts first";
}

// one write at a time per feature
const queues = new Map();
function write(id, patch, what) {
  const cur = S.sols.get(id) || {};
  const log = [{ at: new Date().toISOString(), what }, ...(cur.log || [])].slice(0, 40);
  S.sols.set(id, { ...cur, id, ...patch, log }); render();
  const prev = queues.get(id) || Promise.resolve();
  queues.set(id, prev.then(() => api("/api/solutions", { method: "POST", body: { id, patch, what } })).catch((e) => toast(`Couldn't save: ${e.message}`)));
}

// ---------- chrome ----------
function matchPersona(list) { return S.persona === "all" || (list || []).includes(S.persona); }
function visibleSols() { return [...S.sols.values()].filter((s) => matchPersona(s.personas) && (S.product === "all" || s.product === S.product)); }

function go(view) { S.view = view; try { history.replaceState(null, "", "#" + view); } catch {} renderChrome(); render(); }

function renderChrome() {
  $("#top").hidden = false;
  updateMeta();
  const tabs = $("#tabs"); tabs.innerHTML = "";
  for (const v of VIEWS) {
    const b = document.createElement("button"); b.className = "tab"; b.role = "tab";
    b.setAttribute("aria-selected", S.view === v.id); b.textContent = v.label;
    b.onclick = () => go(v.id);
    tabs.append(b);
  }
  const f = $("#filters");
  if (!S.kb || !DATA_VIEWS.has(S.view)) { f.innerHTML = ""; f.hidden = true; return; }
  f.hidden = false;
  const pers = [{ id: "all", label: "All personas" }, ...S.kb.personas.map((p) => ({ id: p.id, label: pShort(p.id), c: pc(p.id) }))];
  const prods = products();
  f.innerHTML = `<div class="fgroup" aria-label="Persona filter"><span class="label">Persona</span>${pers.map((p) => `<button class="chip" data-p="${esc(p.id)}" aria-pressed="${S.persona === p.id}">${p.c ? `<span class="dot" style="background:${p.c}"></span>` : ""}${esc(p.label)}</button>`).join("")}</div>
  ${prods.length > 1 ? `<div class="fgroup" aria-label="Product filter"><span class="label">Product</span>${[{ id: "all", label: "All products" }, ...prods].map((p) => `<button class="chip" data-pr="${esc(p.id)}" aria-pressed="${S.product === p.id}">${esc(p.label)}</button>`).join("")}</div>` : ""}`;
  f.querySelectorAll("[data-p]").forEach((b) => (b.onclick = () => { S.persona = b.dataset.p; if (S.persona !== "all") S.jp = S.persona; renderChrome(); render(); }));
  f.querySelectorAll("[data-pr]").forEach((b) => (b.onclick = () => { S.product = b.dataset.pr; renderChrome(); render(); }));
}

function render() {
  const m = $("#main");
  const keep = S.view === "ask" ? $("#ask-input")?.value : null;
  const ae = document.activeElement;
  // don't wipe a field the user is typing in; render once they leave it
  if (ae && m.contains(ae) && (ae.tagName === "TEXTAREA" || (ae.tagName === "INPUT" && !["checkbox", "radio"].includes(ae.type))) && ae.dataset.live !== "1") { S.pending = true; return; }
  const refocus = ae?.id === "ask-input";
  const fn = { personas: vPersonas, journeys: vJourneys, rice: vRice, backlog: vBacklog, evidence: vEvidence, ask: vAsk, process: vProcess, settings: vSettings }[S.view];
  m.innerHTML = "";
  m.append(DATA_VIEWS.has(S.view) && !S.kb ? vEmpty() : fn());
  if (keep != null && $("#ask-input")) { $("#ask-input").value = keep; if (refocus) $("#ask-input").focus(); }
}
document.addEventListener("focusout", () => setTimeout(() => { if (S.pending && !$("#overlay").innerHTML) { S.pending = false; render(); } }, 0));

function section(html) { const sec = document.createElement("section"); sec.className = "view"; sec.innerHTML = html; return sec; }

function vEmpty() {
  const sec = section(`<div class="panel empty"><h2>No knowledge base yet</h2><p class="muted" style="max-width:56ch;margin:0">Process your interview transcripts first. Claude tags every quote, then builds personas, journey maps and a RICE-ranked feature list from them.</p><button class="btn primary" id="to-process">Go to Process</button></div>`);
  sec.querySelector("#to-process").onclick = () => go("process");
  return sec;
}

// ---------- evidence drawer ----------
function quoteHTML(id, side) {
  const n = nugIndex.get(id); if (!n) return "";
  const s = srcIndex.get(n.source) || {};
  return `<div class="quote ${side}">
    ${n.quote ? `<blockquote>“${esc(n.quote)}”</blockquote>` : ""}
    <div class="q-ins">${esc(n.text)}</div>
    <div class="q-meta"><b>${esc(s.interviewee || n.source)}</b><span>${esc([s.role, s.company].filter(Boolean).join(", "))}</span><span class="mono">${esc(s.date || "")}</span>
    <span class="badge ${esc(n.strength)}">${esc(n.strength || "")}</span>${n.quote_kind && n.quote_kind !== "verbatim" ? `<span class="badge">${esc(n.quote_kind)}</span>` : ""}<span class="mono">${esc(n.id)}</span></div></div>`;
}
function openDrawer(html, onMount) {
  const o = $("#overlay");
  o.innerHTML = `<div class="scrim" id="scrim"></div><aside class="drawer" role="dialog" aria-modal="true">${html}</aside>`;
  $("#scrim").onclick = closeDrawer;
  o.querySelector("[data-close]")?.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", escClose);
  onMount?.(o);
  o.querySelector("[data-close]")?.focus();
}
function escClose(e) { if (e.key === "Escape") closeDrawer(); }
function closeDrawer() { $("#overlay").innerHTML = ""; document.removeEventListener("keydown", escClose); if (S.pending) { S.pending = false; render(); } }
function openEvidence(title, kicker, forIds = [], againstIds = [], extra = "") {
  const f = forIds.filter((id) => nugIndex.has(id)), a = againstIds.filter((id) => nugIndex.has(id));
  openDrawer(`<div class="dhead"><div><div class="label">${esc(kicker)}</div><h3>${esc(title)}</h3></div><button class="btn small" data-close>Close</button></div>
  <div class="dbody">${extra}
   <div class="qcol"><h4><span class="dot" style="background:var(--for)"></span>Quotes for <span class="mono muted">${f.length}</span></h4>${f.map((id) => quoteHTML(id, "for")).join("") || `<p class="muted">No supporting quotes yet.</p>`}</div>
   <div class="qcol"><h4><span class="dot" style="background:var(--against)"></span>Quotes against <span class="mono muted">${a.length}</span></h4>${a.map((id) => quoteHTML(id, "against")).join("") || `<p class="muted">Nobody contradicted this in the interviews so far.</p>`}</div>
  </div>`);
}
function tally(f = [], a = []) { return `<span class="tally"><span class="f">▲${f.length}</span><span class="a">▼${a.length}</span></span>`; }

// ---------- personas ----------
function vPersonas() {
  const ps = S.kb.personas.filter((p) => S.persona === "all" || p.id === S.persona);
  const sec = section(`<div class="view-head"><div><h2>Personas</h2><p>Who we interviewed, what they are trying to get done, and how much evidence backs each persona. Click any job to see the quotes for and against it.</p></div></div>
  <div class="persona-grid">${ps.map((p) => {
    const srcs = (p.sources || []).map((id) => srcIndex.get(id)).filter(Boolean);
    const nCount = S.kb.nuggets.filter((n) => n.persona === p.id).length;
    return `<article class="panel persona" style="--pc:${pc(p.id)}">
      <div class="who"><div><h3>${esc(p.name)}</h3><div class="tag">${esc(p.tagline)}</div></div><span class="ev ${esc(p.evidence_level)}" title="${esc(p.evidence_note)}">${esc(p.evidence_level)} evidence</span></div>
      ${p.description ? `<p style="margin:0">${esc(p.description)}</p>` : ""}
      ${p.evidence_level !== "strong" && p.evidence_note ? `<div class="notice">${esc(p.evidence_note)}</div>` : ""}
      <div class="two"><div><div class="label">Goals</div><ul class="plain">${(p.goals || []).map((g) => `<li>${esc(g)}</li>`).join("")}</ul></div>
      <div><div class="label">Frustrations</div><ul class="plain">${(p.frustrations || []).map((g) => `<li>${esc(g)}</li>`).join("")}</ul></div></div>
      <div><div class="label">Jobs to be done</div><div class="jobs">${(p.jobs || []).map((j) => `<button class="job" data-job="${esc(j.id)}"><span class="imp" title="Importance ${j.importance}/3">${[1, 2, 3].map((i) => `<i class="${i <= j.importance ? "on" : ""}"></i>`).join("")}</span><span>${esc(j.statement)}<br><span class="muted" style="font-size:12px">${esc(stageTitle(j.stage))}</span></span>${tally(j.for, j.against)}</button>`).join("")}</div></div>
      <div class="two"><div><div class="label">Interviewees · ${srcs.length}</div><div class="people">${srcs.map((s) => `<span class="person" title="${esc(s.summary)}">${esc(s.interviewee)}${s.company ? ` · ${esc(s.company)}` : ""}</span>`).join("") || `<span class="muted">None directly</span>`}</div></div>
      <div><div class="label">Tagged quotes</div><div class="mono">${nCount}</div></div></div>
    </article>`; }).join("")}</div>`);
  sec.querySelectorAll("[data-job]").forEach((b) => (b.onclick = () => {
    for (const p of S.kb.personas) { const j = (p.jobs || []).find((x) => x.id === b.dataset.job); if (j) openEvidence(j.statement, `${p.name} · job to be done`, j.for, j.against); }
  }));
  return sec;
}

// ---------- journeys ----------
function vJourneys() {
  const pid = S.persona !== "all" ? S.persona : S.jp;
  const p = S.kb.personas.find((x) => x.id === pid);
  const steps = S.kb.journeys[pid] || [];
  const sec = section(`<div class="view-head"><div><h2>Journey map · ${esc(p.name)}</h2><p>Each column is a step of the journey. Every statement shows how many quotes support (▲) and contradict (▼) it. Click one to read them. Green cards link to features in the RICE list.</p></div>
    <div class="persona-switch">${S.kb.personas.map((x) => `<button class="chip" data-jp="${esc(x.id)}" aria-pressed="${x.id === pid}"><span class="dot" style="background:${pc(x.id)}"></span>${esc(pShort(x.id))}</button>`).join("")}</div></div>
    ${p.evidence_level === "thin" && p.evidence_note ? `<div class="notice">${esc(p.evidence_note)}</div>` : ""}`);
  const wrap = document.createElement("div"); wrap.className = "jwrap"; wrap.style.setProperty("--pc", pc(pid));
  const g = document.createElement("div"); g.className = "jgrid"; g.style.gridTemplateColumns = `132px repeat(${steps.length}, 250px)`;
  let h = `<div class="jrowlabel">Step</div>` + steps.map((s, i) => `<div class="jcell jhead"><span class="num">${String(i + 1).padStart(2, "0")}</span><h4>${esc(s.title)}</h4><p>${esc(s.goal)}</p></div>`).join("");
  const W = 250, H = 56, pts = steps.map((s, i) => [i * W + W / 2, H / 2 - (Number(s.emotion) || 0) * (H / 5)]);
  h += `<div class="jrowlabel">How it feels</div><div class="jcell emo" style="grid-column:span ${steps.length};width:auto;padding:4px 0"><svg width="${steps.length * W}" height="${H}" viewBox="0 0 ${steps.length * W} ${H}" role="img" aria-label="Emotion per step">
    <line x1="0" x2="${steps.length * W}" y1="${H / 2}" y2="${H / 2}" stroke="var(--line)" stroke-dasharray="3 4"/>
    <polyline fill="none" stroke="var(--pc)" stroke-width="2" points="${pts.map((q) => q.join(",")).join(" ")}"/>
    ${pts.map((q, i) => `<circle cx="${q[0]}" cy="${q[1]}" r="5" fill="${(steps[i].emotion || 0) < 0 ? "var(--against)" : (steps[i].emotion || 0) > 0 ? "var(--for)" : "var(--muted)"}"/>`).join("")}
  </svg></div>`;
  for (const [rk, rl] of ROWS) {
    h += `<div class="jrowlabel">${rl}</div>`;
    for (const s of steps) {
      let items = s.rows?.[rk] || [];
      if (rk === "features" && S.product !== "all") items = items.filter((st) => { const so = S.sols.get(st.solution); return !so || so.product === S.product; });
      h += `<div class="jcell">${items.map((st) => {
        const so = st.solution ? S.sols.get(st.solution) : null;
        return `<button class="stmt ${rk}" data-st="${esc(st.id)}">${st.assumption ? `<span class="assume">Assumption</span>` : ""}<span>${esc(st.text)}</span>
          <span style="display:flex;justify-content:space-between;gap:6px;align-items:center">${tally(st.for, st.against)}${so ? `<span class="solmeta"><span class="mono">RICE ${fmt(score(so))}</span><span class="status ${esc(so.status)}">${esc(stLabel(so.status))}</span></span>` : ""}</span></button>`; }).join("") || `<span class="empty-cell">No evidence yet</span>`}</div>`;
    }
  }
  g.innerHTML = h; wrap.append(g); sec.append(wrap);
  sec.querySelectorAll("[data-jp]").forEach((b) => (b.onclick = () => { S.jp = b.dataset.jp; if (S.persona !== "all") { S.persona = b.dataset.jp; renderChrome(); } render(); }));
  sec.querySelectorAll("[data-st]").forEach((b) => (b.onclick = () => {
    for (const s of steps) for (const [rk, rl] of ROWS) {
      const st = (s.rows?.[rk] || []).find((x) => x.id === b.dataset.st);
      if (!st) continue;
      const so = st.solution ? S.sols.get(st.solution) : null;
      const extra = so ? `<div class="panel" style="padding:12px;display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap"><div><div class="label">Linked feature</div><b>${esc(so.title)}</b> <span class="mono muted">RICE ${fmt(score(so))}</span></div><button class="btn small" data-opensol="${esc(so.id)}">Open feature</button></div>` : "";
      openEvidence(st.text, `${p.name} · ${s.title} · ${rl}`, st.for, st.against, extra);
      $("#overlay [data-opensol]")?.addEventListener("click", () => openSolution(so.id));
    }
  }));
  return sec;
}

// ---------- RICE ----------
function statusStrip(list) {
  const c = Object.fromEntries(STATUSES.map((s) => [s.id, 0]));
  for (const s of list) c[s.status] = (c[s.status] || 0) + 1;
  return `<div class="strip">${STATUSES.map((s) => `<div><span class="label">${esc(s.label)}</span><b>${c[s.id]}</b></div>`).join("")}</div>`;
}
function vRice() {
  let list = visibleSols();
  if (S.riceStatus !== "all") list = list.filter((s) => s.status === S.riceStatus);
  if (S.riceQ) { const q = S.riceQ.toLowerCase(); list = list.filter((s) => `${s.title} ${s.description}`.toLowerCase().includes(q)); }
  const { k, d } = S.riceSort;
  const val = (s) => (k === "score" ? score(s) : k === "title" ? s.title.toLowerCase() : s[k] ?? "");
  list.sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * d);
  const max = Math.max(1, ...[...S.sols.values()].map(score));
  const sel = (field, opts, v, id) => `<select data-f="${field}" data-id="${esc(id)}" aria-label="${field}">${opts.map(([o, l]) => `<option value="${esc(o)}" ${String(o) === String(v) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
  const allStages = Object.entries(S.kb.stages).flatMap(([pid, arr]) => arr.map((s) => [s.id, `${pShort(pid)} · ${s.title}`]));
  const prods = products();
  const sec = section(`<div class="view-head"><div><h2>RICE prioritization</h2><p>Score = Reach × Impact × Confidence ÷ Effort. Reach starts as the number of interviewees whose quotes support the feature. Confidence starts from evidence strength: 100% if they pay for it today, 80% if they already work around it, 50% if they only said it. Effort is a rough guess in person-weeks: adjust it to your team. Your edits are saved in the output folder and kept when you rebuild.</p></div>
    <div class="toolbar"><button class="btn primary" id="add-sol">Add feature</button></div></div>
    ${statusStrip(visibleSols())}
    <div class="toolbar"><input type="search" id="rice-q" placeholder="Search features" value="${esc(S.riceQ)}" data-live="1" aria-label="Search features">
      <select id="rice-status" aria-label="Status filter"><option value="all">All statuses</option>${STATUSES.map((s) => `<option value="${s.id}" ${S.riceStatus === s.id ? "selected" : ""}>${esc(s.label)}</option>`).join("")}</select>
      <span class="muted">${list.length} features${S.persona !== "all" ? ` for ${esc(pShort(S.persona))}` : ""}${S.product !== "all" ? ` in ${esc(prodLabel(S.product))}` : ""}</span></div>
    <div class="twrap"><table><thead><tr>
      <th class="sortable" data-sort="title">Feature</th>${prods.length > 1 ? "<th>Product</th>" : ""}<th>Personas</th><th>Journey step</th><th>Kano</th>
      <th class="sortable" data-sort="reach">Reach</th><th class="sortable" data-sort="impact">Impact</th><th class="sortable" data-sort="confidence">Confidence</th><th class="sortable" data-sort="effort">Effort (wks)</th><th class="sortable" data-sort="score">Score ${k === "score" ? (d < 0 ? "↓" : "↑") : ""}</th><th>Evidence</th><th>Status</th><th></th></tr></thead>
    <tbody>${list.map((s) => `<tr>
      <td class="feat"><button class="title" data-open="${esc(s.id)}">${esc(s.title)}</button><div class="desc" title="${esc(s.description)}">${esc(s.description)}</div></td>
      ${prods.length > 1 ? `<td>${sel("product", prods.map((p) => [p.id, p.label]), s.product, s.id)}</td>` : ""}
      <td class="pers"><div class="pchips">${S.kb.personas.map((p) => `<button class="pchip ${(s.personas || []).includes(p.id) ? "" : "off"}" style="--pc:${pc(p.id)}" data-tp="${esc(p.id)}" data-id="${esc(s.id)}" aria-pressed="${(s.personas || []).includes(p.id)}">${esc(pShort(p.id))}</button>`).join("")}</div></td>
      <td>${sel("stage", [["", "—"], ...allStages], s.stage || "", s.id)}</td>
      <td>${sel("kano", KANO, s.kano, s.id)}</td>
      <td><input type="number" min="0" step="1" value="${esc(s.reach)}" data-f="reach" data-id="${esc(s.id)}" aria-label="Reach"></td>
      <td>${sel("impact", IMPACT, s.impact, s.id)}</td>
      <td>${sel("confidence", CONF, s.confidence, s.id)}</td>
      <td><input type="number" min="0.5" step="0.5" value="${esc(s.effort)}" data-f="effort" data-id="${esc(s.id)}" aria-label="Effort"></td>
      <td><span class="score">${fmt(score(s))}</span><div class="bar"><i style="width:${Math.min(100, (score(s) / max) * 100)}%"></i></div></td>
      <td><button class="btn small" data-ev="${esc(s.id)}">${tally(s.for, s.against)}</button></td>
      <td><span class="status ${esc(s.status)}">${esc(stLabel(s.status))}</span></td>
      <td>${BOARD.includes(s.status) ? `<span class="muted" style="font-size:12px">On the board</span>` : `<button class="btn small" data-send="${esc(s.id)}">Send to backlog</button>`}</td>
    </tr>`).join("") || `<tr><td colspan="13" class="muted">No features match these filters.</td></tr>`}</tbody></table></div>`);
  sec.querySelectorAll("[data-sort]").forEach((th) => (th.onclick = () => { const kk = th.dataset.sort; S.riceSort = { k: kk, d: S.riceSort.k === kk ? -S.riceSort.d : kk === "title" ? 1 : -1 }; render(); }));
  sec.querySelector("#rice-q").oninput = (e) => { S.riceQ = e.target.value; clearTimeout(S.qt); S.qt = setTimeout(() => { render(); const i = $("#rice-q"); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); };
  sec.querySelector("#rice-status").onchange = (e) => { S.riceStatus = e.target.value; render(); };
  sec.querySelectorAll("select[data-f]").forEach((el) => (el.onchange = () => {
    const f = el.dataset.f, num = ["impact", "confidence"].includes(f);
    const v = num ? Number(el.value) : el.value; const old = S.sols.get(el.dataset.id)[f];
    write(el.dataset.id, { [f]: v }, `${f}: ${old ?? "—"} → ${v}`);
  }));
  sec.querySelectorAll("input[data-f]").forEach((el) => (el.onchange = () => {
    const v = Number(el.value); if (!(v >= 0)) { toast("Enter a number of 0 or more."); return; }
    const old = S.sols.get(el.dataset.id)[el.dataset.f]; if (old === v) return;
    el.blur(); write(el.dataset.id, { [el.dataset.f]: v }, `${el.dataset.f}: ${old} → ${v}`);
  }));
  sec.querySelectorAll("[data-tp]").forEach((b) => (b.onclick = () => {
    const s = S.sols.get(b.dataset.id); const set = new Set(s.personas || []);
    set.has(b.dataset.tp) ? set.delete(b.dataset.tp) : set.add(b.dataset.tp);
    write(s.id, { personas: [...set] }, `personas → ${[...set].map(pShort).join(", ") || "none"}`);
  }));
  sec.querySelectorAll("[data-send]").forEach((b) => (b.onclick = () => sendToBacklog(b.dataset.send)));
  sec.querySelectorAll("[data-open]").forEach((b) => (b.onclick = () => openSolution(b.dataset.open)));
  sec.querySelectorAll("[data-ev]").forEach((b) => (b.onclick = () => { const s = S.sols.get(b.dataset.ev); openEvidence(s.title, "Feature evidence", s.for, s.against); }));
  sec.querySelector("#add-sol").onclick = () => openSolution(null);
  return sec;
}
function nextRank() { return Math.max(0, ...[...S.sols.values()].filter((s) => BOARD.includes(s.status)).map((s) => s.rank || 0)) + 1; }
function sendToBacklog(id) { write(id, { status: "backlog", rank: nextRank() }, "sent to backlog"); toast("Sent to backlog"); }
function openSolution(id) {
  const s = id ? S.sols.get(id) : { title: "", description: "", product: S.product !== "all" ? S.product : products()[0]?.id, personas: S.persona !== "all" ? [S.persona] : [], kano: "performance", reach: 1, impact: 1, confidence: 0.5, effort: 2, status: "discovered", for: [], against: [], log: [] };
  const opps = (s.opportunities || []).map((o) => S.kb.opportunities.find((x) => x.id === o)).filter(Boolean);
  openDrawer(`<div class="dhead"><div><div class="label">${id ? "Feature" : "New feature"}</div><h3>${esc(s.title || "Untitled feature")}</h3></div><button class="btn small" data-close>Close</button></div>
  <div class="dbody"><form class="form" id="solform">
    <label>Title<input id="sf-title" value="${esc(s.title)}" required></label>
    <label>Description<textarea id="sf-desc" rows="3">${esc(s.description)}</textarea></label>
    <div class="two"><label>Status<select id="sf-status">${STATUSES.map((x) => `<option value="${x.id}" ${x.id === s.status ? "selected" : ""}>${esc(x.label)}</option>`).join("")}</select></label>
    <label>Owner<input id="sf-owner" value="${esc(s.owner || "")}" placeholder="Who drives it"></label></div>
    <div class="two"><label>Target release<input id="sf-release" value="${esc(s.release || "")}" placeholder="e.g. Q1 2027"></label>
    <label>Link (ticket, PR, doc)<input id="sf-link" value="${esc(s.link || "")}" placeholder="https://…"></label></div>
    <label>Notes<textarea id="sf-notes" rows="2">${esc(s.notes || "")}</textarea></label>
    <div><button class="btn primary" type="submit">${id ? "Save changes" : "Add feature"}</button></div>
  </form>
  ${s.rationale ? `<div><div class="label">Why these starting scores</div><p style="margin:4px 0 0">${esc(s.rationale)}</p></div>` : ""}
  ${opps.length ? `<div><div class="label">Opportunities it addresses</div><ul class="plain">${opps.map((o) => `<li><button class="title" style="background:none;border:0;padding:0;text-align:left;color:var(--accent)" data-opp="${esc(o.id)}">${esc(o.title)}</button> ${tally(o.for, o.against)}</li>`).join("")}</ul></div>` : ""}
  ${id ? `<div><button class="btn small" id="sf-ev">See the quotes for and against · ${tally(s.for, s.against)}</button></div>` : ""}
  ${(s.log || []).length ? `<div><div class="label">History</div><div class="feed panel" style="margin-top:6px">${s.log.map((l) => `<div><span class="mono muted">${esc(new Date(l.at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }))}</span><span>${esc(l.what)}</span></div>`).join("")}</div></div>` : ""}
  </div>`, (o) => {
    o.querySelectorAll("[data-opp]").forEach((b) => (b.onclick = () => { const op = S.kb.opportunities.find((x) => x.id === b.dataset.opp); openEvidence(op.title, "Opportunity", op.for, op.against); }));
    o.querySelector("#sf-ev")?.addEventListener("click", () => openEvidence(s.title, "Feature evidence", s.for, s.against));
    o.querySelector("#solform").onsubmit = (e) => {
      e.preventDefault();
      const patch = { title: $("#sf-title").value.trim(), description: $("#sf-desc").value.trim(), status: $("#sf-status").value, owner: $("#sf-owner").value.trim(), release: $("#sf-release").value.trim(), link: $("#sf-link").value.trim(), notes: $("#sf-notes").value.trim() };
      if (!patch.title) { toast("Give the feature a title."); return; }
      if (id) {
        const changed = Object.keys(patch).filter((k) => (s[k] || "") !== patch[k]);
        if (!changed.length) { closeDrawer(); return; }
        if (patch.status !== s.status && BOARD.includes(patch.status) && !BOARD.includes(s.status)) patch.rank = nextRank();
        write(id, patch, changed.includes("status") ? `status → ${stLabel(patch.status)}` : `edited ${changed.join(", ")}`);
      } else {
        const nid = "new." + Date.now().toString(36);
        const { log, ...rest } = s;
        write(nid, { ...rest, ...patch, created: true }, "created");
      }
      closeDrawer(); toast(id ? "Saved" : "Feature added");
    };
  });
}

// ---------- backlog ----------
function vBacklog() {
  const items = visibleSols().filter((s) => BOARD.includes(s.status));
  const feed = [...S.sols.values()].flatMap((s) => (s.log || []).map((l) => ({ ...l, title: s.title }))).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12);
  const sec = section(`<div class="view-head"><div><h2>Backlog</h2><p>Features sent from the RICE list, in priority order. Move them through delivery and record the owner, target release and a ticket or PR link. "Validated after launch" means you checked with users that the pain is gone.</p></div></div>
  <div class="board">${BOARD.map((st) => {
    const col = items.filter((s) => s.status === st).sort((a, b) => (a.rank || 0) - (b.rank || 0));
    return `<div class="col"><h3><span>${esc(stLabel(st))}</span><span class="mono muted">${col.length}</span></h3>
    ${col.map((s, i) => `<div class="card">
      <div class="row" style="justify-content:space-between"><span class="rank">#${i + 1} · RICE ${fmt(score(s))}</span><span class="prod">${esc(prodLabel(s.product))}</span></div>
      <button class="title" style="background:none;border:0;padding:0;text-align:left;font-weight:600;color:var(--ink)" data-open="${esc(s.id)}">${esc(s.title)}</button>
      <div class="pchips">${(s.personas || []).map((p) => `<span class="pchip" style="--pc:${pc(p)}">${esc(pShort(p))}</span>`).join("")}</div>
      <div class="row muted" style="font-size:12.5px">${s.owner ? `Owner: ${esc(s.owner)}` : "No owner yet"}${s.release ? ` · ${esc(s.release)}` : ""}${s.link && /^https?:\/\//.test(s.link) ? ` · <a href="${esc(s.link)}" target="_blank" rel="noopener noreferrer">link</a>` : ""}</div>
      <div class="row"><select data-mv="${esc(s.id)}" aria-label="Move to">${STATUSES.map((x) => `<option value="${x.id}" ${x.id === s.status ? "selected" : ""}>${esc(x.label)}</option>`).join("")}</select>
      <button class="btn small" data-up="${esc(s.id)}" ${i === 0 ? "disabled" : ""} aria-label="Move up">↑</button><button class="btn small" data-down="${esc(s.id)}" ${i === col.length - 1 ? "disabled" : ""} aria-label="Move down">↓</button></div>
    </div>`).join("") || `<p class="muted" style="font-size:12.5px;margin:0">${st === "backlog" ? "Send features here from the RICE list." : "Nothing here yet."}</p>`}</div>`; }).join("")}</div>
  <div><div class="label" style="margin-bottom:6px">Recent changes</div><div class="panel feed">${feed.map((l) => `<div><span class="mono muted">${esc(new Date(l.at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }))}</span><span>${esc(l.title)}: ${esc(l.what)}</span></div>`).join("") || `<div><span></span><span class="muted">No changes yet. Edits to scores and the backlog show up here.</span></div>`}</div></div>`);
  sec.querySelectorAll("[data-open]").forEach((b) => (b.onclick = () => openSolution(b.dataset.open)));
  sec.querySelectorAll("[data-mv]").forEach((el) => (el.onchange = () => write(el.dataset.mv, { status: el.value }, `status → ${stLabel(el.value)}`)));
  const swap = (id, dir) => {
    const s = S.sols.get(id); const col = items.filter((x) => x.status === s.status).sort((a, b) => (a.rank || 0) - (b.rank || 0));
    const i = col.findIndex((x) => x.id === id), j = i + dir; if (j < 0 || j >= col.length) return;
    const other = col[j]; const ri = s.rank || i + 1, rj = other.rank || j + 1;
    write(id, { rank: rj === ri ? rj + dir : rj }, `moved ${dir < 0 ? "up" : "down"}`); write(other.id, { rank: ri }, `moved ${dir < 0 ? "down" : "up"}`);
  };
  sec.querySelectorAll("[data-up]").forEach((b) => (b.onclick = () => swap(b.dataset.up, -1)));
  sec.querySelectorAll("[data-down]").forEach((b) => (b.onclick = () => swap(b.dataset.down, 1)));
  return sec;
}

// ---------- evidence ----------
function vEvidence() {
  const all = [...nugIndex.values()];
  const nugs = all.filter((n) => (S.persona === "all" || n.persona === S.persona) && (S.product === "all" || n.product === S.product));
  const ps = S.kb.personas.filter((p) => S.persona === "all" || p.id === S.persona);
  let maxc = 1; const cnt = {};
  for (const n of nugs) { cnt[n.stage] = (cnt[n.stage] || 0) + 1; maxc = Math.max(maxc, cnt[n.stage]); }
  const srcs = [...srcIndex.values()].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const sec = section(`<div class="view-head"><div><h2>Evidence & coverage</h2><p>Where the evidence is thick and where you are guessing. Cells count tagged quotes per journey step. Empty or pale cells are blind spots to cover in the next interviews.</p></div></div>
  <div class="strip">${TYPES.map((t) => `<div><span class="label">${t.replace("_", " ")}</span><b>${nugs.filter((n) => n.type === t).length}</b></div>`).join("")}</div>
  <div class="panel heat">${ps.map((p) => { const st = S.kb.stages[p.id] || []; return `<table style="min-width:${Math.max(640, st.length * 120)}px"><thead><tr><th style="width:150px"><span class="dot" style="background:${pc(p.id)}"></span> ${esc(pShort(p.id))}</th>${st.map((s) => `<th>${esc(s.title)}</th>`).join("")}</tr></thead>
    <tbody><tr><td class="muted">Quotes</td>${st.map((s) => { const c = cnt[s.id] || 0; const a = c / maxc; return `<td class="h" data-stage="${esc(s.id)}" style="background:color-mix(in srgb, ${pc(p.id)} ${Math.round(a * 70)}%, transparent);color:${a > 0.5 ? "var(--surface)" : "var(--ink)"}">${c || "–"}</td>`; }).join("")}</tr></tbody></table>`; }).join("")}</div>
  <div><h3 style="font-size:18px;margin-bottom:8px">Hypotheses</h3><div class="panel hyp">${(S.kb.hypotheses || []).filter((h) => S.product === "all" || h.product === S.product).map((h, i) => { const f = h.evidence.filter((e) => e.stance === "for").length, a = h.evidence.length - f; return `<button class="hyp-row" data-h="${i}"><span>${products().length > 1 ? `<span class="prod">${esc(prodLabel(h.product))}</span> ` : ""}<b>${esc(h.name)}</b><br><span class="muted">${esc(h.statement)}</span></span><span><div class="split"><span class="f" style="width:${(f / Math.max(1, f + a)) * 100}%"></span><span class="a" style="width:${(a / Math.max(1, f + a)) * 100}%"></span></div><span class="tally" style="margin-top:4px"><span class="f">▲${f} for</span><span class="a">▼${a} against</span></span></span></button>`; }).join("") || `<p class="muted">No hypotheses yet. Add some to taxonomy.json on the Process tab.</p>`}</div></div>
  <div><h3 style="font-size:18px;margin-bottom:8px">Sources · ${srcs.length}</h3><div class="twrap"><table style="min-width:900px"><thead><tr><th>Date</th><th>Interviewee</th><th>Role & company</th><th>Persona</th><th>Type</th><th>Quotes</th><th>File</th></tr></thead><tbody>
    ${srcs.filter((s) => (S.persona === "all" || s.persona === S.persona) && (S.product === "all" || s.product === S.product)).map((s) => `<tr><td class="mono">${esc(s.date || "—")}</td><td><b>${esc(s.interviewee)}</b></td><td>${esc([s.role, s.company].filter(Boolean).join(", "))}<div class="desc">${esc(s.summary)}</div></td><td><span class="pchip" style="--pc:${pc(s.persona)}">${esc(pShort(s.persona))}</span></td><td>${esc(s.source_type)}${s.language && s.language !== "en" ? ` · ${esc(s.language)}` : ""}</td><td class="mono"><button class="btn small" data-src="${esc(s.id)}">${all.filter((n) => n.source === s.id).length}</button></td><td class="mono" style="font-size:11.5px;word-break:break-all;max-width:260px">${esc((s.files || [])[0] || "")}</td></tr>`).join("")}
  </tbody></table></div></div>`);
  sec.querySelectorAll("[data-h]").forEach((b) => (b.onclick = () => { const h = S.kb.hypotheses[Number(b.dataset.h)]; openEvidence(h.name, "Hypothesis", h.evidence.filter((e) => e.stance === "for").map((e) => e.nugget), h.evidence.filter((e) => e.stance !== "for").map((e) => e.nugget), `<p style="margin:0">${esc(h.statement)}</p>`); }));
  sec.querySelectorAll("[data-stage]").forEach((td) => (td.onclick = () => { const ids = nugs.filter((n) => n.stage === td.dataset.stage).map((n) => n.id); openEvidence(stageTitle(td.dataset.stage), "All quotes for this step", ids, []); }));
  sec.querySelectorAll("[data-src]").forEach((b) => (b.onclick = () => { const s = srcIndex.get(b.dataset.src); openEvidence(`${s.interviewee} · ${s.date || ""}`, [s.role, s.company].filter(Boolean).join(", "), all.filter((n) => n.source === s.id).map((n) => n.id), [], `<p style="margin:0">${esc(s.summary)}</p>`); }));
  return sec;
}

// ---------- ask ----------
const SUGGEST = ["Which pains came up most often, and from whom?", "Where do interviewees disagree with each other?", "What are people already paying for today?", "Which top-5 RICE features have the weakest evidence?", "What do we know only from one person?"];
function mdLite(t) {
  const lines = esc(t).split(/\n/); let html = "", inList = false;
  for (const l of lines) {
    const m = l.match(/^\s*[-*•]\s+(.*)/);
    if (m) { if (!inList) { html += "<ul>"; inList = true; } html += `<li>${m[1]}</li>`; continue; }
    if (inList) { html += "</ul>"; inList = false; }
    if (l.trim()) html += `<p>${l.replace(/^#+\s*/, "")}</p>`;
  }
  if (inList) html += "</ul>";
  return html.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\[([a-z0-9.\-_]+)\]/gi, (m, id) => nugIndex.has(id) ? `<button class="cite" data-cite="${id}">${esc(srcIndex.get(nugIndex.get(id).source)?.interviewee || id)}</button>` : S.sols.has(id) ? `<button class="cite" data-csol="${id}">${esc(S.sols.get(id).title)}</button>` : m);
}
function vAsk() {
  const sec = section(`<div class="view-head"><div><h2>Ask the interviews</h2><p>Ask anything about the interviews, personas, journeys or priorities. Claude answers only from the tagged interview quotes, with citations you can open, and says so when the interviews don't cover something. To get an answer from outside the interviews, say so in your question, e.g. "look beyond the interviews".</p></div>${S.chat.length ? `<button class="btn small" id="ask-clear">Clear conversation</button>` : ""}</div>
  <div class="ask"><div class="msgs">${S.chat.map((m) => `<div class="msg ${m.role === "user" ? "me" : ""}"><div class="body">${m.role === "user" ? `<p>${esc(m.content)}</p>` : mdLite(m.content)}</div></div>`).join("")}
  ${S.asking ? `<div class="msg"><div class="body"><p class="muted">Searching the quotes and thinking…</p></div></div>` : ""}</div>
  ${!S.chat.length && !S.asking ? `<div class="suggest">${SUGGEST.map((q) => `<button class="chip" data-q="${esc(q)}">${esc(q)}</button>`).join("")}</div>` : ""}
  <form class="composer" id="ask-form"><textarea id="ask-input" data-live="1" placeholder="e.g. What tools do people use today instead of us?" aria-label="Your question"></textarea>
  ${S.asking ? `<button class="btn" type="button" id="ask-stop">Stop</button>` : `<button class="btn primary" type="submit">Ask</button>`}</form>
  <p class="muted" style="margin:0;font-size:12.5px">${esc(S.askNote || "")}</p></div>`);
  sec.querySelector("#ask-form").onsubmit = (e) => { e.preventDefault(); const v = $("#ask-input").value.trim(); if (v) { $("#ask-input").value = ""; ask(v); } };
  sec.querySelector("#ask-input").onkeydown = (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); sec.querySelector("#ask-form").requestSubmit(); } };
  sec.querySelectorAll("[data-q]").forEach((b) => (b.onclick = () => ask(b.dataset.q)));
  sec.querySelector("#ask-stop")?.addEventListener("click", () => S.asking?.abort());
  sec.querySelector("#ask-clear")?.addEventListener("click", () => { S.chat = []; S.askNote = ""; render(); });
  sec.querySelectorAll("[data-cite]").forEach((b) => (b.onclick = () => openEvidence(nugIndex.get(b.dataset.cite).text, "Cited quote", [b.dataset.cite], [])));
  sec.querySelectorAll("[data-csol]").forEach((b) => (b.onclick = () => openSolution(b.dataset.csol)));
  return sec;
}
async function ask(q) {
  if (S.asking) return;
  S.chat.push({ role: "user", content: q }); S.askNote = "";
  S.asking = new AbortController(); render();
  try {
    const { text, truncated } = await api("/api/ask", { method: "POST", body: { messages: S.chat.slice(-8) }, signal: S.asking.signal });
    S.chat.push({ role: "assistant", content: text.includes(NO_ANSWER) ? NO_ANSWER_TEXT : text });
    if (truncated) S.askNote = "The answer was cut short. Ask a narrower question.";
  } catch (e) {
    if (e.name === "AbortError") S.chat.pop(); else S.askNote = e.message;
  } finally { S.asking = null; render(); }
}

// ---------- process ----------
let pollTimer = null;
function pollJob() {
  clearTimeout(pollTimer);
  pollTimer = setTimeout(async () => {
    try { S.job = await api("/api/pipeline/status"); } catch {}
    if (S.job?.running) { if (S.view === "process") render(); pollJob(); }
    else { await Promise.all([loadKb(), loadProcess()]); renderChrome(); render(); if (S.job?.error) toast(S.job.error); else if (S.job?.step === "Done") toast("Run finished"); }
  }, 1000);
}
async function runStep(mode) {
  try { S.job = await api("/api/pipeline/run", { method: "POST", body: { mode } }); render(); pollJob(); } catch (e) { toast(e.message); }
}
function vProcess() {
  const c = S.cfg, job = S.job, running = !!job?.running;
  const counts = { new: 0, changed: 0, processed: 0, too_big: 0 };
  for (const t of S.transcripts) counts[t.status]++;
  const pending = counts.new + counts.changed;
  const usingSamples = c.transcriptsDir === c.sampleTranscriptsDir;
  const dis = running ? "disabled" : "";
  const prog = job?.progress ? Math.round((job.progress.done / Math.max(1, job.progress.total)) * 100) : null;
  const sec = section(`<div class="view-head"><div><h2>Process transcripts</h2><p>Claude reads your transcripts in three steps: it proposes personas and journey stages, tags quotes in each transcript, then builds personas, journey maps and RICE-scored features. Results are saved as JSON files in your output folder, so you can open and check every one.</p></div>
    <div class="toolbar"><button class="btn primary" id="run-all" ${dis}>${S.kb ? "Process new transcripts" : "Run everything"}</button>${running ? `<button class="btn" id="cancel">Cancel</button>` : ""}</div></div>
  <div class="panel" style="padding:12px 14px;display:grid;gap:6px">
    <div class="row"><span class="label" style="width:110px">Transcripts</span><span class="path">${esc(c.transcriptsDir)}</span></div>
    <div class="row"><span class="label" style="width:110px">Output</span><span class="path">${esc(c.outputDir)}</span></div>
    <div class="row"><span class="label" style="width:110px">Claude</span><span>${c.engine === "cli" ? `Claude Code CLI · ${esc(c.cliModel)}` : `Anthropic API · ${esc(c.model)}`}</span><button class="btn small" id="to-settings">Change</button></div>
  </div>
  ${!S.kb && S.demo && usingSamples ? `<div class="notice row" style="justify-content:space-between"><span>You're using the sample interviews. Want to look around before spending any Claude credits? Load the pre-built results.</span><button class="btn small" id="load-demo" ${dis}>Load demo results</button></div>` : ""}
  ${running || job?.log?.length ? `<div class="panel" style="padding:12px 14px;display:flex;flex-direction:column;gap:8px">
    <div class="row" style="justify-content:space-between"><b>${esc(job.step || "")}${running ? "…" : ""}</b><span class="muted mono">${job.calls ? `${job.calls} Claude call${job.calls > 1 ? "s" : ""}` : ""}${prog != null && running ? ` · ${job.progress.done}/${job.progress.total}` : ""}</span></div>
    ${prog != null && running ? `<div class="progress"><i style="width:${prog}%"></i></div>` : ""}
    <div class="logbox panel" id="logbox">${(job.log || []).map((l) => `<div class="${esc(l.level)}"><span class="muted">${esc(new Date(l.t).toLocaleTimeString("en-GB"))}</span> ${esc(l.msg)}</div>`).join("")}</div></div>` : ""}
  <div class="steps">
    <div class="panel step"><span class="label">Step 1</span><h3>Personas & journey stages</h3>
      ${S.tax ? `<ul class="plain">${S.tax.personas.map((p) => `<li><b>${esc(p.name)}</b>: ${(S.tax.stages[p.id] || []).map((s) => esc(s.title)).join(" → ")}</li>`).join("")}</ul>` : `<p class="muted" style="margin:0">Not proposed yet. Claude skims the transcripts and proposes a frame you can edit before tagging.</p>`}
      <div class="row"><button class="btn small" id="run-tax" ${dis}>${S.tax ? "Propose again" : "Propose"}</button>${S.tax ? `<button class="btn small" id="edit-tax" ${dis}>Edit</button>` : ""}</div></div>
    <div class="panel step"><span class="label">Step 2</span><h3>Tag quotes</h3>
      <p class="muted" style="margin:0">${S.transcripts.length} files: ${counts.processed} done, ${pending} new or changed${counts.too_big ? `, ${counts.too_big} too big (over 2 MB)` : ""}.</p>
      <div class="row"><button class="btn small" id="run-extract" ${dis || (!S.tax || !pending ? "disabled" : "")}>Tag new transcripts</button></div></div>
    <div class="panel step"><span class="label">Step 3</span><h3>Personas, journeys, RICE</h3>
      <p class="muted" style="margin:0">${S.kb ? `Built ${esc(S.kb.generated)}: ${S.kb.personas.length} personas, ${S.kb.solutions.length} features.` : "Not built yet."} New interviews update the existing personas; your score edits are kept.</p>
      <div class="row"><button class="btn small" id="run-synth" ${dis || (!counts.processed ? "disabled" : "")}>Synthesize</button><button class="btn small" id="run-rebuild" ${dis || (!S.tax ? "disabled" : "")}>Rebuild from scratch</button></div></div>
  </div>
  <div><h3 style="font-size:18px;margin-bottom:8px">Transcripts · ${S.transcripts.length}</h3><div class="twrap"><table style="min-width:640px"><thead><tr><th>File</th><th>Size</th><th>Status</th><th>Source id</th></tr></thead><tbody>
    ${S.transcripts.map((t) => `<tr><td class="mono">${esc(t.name)}</td><td class="mono">${Math.round(t.size / 1024)} KB</td><td><span class="status ${t.status === "processed" ? "shipped" : t.status === "too_big" ? "" : "prioritized"}">${{ new: "New", changed: "Changed", processed: "Tagged", too_big: "Too big" }[t.status]}</span></td><td class="mono">${esc(t.sourceId || "")}</td></tr>`).join("") || `<tr><td colspan="4" class="muted">No .md, .txt, .vtt or .srt files in this folder.</td></tr>`}
  </tbody></table></div></div>`);
  const lb = sec.querySelector("#logbox"); if (lb) requestAnimationFrame(() => (lb.scrollTop = lb.scrollHeight));
  sec.querySelector("#run-all").onclick = () => runStep("all");
  sec.querySelector("#cancel")?.addEventListener("click", () => api("/api/pipeline/cancel", { method: "POST", body: {} }).catch(() => {}));
  sec.querySelector("#to-settings").onclick = () => go("settings");
  sec.querySelector("#run-tax").onclick = () => { if (!S.tax || confirm("Propose personas and stages again? Quotes you already tagged keep the old ids, so use Rebuild from scratch afterwards.")) runStep("taxonomy"); };
  sec.querySelector("#edit-tax")?.addEventListener("click", editTaxonomy);
  sec.querySelector("#run-extract").onclick = () => runStep("extract");
  sec.querySelector("#run-synth").onclick = () => runStep("synthesize");
  sec.querySelector("#run-rebuild").onclick = () => { if (confirm("Rebuild from scratch? Claude reads every transcript again (this costs credits). Your score edits are kept.")) runStep("rebuild"); };
  sec.querySelector("#load-demo")?.addEventListener("click", async () => {
    try { await api("/api/demo/load", { method: "POST", body: {} }); await Promise.all([loadKb(), loadProcess()]); toast("Demo results loaded"); go("personas"); } catch (e) { toast(e.message); }
  });
  return sec;
}
function editTaxonomy() {
  openDrawer(`<div class="dhead"><div><div class="label">Step 1</div><h3>Edit personas & stages</h3></div><button class="btn small" data-close>Close</button></div>
  <div class="dbody"><p class="muted" style="margin:0">This is <span class="mono">taxonomy.json</span>. Rename personas, add or reorder stages, add hypotheses. Ids must stay lowercase; stage ids start with their persona id and a dot. If you change ids after tagging, use Rebuild from scratch.</p>
  <textarea class="code" id="tax-json" spellcheck="false">${esc(JSON.stringify(S.tax, null, 2))}</textarea>
  <div class="row"><button class="btn primary" id="tax-save">Save</button><span class="err" id="tax-err"></span></div></div>`, (o) => {
    o.querySelector("#tax-save").onclick = async () => {
      let data;
      try { data = JSON.parse($("#tax-json").value); } catch (e) { $("#tax-err").textContent = `Not valid JSON: ${e.message}`; return; }
      try { S.tax = await api("/api/taxonomy", { method: "PUT", body: data }); closeDrawer(); toast("Saved"); render(); } catch (e) { $("#tax-err").textContent = e.message; }
    };
  });
}

// ---------- settings + setup wizard ----------
function openPicker({ title, start, allowCreate, onPick }) {
  let cur = null;
  const draw = async (p) => {
    try { cur = await api(`/api/fs/list?path=${encodeURIComponent(p || "")}`); } catch (e) { toast(e.message); if (!cur) return; }
    const c = S.cfg || S.wiz?.draft || {};
    openDrawer(`<div class="dhead"><div><div class="label">Choose a folder</div><h3>${esc(title)}</h3></div><button class="btn small" data-close>Close</button></div>
    <div class="dbody">
      <form class="row" id="pk-go"><input id="pk-path" value="${esc(cur.path)}" style="flex:1;min-width:0;border:1px solid var(--line);border-radius:6px;padding:6px 8px;background:var(--surface)" aria-label="Folder path"><button class="btn small">Go</button></form>
      <div class="row"><button class="btn small" data-to="${esc(c.home)}">Home</button><button class="btn small" data-to="${esc(c.home)}/Documents">Documents</button><button class="btn small" data-to="${esc(c.home)}/Desktop">Desktop</button>${cur.parent ? `<button class="btn small" data-to="${esc(cur.parent)}">↑ Up</button>` : ""}</div>
      <div class="muted">${cur.transcriptFiles} transcript file${cur.transcriptFiles === 1 ? "" : "s"} in this folder · ${cur.dirs.length} sub-folders</div>
      <div class="dirlist">${cur.dirs.map((d) => `<button data-to="${esc(d.path)}">📁 ${esc(d.name)}</button>`).join("") || `<span class="muted" style="padding:8px 10px">No sub-folders</span>`}</div>
      ${allowCreate ? `<form class="row" id="pk-new"><input id="pk-name" placeholder="New folder name" style="flex:1;min-width:0;border:1px solid var(--line);border-radius:6px;padding:6px 8px;background:var(--surface)"><button class="btn small">Create here</button></form>` : ""}
      <button class="btn primary" id="pk-use">Use this folder</button>
    </div>`, (o) => {
      o.querySelectorAll("[data-to]").forEach((b) => (b.onclick = () => draw(b.dataset.to)));
      o.querySelector("#pk-go").onsubmit = (e) => { e.preventDefault(); draw($("#pk-path").value.trim()); };
      o.querySelector("#pk-new")?.addEventListener("submit", async (e) => {
        e.preventDefault(); const n = $("#pk-name").value.trim(); if (!n) return;
        if (/[\\/]/.test(n)) { toast("Use a folder name, not a path."); return; }
        try { const r = await api("/api/fs/mkdir", { method: "POST", body: { path: `${cur.path}/${n}` } }); draw(r.path); } catch (er) { toast(er.message); }
      });
      o.querySelector("#pk-use").onclick = () => { closeDrawer(); onPick(cur.path, cur); };
    });
  };
  draw(start);
}

function settingsForm(d, { wizard }) {
  return `
  <div class="panel" style="padding:18px;display:flex;flex-direction:column;gap:12px" ${wizard ? "" : 'id="sf-folders"'}>
    <h3 style="font-size:17px">Folders</h3>
    <div><div class="label">Transcripts folder</div><div class="pathbox"><code>${esc(d.transcriptsDir || "Not chosen")}</code><button class="btn small" data-pick="transcriptsDir">Choose…</button><button class="btn small" data-samples>Use the sample interviews</button></div></div>
    <div><div class="label">Output folder (results are saved here)</div><div class="pathbox"><code>${esc(d.outputDir || "Not chosen")}</code><button class="btn small" data-pick="outputDir">Choose…</button></div></div>
  </div>`;
}
function engineForm(d) {
  return `<div class="panel" style="padding:18px;display:flex;flex-direction:column;gap:12px">
    <h3 style="font-size:17px">How the app talks to Claude</h3>
    <label class="choice"><input type="radio" name="engine" value="api" ${d.engine !== "cli" ? "checked" : ""}><span><b>Anthropic API key</b><span class="muted">Pay per use from console.anthropic.com. The key is saved only on this computer, in <span class="mono">.insight-hub/config.json</span> (git-ignored).${d.envApiKey ? " An ANTHROPIC_API_KEY environment variable was found and is used if you leave the key empty." : ""}</span></span></label>
    <label class="choice"><input type="radio" name="engine" value="cli" ${d.engine === "cli" ? "checked" : ""}><span><b>Claude Code on this computer</b><span class="muted">Uses your Claude subscription through the <span class="mono">claude</span> command. Install Claude Code and log in once in a terminal first.</span></span></label>
    <div class="form" id="eng-api" ${d.engine === "cli" ? "hidden" : ""}>
      <label>API key ${d.hasApiKey ? `<span class="ok">· a key is saved</span>` : ""}<input type="password" id="api-key" autocomplete="off" placeholder="${d.hasApiKey ? "Leave empty to keep the saved key" : "sk-ant-…"}"></label>
      <label>Model<select id="api-model">${(d.models || []).map((m) => `<option value="${m.id}" ${m.id === d.model ? "selected" : ""}>${esc(m.label)}</option>`).join("")}</select></label>
      ${d.hasApiKey ? `<div><button class="btn small" type="button" id="clear-key">Remove the saved key</button></div>` : ""}
    </div>
    <div class="form" id="eng-cli" ${d.engine === "cli" ? "" : "hidden"}>
      <label>Model<select id="cli-model">${(d.cliModels || []).map((m) => `<option value="${m.id}" ${m.id === d.cliModel ? "selected" : ""}>${esc(m.label)}</option>`).join("")}</select></label>
    </div>
    <div class="row"><button class="btn small" type="button" id="test-engine">Save & test connection</button><span id="test-out" class="muted"></span></div>
  </div>`;
}
function productForm(d) {
  return `<div class="panel" style="padding:18px;display:flex;flex-direction:column;gap:12px">
    <h3 style="font-size:17px">What are the interviews about? <span class="muted" style="font-size:13px;font-weight:400">(optional)</span></h3>
    <div class="form"><label>Product name<input id="prod-name" value="${esc(d.product?.name || "")}" placeholder="e.g. Tably"></label>
    <label>One-paragraph description<textarea id="prod-desc" rows="3" placeholder="What it does and who it is for. Helps Claude pick sensible personas.">${esc(d.product?.description || "")}</textarea></label></div>
  </div>`;
}
function engineValues() {
  const engine = document.querySelector('input[name="engine"]:checked')?.value || "api";
  return { engine, apiKey: $("#api-key")?.value || "", model: $("#api-model")?.value, cliModel: $("#cli-model")?.value };
}
function bindEngine(root, onSaved) {
  root.querySelectorAll('input[name="engine"]').forEach((r) => (r.onchange = () => { $("#eng-api").hidden = r.value === "cli" && r.checked; $("#eng-cli").hidden = !(r.value === "cli" && r.checked); }));
  root.querySelector("#clear-key")?.addEventListener("click", async () => { S.cfg = await api("/api/config", { method: "POST", body: { clearApiKey: true } }); onSaved(); toast("Key removed"); });
  root.querySelector("#test-engine").onclick = async () => {
    const out = $("#test-out"); out.className = "muted"; out.textContent = "Testing…";
    try {
      S.cfg = await api("/api/config", { method: "POST", body: engineValues() });
      const r = await api("/api/engine/test", { method: "POST", body: {} });
      out.className = "ok"; out.textContent = `✓ ${r.message}`; S.engineOk = true;
      if ($("#api-key")) $("#api-key").value = "";
    } catch (e) { out.className = "err"; out.textContent = e.message; S.engineOk = false; }
  };
}
function bindFolders(root, draft, rerender) {
  root.querySelectorAll("[data-pick]").forEach((b) => (b.onclick = () => openPicker({
    title: b.dataset.pick === "transcriptsDir" ? "Transcripts folder" : "Output folder",
    start: draft[b.dataset.pick] || `${draft.home}/Documents`,
    allowCreate: b.dataset.pick === "outputDir",
    onPick: (p, info) => {
      if (b.dataset.pick === "transcriptsDir" && !info.transcriptFiles) toast("No transcript files in that folder yet (.md, .txt, .vtt, .srt).");
      draft[b.dataset.pick] = p; rerender();
    },
  })));
  root.querySelector("[data-samples]")?.addEventListener("click", () => { draft.transcriptsDir = draft.sampleTranscriptsDir; rerender(); });
}

function vSettings() {
  const d = (S.setDraft ||= { ...S.cfg });
  const sec = section(`<div class="view-head"><div><h2>Settings</h2><p>Where your transcripts are, where results go, and how the app reaches Claude. Everything stays on this computer except the text sent to Claude for processing.</p></div></div>
    <div style="display:grid;gap:16px;max-width:820px">${settingsForm(d, { wizard: false })}${productForm(d)}
    <div class="row"><button class="btn primary" id="save-settings">Save folders & product</button><span class="muted" id="save-out"></span></div>
    ${engineForm(S.cfg)}</div>`);
  bindFolders(sec, d, render);
  bindEngine(sec, render);
  sec.querySelector("#save-settings").onclick = async () => {
    try {
      S.cfg = await api("/api/config", { method: "POST", body: { transcriptsDir: d.transcriptsDir, outputDir: d.outputDir, product: { name: $("#prod-name").value.trim(), description: $("#prod-desc").value.trim() } } });
      S.setDraft = null; await Promise.all([loadKb(), loadProcess()]); renderChrome(); render(); toast("Saved");
    } catch (e) { toast(e.message); }
  };
  return sec;
}

const WIZ = ["Welcome", "Transcripts", "Output", "Claude", "Product"];
function renderWizard() {
  $("#top").hidden = true;
  const w = S.wiz, d = w.draft, m = $("#main");
  const head = `<div class="wsteps">${WIZ.map((t, i) => `<span class="${i === w.step ? "on" : i < w.step ? "done" : ""}">${i + 1}. ${t}</span>`).join("")}</div>`;
  const nav = (nextLabel = "Next", nextDisabled = false) => `<div class="row" style="justify-content:space-between">${w.step ? `<button class="btn" id="wz-back">Back</button>` : "<span></span>"}<button class="btn primary" id="wz-next" ${nextDisabled ? "disabled" : ""}>${nextLabel}</button></div>`;
  let body = "";
  if (w.step === 0) body = `<div class="panel"><h2 style="font-size:28px">Insight Hub</h2>
    <p style="margin:0">Turn customer-interview transcripts into a living research board: personas with jobs to be done, journey maps, a RICE-ranked feature list and a backlog. Every statement links back to the exact quotes for and against it.</p>
    <ul class="plain"><li>Runs on your computer. Your transcripts and results stay in folders you choose.</li><li>The only thing that leaves your computer is the text sent to Claude for processing.</li><li>Setup takes about two minutes.</li></ul>${nav("Start setup")}</div>`;
  if (w.step === 1) body = `<div class="panel"><h2 style="font-size:22px">Where are your transcripts?</h2><p class="muted" style="margin:0">A folder of .md, .txt, .vtt or .srt files, one interview per file. Any language works. No transcripts yet? Use the sample interviews that come with the app.</p>
    <div class="pathbox"><code>${esc(d.transcriptsDir || "Not chosen")}</code></div><div class="row"><button class="btn" data-pick="transcriptsDir">Choose folder…</button><button class="btn" data-samples>Use the sample interviews</button></div>${nav("Next", !d.transcriptsDir)}</div>`;
  if (w.step === 2) body = `<div class="panel"><h2 style="font-size:22px">Where should results go?</h2><p class="muted" style="margin:0">Pick or create an empty folder. The app writes JSON files there (taxonomy, tagged quotes, personas, your RICE edits), so you can read and version them.</p>
    <div class="pathbox"><code>${esc(d.outputDir || "Not chosen")}</code></div><div class="row"><button class="btn" data-pick="outputDir">Choose or create folder…</button></div>${nav("Next", !d.outputDir)}</div>`;
  if (w.step === 3) body = `${engineForm(d)}<div class="panel">${nav("Next")}<p class="muted" style="margin:0;font-size:12.5px">You can skip the test now and change this later in Settings.</p></div>`;
  if (w.step === 4) body = `${productForm(d)}<div class="panel">${nav("Finish setup")}</div>`;
  m.innerHTML = `<div class="wizard">${head}${body}</div>`;
  const root = m.querySelector(".wizard");
  if (w.step === 1 || w.step === 2) bindFolders(root, d, renderWizard);
  if (w.step === 3) bindEngine(root, () => { Object.assign(d, S.cfg); renderWizard(); });
  $("#wz-back")?.addEventListener("click", () => { w.step--; renderWizard(); });
  $("#wz-next").onclick = async () => {
    try {
      if (w.step === 3) { const ev = engineValues(); S.cfg = await api("/api/config", { method: "POST", body: ev }); Object.assign(d, S.cfg); }
      if (w.step === 4) {
        S.cfg = await api("/api/config", { method: "POST", body: { transcriptsDir: d.transcriptsDir, outputDir: d.outputDir, product: { name: $("#prod-name").value.trim(), description: $("#prod-desc").value.trim() }, setupDone: true } });
        S.wiz = null; await Promise.all([loadKb(), loadProcess()]); S.view = S.kb ? "personas" : "process"; renderChrome(); render(); return;
      }
      w.step++; renderWizard();
    } catch (e) { toast(e.message); }
  };
}

boot().catch((e) => { $("#main").innerHTML = `<p class="notice">The app couldn't start: ${esc(e.message)}. Is the server running?</p>`; });
