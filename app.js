(() => {
  "use strict";
  const D = window.EDIZIONE;
  const app = document.getElementById("app");
  const byId = new Map(D.testi.map(t => [t.id, t]));

  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const h = (strings, ...vals) => strings.reduce((a, s, i) => a + s + (i < vals.length ? vals[i] : ""), "");
  const fmt = (v, d = 2) => v == null ? "—" : (Number.isInteger(v) ? String(v) : v.toFixed(d).replace(".", ","));

  const STATO_ORIG = {
    partial: ["Originale parziale", "b-warn"],
    missing: ["Originale da trascrivere", "b-bad"],
    not_supplied: ["Originale non ancora nel corpus", "b-mut"],
    partial_16_file_plus_full_1800_supplement: ["Originale completo + allineamento", "b-ok"],
  };
  const STATO_IT = { bozza_OCR_da_collazionare: ["Bozza OCR da collazionare", "b-warn"] };
  const LINGUA = { en: "inglese", fr: "francese" };

  const badge = ([label, cls]) => `<span class="b ${cls}">${esc(label)}</span>`;
  const origBadge = t => badge(STATO_ORIG[t.stato_orig] || [t.stato_orig, "b-mut"]);
  const hasOrigLines = t => !!(t.originale && t.originale.righe.some(r => r.k === "l"));

  function setNav(key) {
    document.querySelectorAll("nav a").forEach(a => a.classList.toggle("on", a.dataset.nav === key));
  }

  // ───────────────────────── Indice ─────────────────────────
  const filt = { q: "", lingua: "", orig: "", img: false };

  function viewIndice() {
    setNav("indice");
    const autori = [...new Set(D.testi.map(t => t.autore))];
    app.innerHTML = h`
      <h1>Le traduzioni</h1>
      <p class="sub">${D.testi.length} testi tradotti da Attilio Bertolucci in <i>Imitazioni</i> (Scheiwiller, 1994),
        da ${autori.length} autori. Ordine della raccolta, raggruppati per autore.</p>
      <div class="filters">
        <input type="search" id="f-q" placeholder="Cerca titolo, autore o parola nel testo…" value="${esc(filt.q)}">
        <select id="f-lingua">
          <option value="">Tutte le lingue</option>
          <option value="en">Dall'inglese</option>
          <option value="fr">Dal francese</option>
        </select>
        <select id="f-orig">
          <option value="">Qualsiasi stato dell'originale</option>
          <option value="con">Con testo originale</option>
          <option value="missing">Originale da trascrivere</option>
          <option value="not_supplied">Originale non nel corpus</option>
        </select>
        <label><input type="checkbox" id="f-img" ${filt.img ? "checked" : ""}> con immagini d'archivio</label>
        <span class="count" id="f-count"></span>
      </div>
      <div id="lista"></div>`;
    app.querySelector("#f-lingua").value = filt.lingua;
    app.querySelector("#f-orig").value = filt.orig;
    const upd = () => {
      filt.q = app.querySelector("#f-q").value;
      filt.lingua = app.querySelector("#f-lingua").value;
      filt.orig = app.querySelector("#f-orig").value;
      filt.img = app.querySelector("#f-img").checked;
      renderLista();
    };
    app.querySelectorAll(".filters input, .filters select").forEach(el => el.addEventListener("input", upd));
    renderLista();
  }

  function match(t) {
    if (filt.lingua && t.lingua !== filt.lingua) return false;
    if (filt.orig === "con" && !hasOrigLines(t)) return false;
    if (filt.orig && filt.orig !== "con" && t.stato_orig !== filt.orig) return false;
    if (filt.img && !t.immagini.length) return false;
    const q = filt.q.trim().toLowerCase();
    if (!q) return true;
    const hay = [t.titolo, t.autore, t.originale?.titolo, ...t.it.map(r => r.t || "")].join(" ").toLowerCase();
    return hay.includes(q);
  }

  function renderLista() {
    const sel = D.testi.filter(match);
    app.querySelector("#f-count").textContent = `${sel.length} di ${D.testi.length}`;
    const groups = new Map();
    sel.forEach(t => { if (!groups.has(t.autore)) groups.set(t.autore, []); groups.get(t.autore).push(t); });
    app.querySelector("#lista").innerHTML = [...groups].map(([autore, list]) => h`
      <section class="author-group">
        <h3>${esc(autore)} <span class="small">· ${list.length} ${list.length === 1 ? "testo" : "testi"} · dal${list[0].lingua === "fr" ? " francese" : "l'inglese"}</span></h3>
        <div class="cards">${list.map(t => h`
          <a class="card" href="#/testo/${esc(t.id)}">
            <div class="card-t">${esc(t.titolo)}</div>
            <div class="card-m">${t.originale ? `<i>${esc(t.originale.titolo)}</i> · ` : ""}pp. ${esc(t.pagine)} · ${t.metriche.segment_count ?? "?"} segmenti</div>
            <div class="badges">${origBadge(t)}${t.immagini.length ? badge([`${t.immagini.length} immagini`, "b-acc"]) : ""}</div>
          </a>`).join("")}
        </div>
      </section>`).join("") || `<p class="sub">Nessun testo corrisponde ai filtri.</p>`;
  }

  // ───────────────────────── Testo ─────────────────────────
  function renderRows(rows, { prefix = "", align = false } = {}) {
    let out = "";
    for (const r of rows) {
      if (r.k === "ms") out += `<div class="ms">${r.unit === "stanza" ? "" : "n. "}${esc(r.n)}</div>`;
      else if (r.k === "gap") out += `<div class="gap">${r.reason === "partial-transcription"
        ? "Trascrizione parziale: i versi successivi non sono ancora stati inseriti."
        : "Testo non ancora trascritto."}</div>`;
      else {
        const n = parseInt(r.n, 10);
        out += `<div class="v"${align ? ` data-id="${esc(prefix + r.n)}"` : ""}><span class="n${n % 5 === 0 ? " show" : ""}">${esc(r.n)}</span><span class="t">${esc(r.t)}</span></div>`;
      }
    }
    return out;
  }

  function renderAligned(lines, words) {
    return lines.map(l => {
      const n = parseInt(l.n, 10);
      const body = words
        ? l.w.map(w => `<span class="w" data-w="${esc(w.id)}">${esc(w.t)}</span>`).join(" ")
        : esc(l.w.map(w => w.t).join(" "));
      return `<div class="v" data-id="${esc(l.id)}"><span class="n${n % 5 === 0 ? " show" : ""}">${esc(l.n)}</span><span class="t">${body}</span></div>`;
    }).join("");
  }

  function linkMap(pairs) {
    const m = new Map();
    for (const [a, b] of pairs) {
      if (!m.has(a)) m.set(a, new Set()); if (!m.has(b)) m.set(b, new Set());
      m.get(a).add(b); m.get(b).add(a);
    }
    return m;
  }

  function corpusRange(key) {
    const vals = D.testi.map(t => t.metriche[key]).filter(v => v != null).sort((a, b) => a - b);
    return { min: vals[0], max: vals[vals.length - 1], med: vals[Math.floor(vals.length / 2)] };
  }

  function metricRow(label, key, v, d) {
    const r = corpusRange(key);
    const pct = v == null || r.max === r.min ? 0 : ((v - r.min) / (r.max - r.min)) * 100;
    const med = r.max === r.min ? 0 : ((r.med - r.min) / (r.max - r.min)) * 100;
    return `<dt>${label}</dt><dd>${fmt(v, d)}<div class="bar"><span style="width:${pct}%"></span><em style="left:${med}%" title="mediana del corpus"></em></div></dd>`;
  }

  function viewTesto(id, params) {
    const t = byId.get(id);
    if (!t) return viewNotFound();
    setNav("indice");
    const idx = D.testi.indexOf(t);
    const prev = D.testi[idx - 1], next = D.testi[idx + 1];
    const al = t.allineamento;
    const modes = al ? ["traduzione", "versi", "parole"] : hasOrigLines(t) ? ["traduzione", "affiancato"] : ["traduzione"];
    const mode = modes.includes(params.get("m")) ? params.get("m") : (modes.length > 1 ? modes[1] : modes[0]);
    const labels = { traduzione: "Solo traduzione", affiancato: "Affiancato all'originale", versi: "Allineamento per versi", parole: "Allineamento per parole" };
    const isProse = t.it.some(r => r.k === "seg");

    let cols;
    if (al && mode !== "traduzione") {
      cols = h`
        <div class="cols two align${mode === "parole" ? " words" : ""}" id="cols">
          <div class="col">
            <h3>Originale · Wordsworth</h3>
            <div class="src">Nutting, testo di riferimento 1800 (non necessariamente l'edizione letta da Bertolucci)</div>
            <div class="poem-title">Nutting</div>
            <div class="poem">${renderAligned(al.en, mode === "parole")}</div>
          </div>
          <div class="col">
            <h3>Traduzione · Bertolucci</h3>
            <div class="src">Per nocciole, 1994 — trascrizione rivista (prima verifica sul PDF)</div>
            <div class="poem-title">Per nocciole</div>
            <div class="poem">${renderAligned(al.it, mode === "parole")}</div>
          </div>
        </div>
        <div class="legend">
          <span><i style="background:var(--hl)"></i>elemento sotto il cursore</span>
          <span><i style="background:var(--hl2)"></i>corrispondenza proposta da Smart Align</span>
          ${mode === "versi" ? `<span>⚑ verso con più corrispondenze (duplicati/discordanze dell'export)</span><span><i style="border-bottom:1px dashed #c9a"></i>verso italiano non collegato</span>` : `<span>parole sottolineate = con collegamento letterale</span>`}
        </div>
        <div class="warnbox">Allineamento automatico Smart Align (DiScEPT) <b>non revisionato</b>:
          ${al.stats.semantic_raw} collegamenti tra versi (${al.stats.semantic_unique} unici), ${al.stats.literal} collegamenti tra parole.
          Le corrispondenze sono proposte da verificare, non risultati.</div>`;
    } else {
      const showOrig = mode === "affiancato";
      cols = h`
        <div class="cols${showOrig ? " two" : ""}">
          ${showOrig ? h`<div class="col">
            <h3>Originale · ${esc(t.autore)}</h3>
            <div class="src"><a href="${esc(t.originale.fonte)}" target="_blank" rel="noopener noreferrer">fonte</a> — ${esc(t.originale.nota)}</div>
            <div class="poem-title">${esc(t.originale.titolo)}</div>
            <div class="poem">${renderRows(t.originale.righe)}</div>
          </div>` : ""}
          <div class="col">
            <h3>Traduzione · Bertolucci</h3>
            <div class="src">${al ? "Bozza OCR (la versione rivista è nelle viste di allineamento)" : "Bozza da estrazione automatica del PDF, da collazionare con la stampa"}</div>
            <div class="poem-title">${esc(t.titolo)}</div>
            <div class="poem${isProse ? " prose" : ""}">${renderRows(t.it)}</div>
          </div>
        </div>`;
    }

    const origPanel = t.originale ? h`
      <div class="panel">
        <h3>Testo originale</h3>
        <dl>
          <dt>Titolo</dt><dd><i>${esc(t.originale.titolo)}</i></dd>
          <dt>Stato</dt><dd>${origBadge(t)}</dd>
          <dt>Fonte</dt><dd><a href="${esc(t.originale.fonte)}" target="_blank" rel="noopener noreferrer">${esc(t.originale.fonte.replace(/^https?:\/\//, "").slice(0, 48))}…</a></dd>
          <dt>Nota</dt><dd>${esc(t.originale.nota)}</dd>
        </dl>
      </div>` : h`
      <div class="panel">
        <h3>Testo originale</h3>
        <p class="small">Questo testo non fa parte delle 16 coppie di lavoro: l'originale non è ancora stato individuato né trascritto.</p>
      </div>`;

    const m = t.metriche;
    app.innerHTML = h`
      <div class="crumbs">
        <a href="#/">← Tutte le traduzioni</a>
        <span>${prev ? `<a href="#/testo/${esc(prev.id)}">‹ ${esc(prev.titolo)}</a>` : ""}
          ${prev && next ? " · " : ""}${next ? `<a href="#/testo/${esc(next.id)}">${esc(next.titolo)} ›</a>` : ""}</span>
      </div>
      <h1>${esc(t.titolo)}</h1>
      <div class="meta">
        <span>da <b>${esc(t.autore)}</b>${t.originale ? `, <i>${esc(t.originale.titolo)}</i>` : ""}</span>
        <span>dal${t.lingua === "fr" ? " francese" : "l'inglese"}</span>
        <span><i>Imitazioni</i> 1994, pp. <b>${esc(t.pagine)}</b></span>
      </div>
      <div class="badges">${badge(STATO_IT[t.stato_it] || [t.stato_it, "b-mut"])}${origBadge(t)}${t.immagini.length ? badge([`${t.immagini.length} immagini d'archivio`, "b-acc"]) : ""}</div>
      ${isProse ? `<div class="warnbox">Traduzione in prosa: i segmenti sono righe tipografiche dell'estrazione automatica, non versi.</div>` : ""}
      ${t.artefatti ? `<div class="warnbox">Righe escluse come residui OCR: <code>${esc(t.artefatti)}</code></div>` : ""}
      ${modes.length > 1 ? h`
        <div class="toolbar">
          <span class="seg">${modes.map(k => `<button data-mode="${k}" class="${k === mode ? "on" : ""}">${labels[k]}</button>`).join("")}</span>
          <span class="sp"></span>
          ${al && mode !== "traduzione" ? `<span class="hint">Passa il cursore su ${mode === "parole" ? "una parola" : "un verso"} per vederne la corrispondenza.</span>` : ""}
        </div>` : ""}
      ${cols}
      ${al ? `<div class="toolbar"><a class="btn" href="#/allineamento">Vedi il processo di allineamento →</a></div>` : ""}
      ${t.immagini.length ? h`
        <h2>Materiali d'archivio collegati</h2>
        ${(t.diplomatiche || []).map(id => `<p><a class="btn" href="#/diplomatica/${esc(id)}">Trascrizione diplomatica del testimone →</a></p>`).join("")}
        <p class="small">Le immagini sono collegate al testo in base alla descrizione dell'inventario.</p>
        <div class="strip">${t.immagini.map(f => thumbHTML(D.immagini.find(i => i.file === f), false)).join("")}</div>` : ""}
      <div class="panels">
        ${origPanel}
        <div class="panel">
          <h3>Indicatori stilistici <span class="small">(esplorativi)</span></h3>
          <dl>
            ${metricRow("Segmenti", "segment_count", m.segment_count)}
            ${metricRow("Token", "token_count", m.token_count)}
            ${metricRow("Forme distinte", "unique_wordforms", m.unique_wordforms)}
            ${metricRow("Token per verso", "mean_tokens_per_segment", m.mean_tokens_per_segment)}
            ${metricRow("MATTR-25", "mattr_25", m.mattr_25, 3)}
            ${metricRow("Righe senza punt. finale", "non_terminal_punctuation_rate", m.non_terminal_punctuation_rate, 2)}
          </dl>
          <p class="small">Barra = posizione nel corpus dei 43 testi (tacca = mediana). Calcolati sulle bozze OCR: non pubblicabili.
            “Righe senza punteggiatura finale” è solo una spia grezza, non una misura dell'enjambement.</p>
        </div>
      </div>`;

    app.querySelectorAll("[data-mode]").forEach(b => b.addEventListener("click", () => {
      location.hash = `#/testo/${t.id}?m=${b.dataset.mode}`;
    }));
    bindThumbs(t.immagini.map(f => D.immagini.find(i => i.file === f)));
    if (al && mode !== "traduzione") bindAlign(al, mode);
  }

  function bindAlign(al, mode) {
    const cols = document.getElementById("cols");
    if (mode === "versi") {
      const sem = linkMap(al.semantic);
      cols.querySelectorAll(".v[data-id]").forEach(el => {
        const s = sem.get(el.dataset.id);
        if (!s) el.classList.add("unlinked"), el.title = "Nessun collegamento Smart Align";
        else if (s.size > 1) el.classList.add("multi"), el.title = `${s.size} corrispondenze proposte`;
      });
      hover(cols, ".v[data-id]", "id", sem);
    } else {
      const lit = linkMap(al.literal);
      cols.querySelectorAll(".w[data-w]").forEach(el => { if (lit.has(el.dataset.w)) el.classList.add("lk"); });
      hover(cols, ".w[data-w]", "w", lit);
    }
  }

  function hover(root, sel, key, map) {
    let on = [];
    const clear = () => { on.forEach(e => e.classList.remove("hl", "hl2")); on = []; };
    root.addEventListener("mouseover", e => {
      const el = e.target.closest(sel);
      if (!el) return;
      clear();
      el.classList.add("hl"); on.push(el);
      for (const other of map.get(el.dataset[key]) || []) {
        const o = root.querySelector(`[data-${key}="${CSS.escape(other)}"]`);
        if (o) { o.classList.add("hl2"); on.push(o); }
      }
    });
    root.addEventListener("mouseleave", clear);
  }

  // ───────────────────────── Archivio ─────────────────────────
  function thumbHTML(im, showText = true) {
    const t = im.testo && byId.get(im.testo);
    return h`
      <div class="thumb${im.type === "duplicato" ? " dup" : ""}">
        <button data-img="${esc(im.file)}" title="Apri ${esc(im.file)}"><img loading="lazy" src="img/thumb/${encodeURIComponent(im.file)}" alt="${esc(im.description)}"></button>
        <div class="cap">
          <b>${esc(im.description)}</b>
          <span class="small">${esc(im.folio)} · ${esc(im.type)} · ${esc(im.file)}</span>
          ${showText && t ? `<div><a href="#/testo/${esc(t.id)}">→ ${esc(t.titolo)}</a></div>` : ""}
          ${(im.diplomatiche || []).map(id => `<div><a href="#/diplomatica/${esc(id)}">→ diplomatica: ${esc(dipById().get(id)?.titolo.replace(/ — .*/, "") || id)}</a></div>`).join("")}
        </div>
      </div>`;
  }

  function bindThumbs(list) {
    app.querySelectorAll("[data-img]").forEach(b => b.addEventListener("click", () => {
      openViewer(list, list.findIndex(i => i.file === b.dataset.img));
    }));
  }

  function viewArchivio() {
    setNav("archivio");
    const linked = D.immagini.filter(i => i.testo);
    const dup = D.immagini.filter(i => !i.testo && i.type === "duplicato");
    const other = D.immagini.filter(i => !i.testo && i.type !== "duplicato");
    const order = [...linked, ...other, ...dup];
    app.innerHTML = h`
      <h1>Archivio immagini</h1>
      <p class="sub">${D.immagini.length} fotografie di carte d'archivio. Accesso riservato: nessuna immagine è autorizzata alla pubblicazione.</p>
      <h2>Collegate a traduzioni di <i>Imitazioni</i> 1994</h2>
      <div class="thumbs">${linked.map(i => thumbHTML(i)).join("")}</div>
      <h2>Altri materiali</h2>
      <p class="small">Manoscritti e documenti con testi non compresi nella raccolta del 1994 (Yeats, Toulet, Wordsworth, Dryden…) o di contesto.</p>
      <div class="thumbs">${other.map(i => thumbHTML(i)).join("")}</div>
      <h2>Duplicati</h2>
      <div class="thumbs">${dup.map(i => thumbHTML(i)).join("")}</div>`;
    bindThumbs(order);
  }

  // ───────────────────────── Nota ─────────────────────────
  function viewNota() {
    setNav("nota");
    const n = k => D.testi.filter(t => t.stato_orig === k).length;
    app.innerHTML = h`
      <div class="prosa">
        <h1>Nota al testo</h1>
        <p>Questa è un'<b>edizione digitale di lavoro</b>, generata automaticamente dall'archivio di ricerca
          <code>${esc(D.generato_da)}</code>. Mostra lo stato attuale dei materiali: non è un'edizione critica.</p>
        <h2>Le traduzioni</h2>
        <p>I ${D.testi.length} testi derivano dall'estrazione automatica (OCR) del PDF dell'edizione Scheiwiller 1994.
          Righe, punteggiatura e divisione in versi vanno collazionate con la stampa; alcune segmentazioni non corrispondono
          a versi autentici. Gli spazi multipli dovuti alla giustificazione tipografica sono stati normalizzati per la lettura.
          Le due traduzioni dal francese (Baudelaire, Frénaud) sono in prosa e sono presentate per righe tipografiche.</p>
        <h2>Gli originali</h2>
        <table class="t">
          <tr><th>Stato</th><th>Testi</th></tr>
          <tr><td>Originale completo con allineamento (Nutting 1800)</td><td>${n("partial_16_file_plus_full_1800_supplement")}</td></tr>
          <tr><td>Originale parzialmente trascritto</td><td>${n("partial")}</td></tr>
          <tr><td>Originale individuato, da trascrivere</td><td>${n("missing")}</td></tr>
          <tr><td>Originale non ancora nel corpus di lavoro</td><td>${n("not_supplied")}</td></tr>
        </table>
        <p>Per <i>Nutting</i> si usa il testo del 1800 come <b>edizione di riferimento</b> per l'esperimento.
          Non si afferma che sia l'edizione effettivamente letta da Bertolucci: questa resta un'ipotesi da verificare con la collazione.</p>
        <h2>Allineamenti</h2>
        <p>L'unico allineamento disponibile è l'export Smart Align di DiScEPT per <i>Nutting / Per nocciole</i>, non revisionato.
          I collegamenti duplicati dell'export sono mostrati una sola volta; i versi con più corrispondenze sono segnalati.</p>
        <h2>Immagini</h2>
        <p>Le ${D.immagini.length} fotografie sono descritte secondo l'inventario dell'archivio. Solo il dattiloscritto di
          <i>Giacendo da svegli</i> (Hardy) è riconducibile a una traduzione della raccolta; le trascrizioni diplomatiche
          non sono ancora state eseguite.</p>
        <h2>Diritti</h2>
        <p><b>Materiale riservato.</b> Le traduzioni di Bertolucci sono protette e le fotografie non sono autorizzate alla
          pubblicazione. Questo sito è pensato per la consultazione locale del gruppo di ricerca.</p>
      </div>`;
  }

  function viewNotFound() {
    app.innerHTML = `<h1>Pagina non trovata</h1><p><a href="#/">Torna all'indice</a></p>`;
  }

  // ───────────────────────── Visore immagini ─────────────────────────
  const V = { el: document.getElementById("viewer"), stage: document.getElementById("viewer-stage"),
    img: document.getElementById("viewer-img"), cap: document.getElementById("viewer-cap"),
    list: [], i: 0, s: 1, r: 0, x: 0, y: 0 };

  function applyV() { V.img.style.transform = `translate(calc(-50% + ${V.x}px), calc(-50% + ${V.y}px)) rotate(${V.r}deg) scale(${V.s})`; }
  function fitV() {
    const w = V.img.naturalWidth, hh = V.img.naturalHeight;
    if (!w) return;
    const rot = V.r % 180 !== 0;
    const sw = V.stage.clientWidth - 20, sh = V.stage.clientHeight - 20;
    V.s = Math.min(sw / (rot ? hh : w), sh / (rot ? w : hh), 1);
    V.x = V.y = 0; applyV();
  }
  function showV() {
    const im = V.list[V.i];
    V.r = 0;
    V.img.onload = fitV;
    V.img.src = "img/" + encodeURIComponent(im.file);
    V.img.alt = im.description;
    V.cap.textContent = `${V.i + 1}/${V.list.length} · ${im.description} · ${im.folio} · ${im.file}`;
  }
  function openViewer(list, i) { V.list = list; V.i = Math.max(0, i); V.el.hidden = false; showV(); }
  function closeViewer() { V.el.hidden = true; V.img.removeAttribute("src"); }
  function zoomV(f, cx = 0, cy = 0) {
    const s2 = Math.min(8, Math.max(0.05, V.s * f));
    V.x = cx - (cx - V.x) * (s2 / V.s); V.y = cy - (cy - V.y) * (s2 / V.s); V.s = s2; applyV();
  }
  const actions = {
    close: closeViewer, reset: fitV, zoomin: () => zoomV(1.3), zoomout: () => zoomV(1 / 1.3),
    rotate: () => { V.r = (V.r + 90) % 360; fitV(); },
    prev: () => { V.i = (V.i - 1 + V.list.length) % V.list.length; showV(); },
    next: () => { V.i = (V.i + 1) % V.list.length; showV(); },
  };
  V.el.querySelectorAll("[data-v]").forEach(b => b.addEventListener("click", actions[b.dataset.v]));
  V.stage.addEventListener("wheel", e => {
    e.preventDefault();
    const r = V.stage.getBoundingClientRect();
    zoomV(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2);
  }, { passive: false });
  let drag = null;
  V.stage.addEventListener("pointerdown", e => { drag = { x: e.clientX - V.x, y: e.clientY - V.y }; V.stage.setPointerCapture(e.pointerId); V.stage.classList.add("drag"); });
  V.stage.addEventListener("pointermove", e => { if (drag) { V.x = e.clientX - drag.x; V.y = e.clientY - drag.y; applyV(); } });
  V.stage.addEventListener("pointerup", () => { drag = null; V.stage.classList.remove("drag"); });
  V.stage.addEventListener("dblclick", e => {
    const r = V.stage.getBoundingClientRect();
    zoomV(2, e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2);
  });
  document.addEventListener("keydown", e => {
    if (V.el.hidden) return;
    const k = { Escape: "close", ArrowLeft: "prev", ArrowRight: "next", "+": "zoomin", "=": "zoomin", "-": "zoomout", "0": "reset", r: "rotate" }[e.key];
    if (k) { e.preventDefault(); actions[k](); }
  });
  window.addEventListener("resize", () => { if (!V.el.hidden) fitV(); });

  // ───────────────────────── Pan & zoom generico ─────────────────────────
  function panZoom(stage, inner, box) {
    const st = { s: 1, x: 0, y: 0 };
    const apply = () => { inner.style.transform = `translate(${st.x}px, ${st.y}px) scale(${st.s})`; };
    const fit = () => {
      const [x1, y1, x2, y2] = box;
      const W = stage.clientWidth, H = stage.clientHeight;
      st.s = Math.min(W / (x2 - x1), H / (y2 - y1));
      st.x = (W - (x2 - x1) * st.s) / 2 - x1 * st.s;
      st.y = (H - (y2 - y1) * st.s) / 2 - y1 * st.s;
      apply();
    };
    const zoom = (f, cx, cy) => {
      const s2 = Math.min(10, Math.max(0.1, st.s * f));
      st.x = cx - (cx - st.x) * (s2 / st.s); st.y = cy - (cy - st.y) * (s2 / st.s); st.s = s2; apply();
    };
    stage.addEventListener("wheel", e => {
      e.preventDefault();
      const r = stage.getBoundingClientRect();
      zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    let drag = null, moved = false;
    stage.addEventListener("pointerdown", e => { drag = { x: e.clientX - st.x, y: e.clientY - st.y }; moved = false; });
    stage.addEventListener("pointermove", e => {
      if (!drag) return;
      if (!moved && Math.hypot(e.clientX - drag.x - st.x, e.clientY - drag.y - st.y) < 4) return;
      if (!moved) { stage.setPointerCapture(e.pointerId); stage.classList.add("drag"); }
      moved = true; st.x = e.clientX - drag.x; st.y = e.clientY - drag.y; apply();
    });
    stage.addEventListener("pointerup", () => { drag = null; stage.classList.remove("drag"); });
    const focus = z => {
      const W = stage.clientWidth, H = stage.clientHeight;
      const cx = (z[0] + z[2]) / 2, cy = (z[1] + z[3]) / 2;
      const sx = st.x + cx * st.s, sy = st.y + cy * st.s;
      if (sx < 0 || sx > W || sy < 0 || sy > H) { st.x = W / 2 - cx * st.s; st.y = H / 2 - cy * st.s; apply(); }
    };
    new ResizeObserver(fit).observe(stage);
    return { fit, zoom: f => zoom(f, stage.clientWidth / 2, stage.clientHeight / 2), focus, wasDrag: () => moved };
  }

  // ───────────────────────── Diplomatica ─────────────────────────
  const dipById = () => new Map((D.diplomatiche || []).map(d => [d.id, d]));

  function viewDiplomaticheIndice() {
    setNav("dipl");
    const list = D.diplomatiche || [];
    app.innerHTML = h`
      <h1>Trascrizioni diplomatiche</h1>
      <p class="sub">${list.length} carte trascritte su ${D.immagini.filter(i => i.type !== "duplicato").length} fotografie non duplicate.
        Le trascrizioni sono <b>bozze eseguite sulla fotografia</b>, da verificare sull'originale.</p>
      <div class="cards">${list.map(d => h`
        <a class="card" href="#/diplomatica/${esc(d.id)}">
          <div class="card-t">${esc(d.titolo.replace(/ — .*/, ""))}</div>
          <div class="card-m">${esc(d.descr.idno)}</div>
          <div class="card-m">${esc(d.descr.contenuto)}</div>
          <div class="badges">${badge(["Bozza da verificare", "b-warn"])}${d.testo ? badge(["Testimone di Imitazioni 1994", "b-acc"]) : badge(["Testo non compreso nel 1994", "b-mut"])}</div>
        </a>`).join("")}</div>
      <h2>Carte ancora da trascrivere</h2>
      <div class="thumbs">${D.immagini.filter(i => !i.diplomatiche.length && i.type !== "duplicato").map(i => thumbHTML(i)).join("")}</div>`;
    bindThumbs(D.immagini.filter(i => !i.diplomatiche.length && i.type !== "duplicato"));
  }

  function viewDiplomatica(id, params) {
    const d = dipById().get(id);
    if (!d) return viewNotFound();
    setNav("dipl");
    const mode = params.get("m") === "interp" ? "interp" : "dipl";
    const t = d.testo && byId.get(d.testo);
    const im = D.immagini.find(i => i.file === d.immagine);
    const zs = Object.values(d.zone);
    const box = [Math.min(...zs.map(z => z[0])) - 60, Math.min(...zs.map(z => z[1])) - 60,
      Math.max(...zs.map(z => z[2])) + 60, Math.max(...zs.map(z => z[3])) + 60];
    const noteFor = new Map();
    d.note.forEach((n, i) => { if (n.z) noteFor.set(n.z, [...(noteFor.get(n.z) || []), i + 1]); });
    const sup = z => (noteFor.get(z) || []).map(k => `<a class="nref" href="#nota-${k}" data-note="${k}">${k}</a>`).join("");
    const rows = d.righe.map(r => {
      if (r.k === "sp") return `<div class="spazio"></div>`;
      const cls = r.k === "head" ? "dh" : r.k === "fw" ? "dfw" : "";
      return `<div class="v dl ${cls}" data-z="${esc(r.z)}"><span class="n${r.n && r.n % 5 === 0 ? " show" : ""}">${esc(r.n || "")}</span><span class="t">${r[mode]}${sup(r.z)}</span></div>`;
    }).join("");
    const coll = d.collazione;
    app.innerHTML = h`
      <div class="crumbs"><a href="#/diplomatiche">← Trascrizioni diplomatiche</a>
        <span><a href="tei/${encodeURIComponent(d.file)}" download>Scarica TEI</a></span></div>
      <h1>${esc(d.titolo.replace(/ — .*/, ""))}</h1>
      <div class="meta"><span>${esc(d.descr.idno)}</span>${t ? `<span>testimone di <a href="#/testo/${esc(t.id)}">${esc(t.titolo)}</a> (Imitazioni 1994)</span>` : ""}</div>
      <div class="warnbox"><b>Bozza di trascrizione diplomatica</b> eseguita sulla fotografia con l'assistenza di un modello linguistico.
        Le letture contrassegnate come incerte e gli interventi d'autore vanno verificati sull'originale prima di qualsiasi uso.</div>
      <div class="toolbar">
        <span class="seg">
          <button data-mode="dipl" class="${mode === "dipl" ? "on" : ""}">Diplomatica</button>
          <button data-mode="interp" class="${mode === "interp" ? "on" : ""}">Interpretativa (ultima lezione)</button>
        </span>
        <span class="seg"><button data-pz="out">−</button><button data-pz="fit">Adatta</button><button data-pz="in">+</button></span>
        <span class="sp"></span>
        <span class="hint">Passa su una riga o su un riquadro dell'immagine per collegarli.</span>
      </div>
      <div class="dipl-wrap">
        <div class="facs" id="facs">
          <div class="facs-in" id="facs-in" style="width:2048px;height:1536px">
            <img src="img/${encodeURIComponent(d.immagine)}" width="2048" height="1536" alt="${esc(im?.description || "")}" draggable="false">
            <svg viewBox="0 0 2048 1536" width="2048" height="1536">${Object.entries(d.zone).map(([zid, z]) =>
              `<rect data-z="${esc(zid)}" x="${z[0]}" y="${z[1]}" width="${z[2] - z[0]}" height="${z[3] - z[1]}"/>`).join("")}</svg>
          </div>
        </div>
        <div class="trascr ${mode}" id="trascr">
          <div class="poem">${rows}</div>
          ${mode === "dipl" ? `<div class="legend"><span><del class="d">cancellato</del></span><span><ins class="sup">aggiunto in interlinea</ins></span>
            <span><span class="unc">lettura incerta</span></span><span><span class="gp">[…]</span> illeggibile</span><span><span class="red">inchiostro rosso</span></span></div>` : ""}
        </div>
      </div>
      <div class="panels">
        <div class="panel"><h3>Descrizione</h3><dl>
          <dt>Contenuto</dt><dd>${esc(d.descr.contenuto)}</dd>
          <dt>Supporto</dt><dd>${esc(d.descr.supporto)}</dd>
          <dt>Scrittura</dt><dd>${esc(d.descr.mano)}</dd></dl></div>
        <div class="panel"><h3>Note di trascrizione</h3><ol class="notes">${d.note.map((n, i) =>
          `<li id="nota-${i + 1}" data-z="${esc(n.z)}">${n.html}</li>`).join("")}</ol></div>
      </div>
      ${coll ? h`
        <h2>Collazione con il testo del 1994</h2>
        <p class="small">Dattiloscritto (questa carta, lettura interpretativa) confrontato con la bozza OCR di <i>Imitazioni</i> 1994.
          Divisione in strofe: testimone ${coll.pause_testimone + 1} strofe, file 1994 ${coll.pause_1994 ? coll.pause_1994 + 1 + " strofe" : "senza divisione strofica codificata"}.</p>
        <table class="t coll">
          <tr><th>v.</th><th>Dattiloscritto</th><th>Imitazioni 1994 (OCR)</th><th>Varianti</th></tr>
          ${coll.righe.map(r => `<tr class="${r.diff.length ? "var" : ""}"><td>${r.n}</td><td>${esc(r.a)}</td><td>${esc(r.b)}</td>
            <td>${r.diff.length ? r.diff.map(([op, a, b]) => `${esc(a || "∅")} ] ${esc(b || "∅")}`).join("; ") : "—"}</td></tr>`).join("")}
        </table>
        <p class="small">${coll.righe.filter(r => r.diff.length).length
          ? "Le differenze sono solo di punteggiatura o di battitura; il testo verbale coincide."
          : "Nessuna variante verbale."}${coll.pause_testimone && !coll.pause_1994 ? " La divisione strofica del dattiloscritto andrebbe riportata nel TEI del 1994, dopo averla verificata sulla stampa." : ""}</p>` : ""}`;

    app.querySelectorAll("[data-mode]").forEach(b => b.addEventListener("click", () => { location.hash = `#/diplomatica/${d.id}?m=${b.dataset.mode}`; }));
    const facs = document.getElementById("facs");
    const pz = panZoom(facs, document.getElementById("facs-in"), box);
    app.querySelectorAll("[data-pz]").forEach(b => b.addEventListener("click", () =>
      b.dataset.pz === "fit" ? pz.fit() : pz.zoom(b.dataset.pz === "in" ? 1.3 : 1 / 1.3)));
    // collegamento riga ↔ zona
    let on = [];
    const light = z => {
      on.forEach(e => e.classList.remove("hl")); on = [];
      if (!z) return;
      app.querySelectorAll(`[data-z="${CSS.escape(z)}"]`).forEach(e => { e.classList.add("hl"); on.push(e); });
    };
    [app.querySelector(".dipl-wrap"), app.querySelector(".notes")].forEach(root => root.addEventListener("mouseover", e => {
      const el = e.target.closest("[data-z]");
      light(el ? el.dataset.z : null);
    }));
    document.getElementById("trascr").addEventListener("click", e => {
      const el = e.target.closest(".v[data-z]");
      if (el && d.zone[el.dataset.z]) pz.focus(d.zone[el.dataset.z]);
    });
    facs.addEventListener("click", e => {
      const r = e.target.closest("rect[data-z]");
      if (!r || pz.wasDrag()) return;
      app.querySelector(`.trascr [data-z="${CSS.escape(r.dataset.z)}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }

  // ───────────────────────── Processo di allineamento ─────────────────────────
  const CATEGORIE = ["", "corrispondenza", "risegmentazione", "espansione", "concisione", "omissione", "aggiunta",
    "esplicitazione", "cambio di immagine", "inversione sintattica", "modulazione lessicale"];
  const REV_KEY = "imitazioni.revisione.nutting.v1";
  const loadRev = () => { try { return JSON.parse(localStorage.getItem(REV_KEY)) || {}; } catch { return {}; } };
  const saveRev = r => localStorage.setItem(REV_KEY, JSON.stringify(r));

  function alignAnalysis(al) {
    const enIds = al.en.map(l => l.id), itIds = al.it.map(l => l.id);
    const seen = new Map(), dups = [];
    al.semantic_raw.forEach(([a, b], i) => {
      const k = a + " " + b;
      if (seen.has(k)) dups.push({ i, a, b, first: seen.get(k) }); else seen.set(k, i);
    });
    const byEn = new Map(), byIt = new Map();
    al.semantic.forEach(([a, b]) => {
      byEn.set(a, [...(byEn.get(a) || []), b]); byIt.set(b, [...(byIt.get(b) || []), a]);
    });
    const discord = [...byEn].filter(([a, bs]) => bs.length > 1 && !a.endsWith("head"));
    const unlinkedIt = itIds.filter(id => !byIt.has(id));
    const unlinkedEn = enIds.filter(id => !byEn.has(id));
    const idx = (list, id) => list.indexOf(id);
    const pairs = al.semantic.filter(([a, b]) => idx(enIds, a) >= 0 && idx(itIds, b) >= 0)
      .map(([a, b]) => [idx(enIds, a), idx(itIds, b)]).sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    let crossing = 0;
    for (let i = 0; i < pairs.length; i++) for (let j = i + 1; j < pairs.length; j++)
      if ((pairs[i][0] - pairs[j][0]) * (pairs[i][1] - pairs[j][1]) < 0) crossing++;
    const wordsEn = al.en.reduce((s, l) => s + l.w.length, 0), wordsIt = al.it.reduce((s, l) => s + l.w.length, 0);
    const litEn = new Set(al.literal.map(p => p[0])), litIt = new Set(al.literal.map(p => p[1]));
    const offCorpus = al.semantic.filter(([a, b]) => idx(enIds, a) < 0 || idx(itIds, b) < 0);
    return { enIds, itIds, dups, discord, unlinkedIt, unlinkedEn, crossing, wordsEn, wordsIt,
      covEn: litEn.size / wordsEn, covIt: litIt.size / wordsIt, offCorpus, byEn, byIt };
  }

  const lineText = l => l.w.map(w => w.t).join(" ");

  function ribbonSVG(al, an, rev) {
    const W = 760, rowH = 11, top = 26;
    const H = top + Math.max(al.en.length, al.it.length) * rowH + 10;
    const xL = 250, xR = W - 250;
    const yE = i => top + i * rowH + rowH / 2, yI = yE;
    const lines = al.semantic.map(([a, b]) => {
      const i = an.enIds.indexOf(a), j = an.itIds.indexOf(b);
      if (i < 0 || j < 0) return "";
      const k = a + " " + b, st = rev[k]?.stato || "";
      const multi = an.byEn.get(a).length > 1 || an.byIt.get(b).length > 1;
      const cls = ["lk", st, multi ? "multi" : ""].join(" ");
      return `<path class="${cls}" data-k="${esc(k)}" d="M${xL},${yE(i)} C${(xL + xR) / 2},${yE(i)} ${(xL + xR) / 2},${yI(j)} ${xR},${yI(j)}"/>`;
    }).join("");
    const lab = (list, x, anchor, side) => list.map((l, i) => {
      const unl = side === "it" ? an.unlinkedIt.includes(l.id) : an.unlinkedEn.includes(l.id);
      const txt = lineText(l); const short = txt.length > 34 ? txt.slice(0, 33) + "…" : txt;
      return `<text class="rl${unl ? " unl" : ""}" data-id="${esc(l.id)}" x="${x}" y="${yE(i) + 3.5}" text-anchor="${anchor}">${anchor === "end" ? esc(short) + "  " + l.n : l.n + "  " + esc(short)}</text>`;
    }).join("");
    return `<svg class="ribbon" viewBox="0 0 ${W} ${H}" width="100%">
      <text x="${xL}" y="12" text-anchor="end" class="rh">Nutting (EN) · ${al.en.length} versi</text>
      <text x="${xR}" y="12" class="rh">Per nocciole (IT) · ${al.it.length} versi</text>
      ${lines}${lab(al.en, xL - 6, "end", "en")}${lab(al.it, xR + 6, "start", "it")}</svg>`;
  }

  function exportTEI(al, rev, extra) {
    const now = new Date().toISOString().slice(0, 10);
    const links = al.semantic.map(([a, b]) => ({ a, b, r: rev[a + " " + b] || {} }))
      .concat(extra.map(([a, b]) => ({ a, b, r: rev[a + " " + b] || { stato: "ok" }, nuovo: true })));
    const attr = r => [
      r.stato === "ok" ? 'cert="high"' : r.stato === "dubbio" ? 'cert="low"' : 'cert="unknown"',
      r.cat ? `ana="#${r.cat.replace(/\s+/g, "-")}"` : "",
    ].filter(Boolean).join(" ");
    const body = links.filter(l => l.r.stato !== "no").map(l =>
      `    <link type="Semantic" target="#${l.a} #${l.b}" ${attr(l.r)}${l.nuovo ? ' resp="#revisore" source="manual"' : ' source="#smartalign"'}>${l.r.nota ? `\n      <note>${esc(l.r.nota)}</note>\n    ` : ""}</link>`).join("\n");
    const rejected = links.filter(l => l.r.stato === "no").map(l =>
      `    <!-- rifiutato: #${l.a} #${l.b}${l.r.nota ? " — " + esc(l.r.nota).replace(/--/g, "–") : ""} -->`).join("\n");
    return `<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <teiHeader><fileDesc>
    <titleStmt><title>Nutting / Per nocciole — allineamento rivisto</title>
      <respStmt xml:id="revisore"><resp>revisione manuale dei collegamenti</resp><name>DA COMPILARE</name></respStmt></titleStmt>
    <publicationStmt><p>Riservato. Generato dall'edizione di lavoro il ${now}.</p></publicationStmt>
    <sourceDesc><p xml:id="smartalign">Proposte iniziali: export Smart Align (DiScEPT), deduplicato.</p></sourceDesc>
  </fileDesc>
  <encodingDesc><classDecl><taxonomy xml:id="shift">
${CATEGORIE.filter(Boolean).map(c => `    <category xml:id="${c.replace(/\s+/g, "-")}"><catDesc>${c}</catDesc></category>`).join("\n")}
  </taxonomy></classDecl></encodingDesc></teiHeader>
  <standOff>
  <linkGrp type="translation">
${body}
${rejected}
  </linkGrp>
  </standOff>
</TEI>
`;
  }

  function viewAllineamento(params) {
    setNav("allin");
    const t = D.testi.find(x => x.allineamento);
    const al = t.allineamento, an = alignAnalysis(al);
    const rev = loadRev();
    const extra = rev.__extra || [];
    const step = ["1", "2", "3", "4", "5"].includes(params.get("s")) ? params.get("s") : "1";
    const steps = [["1", "Testi e segmentazione"], ["2", "Proposte automatiche"], ["3", "Controllo automatico"],
      ["4", "Revisione dello studioso"], ["5", "Fenomeni traduttivi"]];
    const keys = al.semantic.map(([a, b]) => a + " " + b);
    const done = keys.filter(k => rev[k]?.stato).length;
    const enL = id => al.en.find(l => l.id === id), itL = id => al.it.find(l => l.id === id);

    let body = "";
    if (step === "1") {
      body = h`
        <p>Il punto di partenza sono due testi codificati in TEI, con un <code>xml:id</code> stabile per ogni verso e ogni parola,
          così che i collegamenti possano stare in un file separato (<i>stand-off</i>).</p>
        <div class="panels">
          <div class="panel"><h3>Nutting (1800) — testo di riferimento</h3><dl>
            <dt>Versi</dt><dd>${al.en.length}</dd><dt>Token</dt><dd>${an.wordsEn}</dd>
            <dt>Token per verso</dt><dd>${fmt(an.wordsEn / al.en.length, 1)}</dd></dl></div>
          <div class="panel"><h3>Per nocciole (1994) — trascrizione rivista</h3><dl>
            <dt>Versi</dt><dd>${al.it.length} (${al.it.length > al.en.length ? "+" : ""}${al.it.length - al.en.length}, ${fmt((al.it.length / al.en.length - 1) * 100, 1)}%)</dd>
            <dt>Token</dt><dd>${an.wordsIt}</dd><dt>Token per verso</dt><dd>${fmt(an.wordsIt / al.it.length, 1)}</dd></dl></div>
        </div>
        <h2>Tokenizzazione (primi versi)</h2>
        <div class="cols two tok">
          <div class="col">${al.en.slice(0, 6).map(l => `<div class="v"><span class="n">${l.n}</span><span class="t">${l.w.map(w => `<span class="tk">${esc(w.t)}</span>`).join("")}</span></div>`).join("")}</div>
          <div class="col">${al.it.slice(0, 6).map(l => `<div class="v"><span class="n">${l.n}</span><span class="t">${l.w.map(w => `<span class="tk">${esc(w.t)}</span>`).join("")}</span></div>`).join("")}</div>
        </div>
        <p class="small">La tokenizzazione è automatica (DiScEPT): la punteggiatura resta attaccata alle parole e i token non sono lemmi.
          La differenza di versi riflette la diversa segmentazione metrica, non misura di per sé un'espansione semantica.</p>`;
    } else if (step === "2") {
      body = h`
        <p>Smart Align ha proposto <b>${al.stats.semantic_raw}</b> collegamenti tra versi (<i>Semantic</i>) e <b>${al.stats.literal}</b>
          tra parole (<i>Literal</i>). Ogni curva collega un verso inglese a quello italiano corrispondente;
          le curve arancioni segnalano versi con più di una corrispondenza.</p>
        <div class="toolbar">
          <a class="btn ghost" href="tei/Nutting_SmartAlign_export_ORIGINALE_non_revisionato.tei" download>Scarica l'export DiScEPT originale (TEI)</a>
          <span class="hint">File così come esportato da Smart Align: non revisionato, con i duplicati. Si può reimportare in DiScEPT.
            La versione rivista si esporta dal passo 4.</span>
        </div>
        <div class="ribbon-wrap" id="ribbon">${ribbonSVG(al, an, rev)}</div>
        <div class="legend"><span><i style="background:#9a8f83"></i>proposta</span><span><i style="background:var(--warn)"></i>corrispondenze multiple</span>
          <span><i style="background:var(--ok)"></i>accettata</span><span><i style="background:var(--bad)"></i>rifiutata</span>
          <span><i style="background:#c9a"></i>verso senza collegamento</span></div>
        <p class="small">Un allineamento quasi diagonale indica che la traduzione segue l'ordine dell'originale; gli scarti verso il basso
          accumulano i versi in più della traduzione.</p>`;
    } else if (step === "3") {
      body = h`
        <p>Prima della revisione, un controllo automatico verifica la coerenza dell'export.</p>
        <table class="t">
          <tr><th>Controllo</th><th>Esito</th></tr>
          <tr><td>Collegamenti tra versi grezzi → unici</td><td>${al.stats.semantic_raw} → ${al.stats.semantic_unique} (<b>${an.dups.length} duplicati</b>: l'export ripete due serie di collegamenti)</td></tr>
          <tr><td>Versi inglesi con più corrispondenze (discordanze tra le due serie)</td><td>${an.discord.length}</td></tr>
          <tr><td>Versi italiani senza collegamento</td><td>${an.unlinkedIt.length}</td></tr>
          <tr><td>Versi inglesi senza collegamento</td><td>${an.unlinkedEn.length}</td></tr>
          <tr><td>Coppie di collegamenti che si incrociano (inversioni d'ordine)</td><td>${an.crossing}</td></tr>
          <tr><td>Copertura dei collegamenti tra parole</td><td>EN ${fmt(an.covEn * 100, 1)}% · IT ${fmt(an.covIt * 100, 1)}% (la copertura non indica accuratezza)</td></tr>
          <tr><td>Collegamenti fuori dai versi (titoli)</td><td>${an.offCorpus.length}</td></tr>
        </table>
        <h2>Discordanze</h2>
        <table class="t">${an.discord.map(([a, bs]) => `<tr><td>EN ${enL(a)?.n}: ${esc(lineText(enL(a)))}</td><td>${bs.map(b => `IT ${itL(b)?.n}: ${esc(lineText(itL(b)))}`).join("<br>")}</td></tr>`).join("")}</table>
        <h2>Versi italiani non collegati</h2>
        <table class="t">${an.unlinkedIt.map(id => `<tr><td>IT ${itL(id).n}</td><td>${esc(lineText(itL(id)))}</td></tr>`).join("")}</table>
        <p class="small">Un verso non collegato non è automaticamente un'aggiunta: spesso prosegue materiali dei versi inglesi vicini.</p>`;
    } else if (step === "4") {
      const pct = Math.round((done / keys.length) * 100);
      body = h`
        <p>Ogni proposta va <b>accettata</b>, <b>rifiutata</b> o segnata come <b>dubbia</b>, con una categoria di <i>shift</i> e una nota.
          Si possono aggiungere collegamenti mancanti. Le decisioni sono salvate in questo browser e si esportano come TEI <i>standOff</i>.</p>
        <div class="progress"><span style="width:${pct}%"></span></div>
        <p class="small">${done} di ${keys.length} proposte revisionate (${pct}%) · ${extra.length} collegamenti aggiunti a mano</p>
        <div class="toolbar">
          <label class="small"><input type="checkbox" id="only-open" ${params.get("aperti") ? "checked" : ""}> solo da revisionare</label>
          <label class="small"><input type="checkbox" id="only-multi" ${params.get("multi") ? "checked" : ""}> solo discordanze</label>
          <span class="sp"></span>
          <button class="btn" id="exp">Esporta TEI rivisto</button>
          <button class="btn ghost" id="reset">Azzera revisione</button>
        </div>
        <table class="t rev">
          <tr><th>EN</th><th>IT</th><th>Decisione</th><th>Categoria e nota</th></tr>
          ${[...al.semantic.map(([a, b]) => [a, b, false]), ...extra.map(([a, b]) => [a, b, true])].map(([a, b, nuovo]) => {
            const k = a + " " + b, r = rev[k] || {}, e = enL(a), i = itL(b);
            const multi = (an.byEn.get(a)?.length > 1) || (an.byIt.get(b)?.length > 1);
            if (params.get("aperti") && r.stato) return "";
            if (params.get("multi") && !multi) return "";
            return `<tr data-k="${esc(k)}" class="${r.stato || ""}${multi ? " multi" : ""}">
              <td><span class="n">${e ? e.n : "tit."}</span> ${e ? esc(lineText(e)) : "<i>Nutting</i> (titolo)"}</td>
              <td><span class="n">${i ? i.n : "tit."}</span> ${i ? esc(lineText(i)) : "<i>Per nocciole</i> (titolo)"}${nuovo ? ' <span class="b b-acc">manuale</span>' : ""}</td>
              <td class="dec"><button data-s="ok" title="Accetta">✓</button><button data-s="dubbio" title="Dubbio">?</button><button data-s="no" title="Rifiuta">✗</button></td>
              <td><select data-f="cat">${CATEGORIE.map(c => `<option${c === (r.cat || "") ? " selected" : ""} value="${c}">${c || "— categoria —"}</option>`).join("")}</select>
                <input data-f="nota" placeholder="nota" value="${esc(r.nota || "")}"></td></tr>`;
          }).join("")}
        </table>
        <h2>Aggiungi un collegamento</h2>
        <div class="toolbar">
          <select id="add-en">${al.en.map(l => `<option value="${l.id}">EN ${l.n} · ${esc(lineText(l).slice(0, 40))}</option>`).join("")}</select>
          <select id="add-it">${al.it.map(l => `<option value="${l.id}">IT ${l.n} · ${esc(lineText(l).slice(0, 40))}</option>`).join("")}</select>
          <button class="btn" id="add">Aggiungi</button>
        </div>`;
    } else {
      body = h`
        <p>Dopo la revisione, i collegamenti diventano la base per descrivere i <b>fenomeni traduttivi</b>.
          Questa è la prima lettura filologica dell'audit, ancora da verificare.</p>
        <table class="t">
          <tr><th>Fenomeno</th><th>EN</th><th>IT</th><th>Osservazione</th></tr>
          ${al.fenomeni.map(r => `<tr>${r.map(c => `<td>${esc(c).replace(/“([^”]+)”/g, "“<i>$1</i>”")}</td>`).join("")}</tr>`).join("")}
        </table>
        <p class="small">Il metodo prevede che il modello automatico proponga e lo studioso verifichi; similarità non prova influenza
          né una specifica edizione consultata da Bertolucci.</p>`;
    }

    app.innerHTML = h`
      <div class="crumbs"><a href="#/testo/${esc(t.id)}?m=versi">← Per nocciole: testo allineato</a><span></span></div>
      <h1>Il processo di allineamento</h1>
      <p class="sub"><i>Nutting</i> (Wordsworth, 1800) / <i>Per nocciole</i> (Bertolucci, 1994) — l'unica coppia con un export DiScEPT.
        Le altre 15 coppie hanno file di allineamento vuoti.</p>
      <ol class="stepper">${steps.map(([k, l]) => `<li class="${k === step ? "on" : ""}${+k < +step ? " past" : ""}"><a href="#/allineamento?s=${k}"><b>${k}</b>${l}</a></li>`).join("")}</ol>
      <section class="step">${body}</section>
      <div class="crumbs" style="margin-top:28px">
        <span>${+step > 1 ? `<a href="#/allineamento?s=${+step - 1}">‹ ${steps[+step - 2][1]}</a>` : ""}</span>
        <span>${+step < 5 ? `<a href="#/allineamento?s=${+step + 1}">${steps[+step][1]} ›</a>` : ""}</span>
      </div>`;

    if (step === "2") {
      const svg = app.querySelector(".ribbon");
      let on = [];
      svg.addEventListener("mouseover", e => {
        on.forEach(x => x.classList.remove("hl")); on = [];
        const el = e.target.closest("[data-id],[data-k]");
        if (!el) return;
        const ks = el.dataset.k ? [el.dataset.k] : keys.filter(k => k.split(" ").includes(el.dataset.id));
        ks.forEach(k => {
          svg.querySelectorAll(`[data-k="${CSS.escape(k)}"]`).forEach(x => { x.classList.add("hl"); on.push(x); });
          k.split(" ").forEach(id => svg.querySelectorAll(`[data-id="${CSS.escape(id)}"]`).forEach(x => { x.classList.add("hl"); on.push(x); }));
        });
        if (!ks.length) { el.classList.add("hl"); on.push(el); }
      });
    }
    if (step === "4") {
      const setQ = (k, v) => { const p = new URLSearchParams(params); p.set("s", "4"); v ? p.set(k, "1") : p.delete(k); location.hash = "#/allineamento?" + p; };
      app.querySelector("#only-open").addEventListener("change", e => setQ("aperti", e.target.checked));
      app.querySelector("#only-multi").addEventListener("change", e => setQ("multi", e.target.checked));
      app.querySelector(".rev").addEventListener("click", e => {
        const b = e.target.closest("[data-s]"); if (!b) return;
        const tr = b.closest("tr"), k = tr.dataset.k, r = loadRev();
        r[k] = { ...(r[k] || {}), stato: r[k]?.stato === b.dataset.s ? "" : b.dataset.s };
        saveRev(r); tr.className = (r[k].stato || "") + (tr.classList.contains("multi") ? " multi" : "");
        const n = keys.filter(x => r[x]?.stato).length;
        app.querySelector(".progress span").style.width = Math.round(n / keys.length * 100) + "%";
        app.querySelector(".progress + .small").firstChild.textContent = `${n} di ${keys.length} proposte revisionate (${Math.round(n / keys.length * 100)}%) · ${(r.__extra || []).length} collegamenti aggiunti a mano`;
      });
      app.querySelector(".rev").addEventListener("change", e => {
        const f = e.target.dataset.f; if (!f) return;
        const k = e.target.closest("tr").dataset.k, r = loadRev();
        r[k] = { ...(r[k] || {}), [f]: e.target.value }; saveRev(r);
      });
      app.querySelector("#add").addEventListener("click", () => {
        const a = app.querySelector("#add-en").value, b = app.querySelector("#add-it").value, r = loadRev();
        const ex = r.__extra || [];
        if (!keys.includes(a + " " + b) && !ex.some(([x, y]) => x === a && y === b)) ex.push([a, b]);
        r.__extra = ex; r[a + " " + b] = { stato: "ok", ...(r[a + " " + b] || {}) }; saveRev(r); route();
      });
      app.querySelector("#exp").addEventListener("click", () => {
        const r = loadRev();
        const blob = new Blob([exportTEI(al, r, r.__extra || [])], { type: "application/xml" });
        const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "Nutting_allineamento_rivisto.xml" });
        a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      });
      app.querySelector("#reset").addEventListener("click", () => {
        if (confirm("Cancellare tutte le decisioni di revisione salvate in questo browser?")) { localStorage.removeItem(REV_KEY); route(); }
      });
    }
  }

  // ───────────────────────── Router ─────────────────────────
  function route() {
    if (!V.el.hidden) closeViewer();
    const [path, qs] = location.hash.replace(/^#/, "").split("?");
    const params = new URLSearchParams(qs || "");
    const parts = path.split("/").filter(Boolean);
    if (!parts.length) viewIndice();
    else if (parts[0] === "testo") viewTesto(decodeURIComponent(parts[1] || ""), params);
    else if (parts[0] === "archivio") viewArchivio();
    else if (parts[0] === "diplomatiche") viewDiplomaticheIndice();
    else if (parts[0] === "diplomatica") viewDiplomatica(decodeURIComponent(parts[1] || ""), params);
    else if (parts[0] === "allineamento") viewAllineamento(params);
    else if (parts[0] === "nota") viewNota();
    else viewNotFound();
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);
  route();
})();
