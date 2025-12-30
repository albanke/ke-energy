import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import nodemailer from "nodemailer";
import twilio from "twilio";
import fs from "fs/promises";

import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TRUST_PROXY = String(process.env.TRUST_PROXY || "false").toLowerCase() === "true";
app.set("trust proxy", TRUST_PROXY);

// -------------------- DB (JSON via lowdb) --------------------
const dataDir = path.join(__dirname, "data");
const dbFile = path.join(dataDir, "contatti.json");

await fs.mkdir(dataDir, { recursive: true });

const adapter = new JSONFile(dbFile);
const db = new Low(adapter, { contatti: [], meta: { lastId: 0 } });
await db.read();
db.data ||= { contatti: [], meta: { lastId: 0 } };
db.data.contatti ||= [];
db.data.meta ||= { lastId: 0 };
await db.write();

function nextId() {
  db.data.meta.lastId = Number(db.data.meta.lastId || 0) + 1;
  return db.data.meta.lastId;
}

// -------------------- Helpers --------------------
function isEmail(v) {
  return typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}
function cleanStr(v, max = 5000) {
  if (v === undefined || v === null) return "";
  return String(v).trim().slice(0, max);
}
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function toCsvValue(v) {
  const s = v === null || v === undefined ? "" : String(v);
  const needsQuote = /[",\n\r;]/.test(s);
  const esc = s.replaceAll('"', '""');
  return needsQuote ? `"${esc}"` : esc;
}

// -------------------- Email --------------------
function canSendEmail() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.MAIL_TO);
}
function getMailer() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = String(process.env.SMTP_SECURE || "true").toLowerCase() === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });
}
async function sendContactEmail(row) {
  if (!canSendEmail()) return { ok: false, skipped: true, reason: "SMTP not configured" };

  const transporter = getMailer();
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  const to = process.env.MAIL_TO;

  const subject = `Nuovo contatto dal sito (#${row.id}) - ${row.nome}`;
  const text =
`Nuovo contatto dal sito

ID: ${row.id}
Data: ${row.created_at}

Nome: ${row.nome}
Azienda: ${row.azienda || "-"}
Telefono: ${row.telefono}
Email: ${row.email}
Indirizzo: ${row.indirizzo || "-"}

Note:
${row.note || "-"}`;

  await transporter.sendMail({ from, to, subject, text });
  return { ok: true };
}

// -------------------- WhatsApp (Twilio) --------------------
function canSendWhatsApp() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_WHATSAPP_FROM &&
    process.env.TWILIO_WHATSAPP_TO
  );
}
async function sendWhatsApp(row) {
  if (!canSendWhatsApp()) return { ok: false, skipped: true, reason: "Twilio not configured" };

  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

  const body =
`Nuovo contatto dal sito (#${row.id})
Nome: ${row.nome}
Telefono: ${row.telefono}
Email: ${row.email}
Azienda: ${row.azienda || "-"}
Note: ${(row.note || "-").slice(0, 400)}`;

  await client.messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM,
    to: process.env.TWILIO_WHATSAPP_TO,
    body
  });

  return { ok: true };
}

// -------------------- Middleware --------------------
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan("combined"));
app.use(express.json({ limit: "200kb" }));

const apiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 25,
  standardHeaders: true,
  legacyHeaders: false
});

// -------------------- API: salva contatto --------------------
app.post("/api/contatti", apiLimiter, async (req, res) => {
  const nome = cleanStr(req.body?.nome, 160);
  const azienda = cleanStr(req.body?.azienda, 160);
  const telefono = cleanStr(req.body?.telefono, 60);
  const email = cleanStr(req.body?.email, 160);
  const indirizzo = cleanStr(req.body?.indirizzo, 220);
  const note = cleanStr(req.body?.note, 5000);

  if (!nome) return res.status(400).json({ error: "Inserisci nome e cognome." });
  if (!telefono) return res.status(400).json({ error: "Inserisci un numero di telefono." });
  if (!email || !isEmail(email)) return res.status(400).json({ error: "Inserisci un'email valida." });

  await db.read();

  const row = {
    id: nextId(),
    created_at: new Date().toISOString(),
    nome,
    azienda: azienda || null,
    telefono,
    email,
    indirizzo: indirizzo || null,
    note: note || null
  };

  db.data.contatti.unshift(row);
  await db.write();

  const results = { email: null, whatsapp: null };
  try { results.email = await sendContactEmail(row); } catch { results.email = { ok:false, error:"Email send failed" }; }
  try { results.whatsapp = await sendWhatsApp(row); } catch { results.whatsapp = { ok:false, error:"WhatsApp send failed" }; }

  return res.status(201).json({ ok: true, id: row.id, notify: results });
});

// -------------------- Admin Auth (Basic) --------------------
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "change-me-strong";

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || "";
  const [type, token] = auth.split(" ");
  if (type !== "Basic" || !token) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Admin"');
    return res.status(401).send("Auth required");
  }
  const decoded = Buffer.from(token, "base64").toString("utf8");
  const idx = decoded.indexOf(":");
  const user = idx >= 0 ? decoded.slice(0, idx) : "";
  const pass = idx >= 0 ? decoded.slice(idx + 1) : "";
  if (user !== ADMIN_USER || pass !== ADMIN_PASS) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Admin"');
    return res.status(401).send("Invalid credentials");
  }
  next();
}

app.use(express.urlencoded({ extended: false }));

// -------------------- Admin UI --------------------
app.get("/admin", requireAdmin, async (req, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = 25;
  const offset = (page - 1) * limit;

  await db.read();
  const total = db.data.contatti.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const rows = db.data.contatti.slice(offset, offset + limit);

  const rowsHtml = rows.map(r => `
    <tr>
      <td>${r.id}</td>
      <td>${escapeHtml(r.created_at)}</td>
      <td><strong>${escapeHtml(r.nome)}</strong><div class="muted">${escapeHtml(r.azienda || "")}</div></td>
      <td><a href="tel:${escapeHtml(r.telefono)}">${escapeHtml(r.telefono)}</a></td>
      <td><a href="mailto:${escapeHtml(r.email)}">${escapeHtml(r.email)}</a></td>
      <td>${escapeHtml(r.indirizzo || "")}</td>
      <td class="note">${escapeHtml((r.note || "").slice(0, 240))}${(r.note && r.note.length > 240) ? "…" : ""}</td>
      <td class="actions">
        <form method="POST" action="/admin/delete" onsubmit="return confirm('Cancellare questo contatto?');">
          <input type="hidden" name="id" value="${r.id}" />
          <button type="submit">Elimina</button>
        </form>
      </td>
    </tr>
  `).join("");

  const navHtml = `
    <div class="nav">
      <div>Totale: <strong>${total}</strong> • Pagina <strong>${page}</strong> di <strong>${pages}</strong></div>
      <div class="navlinks">
        <a href="/admin?page=1">Prima</a>
        <a href="/admin?page=${Math.max(1, page - 1)}">Indietro</a>
        <a href="/admin?page=${Math.min(pages, page + 1)}">Avanti</a>
        <a href="/admin?page=${pages}">Ultima</a>
        <a class="primary" href="/admin/export.csv">Esporta CSV</a>
      </div>
    </div>
  `;

  res.status(200).send(`
<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Admin | KE Group Energy</title>
  <style>
    body{ margin:0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; background:#0b0c0e; color:#e8eef2; }
    .wrap{ max-width:1200px; margin:0 auto; padding:22px; }
    .card{ background:#111317; border:1px solid rgba(255,255,255,.10); border-radius:16px; padding:16px; }
    h1{ margin:0 0 10px; font-size:22px; }
    .muted{ color: rgba(232,238,242,.70); font-size:12px; margin-top:4px; }
    .nav{ display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; margin:12px 0 14px; }
    .navlinks{ display:flex; gap:10px; flex-wrap:wrap; }
    a{ color:#fff; text-decoration:none; font-weight:800; }
    a:hover{ text-decoration:underline; }
    a.primary{ background: linear-gradient(135deg, #22c55e, #1fa84a); color:#fff; padding:10px 12px; border-radius:999px; }
    table{ width:100%; border-collapse:collapse; overflow:hidden; border-radius:14px; }
    th,td{ text-align:left; padding:12px 10px; border-top:1px solid rgba(255,255,255,.08); vertical-align:top; }
    th{ font-size:12px; text-transform:uppercase; letter-spacing:.06em; color: rgba(232,238,242,.70); }
    tr:hover td{ background: rgba(255,255,255,.03); }
    .note{ max-width:320px; }
    .actions button{
      background: rgba(255,255,255,.08);
      border:1px solid rgba(255,255,255,.14);
      color:#fff;
      border-radius:999px;
      padding:8px 10px;
      font-weight:900;
      cursor:pointer;
    }
    .actions button:hover{ filter:brightness(1.06); transform: translateY(-1px); }
    .top{ display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap; }
    .badge{ display:inline-block; padding:8px 10px; border-radius:999px; border:1px solid rgba(255,255,255,.14); background: rgba(255,255,255,.06); font-weight:900; }
    @media (max-width: 900px){
      table{ display:block; overflow-x:auto; white-space:nowrap; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="top">
        <div>
          <h1>Admin – Contatti</h1>
          <div class="muted">KE Group Energy • Pannello contatti (salvati in un file JSON locale).</div>
        </div>
        <div class="badge">Protezione: Basic Auth</div>
      </div>

      ${navHtml}

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Data</th>
            <th>Nome</th>
            <th>Telefono</th>
            <th>Email</th>
            <th>Indirizzo</th>
            <th>Note</th>
            <th>Azioni</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || `<tr><td colspan="8" class="muted">Nessun contatto presente.</td></tr>`}
        </tbody>
      </table>

      ${navHtml}
    </div>
  </div>
</body>
</html>
  `);
});

app.post("/admin/delete", requireAdmin, async (req, res) => {
  const id = Number(req.body?.id);
  if (!id) return res.status(400).send("Bad request");

  await db.read();
  db.data.contatti = db.data.contatti.filter(x => Number(x.id) !== id);
  await db.write();

  res.redirect("/admin");
});

app.get("/admin/export.csv", requireAdmin, async (req, res) => {
  await db.read();

  const header = ["id","created_at","nome","azienda","telefono","email","indirizzo","note"];
  const csvLines = [header.join(";")];

  for (const r of db.data.contatti) {
    csvLines.push([
      toCsvValue(r.id),
      toCsvValue(r.created_at),
      toCsvValue(r.nome),
      toCsvValue(r.azienda || ""),
      toCsvValue(r.telefono),
      toCsvValue(r.email),
      toCsvValue(r.indirizzo || ""),
      toCsvValue(r.note || "")
    ].join(";"));
  }

  const csv = csvLines.join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=contatti.csv");
  res.status(200).send(csv);
});
app.use("/pdf-ke-energy", express.static(path.join(__dirname, "pdf-ke-energy"), { fallthrough: false }));

// -------------------- Static front-end --------------------
// -------------------- Static front-end --------------------

// serve TUTTI i file statici (html, css, js, pdf, immagini)
app.use(express.static(__dirname));

// fallback SOLO per le pagine HTML
app.use((req, res) => {
  // se qualcuno chiede un PDF che non esiste, NON mandare la home
  if (req.path.endsWith(".pdf")) {
    return res.status(404).send("PDF non trovato");
  }

  res.status(404).sendFile(path.join(__dirname, "index.html"));
});

;

app.listen(PORT, () => {
  console.log(`Server avviato su http://localhost:${PORT}`);
  console.log(`Admin su http://localhost:${PORT}/admin`);
});
