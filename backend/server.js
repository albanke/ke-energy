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
import crypto from "crypto";
import multer from "multer";
import bcrypt from "bcryptjs";

import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";

dotenv.config();

const app = express();
// --- CORS (FIX Render + dominio custom) ---
const allowedOrigins = (process.env.FRONTEND_ORIGIN || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  // Header firma per capire se il nuovo backend è live
  res.setHeader("X-KE-BUILD", "cors-v1");

  const origin = req.headers.origin;

  if (origin && (allowedOrigins.includes(origin) || allowedOrigins.length === 0)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    // Se non usi cookie puoi lasciarlo, non dà fastidio
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

const PORT = Number(process.env.PORT || 3000);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TRUST_PROXY = String(process.env.TRUST_PROXY || "false").toLowerCase() === "true";
app.set("trust proxy", TRUST_PROXY);
// ---- CORS (for separate frontend domain) ----
const ALLOWED_ORIGINS = String(process.env.FRONTEND_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes("*"))) {
    // Echo back the requesting origin (needed for CORS, especially with credentials).
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }

  // Handle preflight
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// -------------------- DB (JSON via lowdb) --------------------
const dataDir = path.join(__dirname, "data");
const dbFile = path.join(dataDir, "contatti.json");

// Contenuti (prodotti/incentivi)
const contentFile = path.join(dataDir, "content.json");

await fs.mkdir(dataDir, { recursive: true });

// Uploads (immagini / pdf)
const uploadsDir = path.join(__dirname, "uploads");
await fs.mkdir(uploadsDir, { recursive: true });

const adapter = new JSONFile(dbFile);
const db = new Low(adapter, { contatti: [], meta: { lastId: 0 } });
await db.read();
db.data ||= { contatti: [], meta: { lastId: 0 } };
db.data.contatti ||= [];
db.data.meta ||= { lastId: 0 };
await db.write();

// DB contenuti: prodotti + incentivi
const contentAdapter = new JSONFile(contentFile);
const contentDb = new Low(contentAdapter, {
  prodotti: [],
  incentivi: [],
  meta: { lastProdottoId: 0, lastIncentivoId: 0 }
});
await contentDb.read();
contentDb.data ||= { prodotti: [], incentivi: [], meta: { lastProdottoId: 0, lastIncentivoId: 0 } };
contentDb.data.prodotti ||= [];
contentDb.data.incentivi ||= [];
contentDb.data.meta ||= { lastProdottoId: 0, lastIncentivoId: 0 };
await contentDb.write();

function nextId() {
  db.data.meta.lastId = Number(db.data.meta.lastId || 0) + 1;
  return db.data.meta.lastId;
}

function nextProdottoId() {
  contentDb.data.meta.lastProdottoId = Number(contentDb.data.meta.lastProdottoId || 0) + 1;
  return contentDb.data.meta.lastProdottoId;
}

function nextIncentivoId() {
  contentDb.data.meta.lastIncentivoId = Number(contentDb.data.meta.lastIncentivoId || 0) + 1;
  return contentDb.data.meta.lastIncentivoId;
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

// File statici caricati (PDF/immagini)
app.use("/uploads", express.static(uploadsDir, {
  fallthrough: false,
  maxAge: process.env.NODE_ENV === "production" ? "30d" : 0
}));

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

// -------------------- Admin Auth --------------------
// Migrazione: prima la password era in chiaro (ADMIN_PASS). Ora usiamo un hash.
// Il file viene creato automaticamente al primo avvio: backend/data/admin_auth.json
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "admin1234"; // usato SOLO per bootstrap/migrazione

const adminAuthFile = path.join(dataDir, "admin_auth.json");

async function loadOrCreateAdminAuth() {
  try {
    const raw = await fs.readFile(adminAuthFile, "utf8");
    const parsed = JSON.parse(raw);
    // backward-compat: se esisteva una password in chiaro nel file, convertila
    if (parsed && parsed.password && !parsed.passHash) {
      parsed.passHash = bcrypt.hashSync(String(parsed.password), 10);
      delete parsed.password;
      await fs.writeFile(adminAuthFile, JSON.stringify(parsed, null, 2), "utf8");
    }
    if (parsed && parsed.username && parsed.passHash) return parsed;
  } catch {
    // file non esiste o invalido: bootstrap sotto
  }

  const initial = {
    username: ADMIN_USER,
    passHash: bcrypt.hashSync(String(ADMIN_PASS), 10)
  };
  await fs.writeFile(adminAuthFile, JSON.stringify(initial, null, 2), "utf8");
  return initial;
}

const ADMIN_AUTH = await loadOrCreateAdminAuth();

// -------------------- Admin Auth (Token for /login.html) --------------------
// Token firmato (stateless): evita "Invalid session" dovuto a sessioni in memoria.
// Funziona anche dopo riavvii del server.
const TOKEN_TTL_MS = Number(process.env.ADMIN_TOKEN_TTL_MS || 8 * 60 * 60 * 1000); // 8h

const secretFile = path.join(dataDir, "admin_secret.txt");
let ADMIN_TOKEN_SECRET = cleanStr(process.env.ADMIN_TOKEN_SECRET || "", 200);
if (!ADMIN_TOKEN_SECRET) {
  try {
    ADMIN_TOKEN_SECRET = cleanStr(await fs.readFile(secretFile, "utf8"), 500);
  } catch {
    ADMIN_TOKEN_SECRET = crypto.randomBytes(32).toString("hex");
    await fs.writeFile(secretFile, ADMIN_TOKEN_SECRET, "utf8");
  }
}

function signTokenPayload(payloadB64) {
  return crypto.createHmac("sha256", ADMIN_TOKEN_SECRET).update(payloadB64).digest("base64url");
}

function issueToken(user) {
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = { u: user, exp };
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = signTokenPayload(payloadB64);
  return { token: `${payloadB64}.${sig}`, exp };
}

function requireToken(req, res, next) {
  const auth = req.headers.authorization || "";
  const [type, token] = auth.split(" ");
  if (type !== "Bearer" || !token) return res.status(401).json({ error: "Auth required" });

  const parts = String(token).split(".");
  if (parts.length !== 2) return res.status(401).json({ error: "Invalid session" });
  const [payloadB64, sig] = parts;

  try {
    const expected = signTokenPayload(payloadB64);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(401).json({ error: "Invalid session" });
    }

    const payloadJson = Buffer.from(payloadB64, "base64url").toString("utf8");
    const payload = JSON.parse(payloadJson);
    const exp = Number(payload?.exp || 0);
    if (!exp || Date.now() > exp) return res.status(401).json({ error: "Session expired" });
    req.adminUser = cleanStr(payload?.u || "", 80);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid session" });
  }
}

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
  const okUser = user === String(ADMIN_AUTH.username || ADMIN_USER);
  const okPass = okUser && bcrypt.compareSync(String(pass), String(ADMIN_AUTH.passHash || ""));
  if (!okUser || !okPass) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Admin"');
    return res.status(401).send("Invalid credentials");
  }
  next();
}

// -------------------- Upload (protetto) --------------------
// Consente di caricare file (immagini/PDF) e ottenere un URL.
// Usa PUBLIC_BASE_URL se front/back sono su domini diversi.
const PUBLIC_BASE_URL = cleanStr(process.env.PUBLIC_BASE_URL || "", 300).replace(/\/$/, "");

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase().slice(0, 10);
      const safeExt = /^[a-z0-9.]+$/i.test(ext) ? ext : "";
      const name = crypto.randomBytes(16).toString("hex") + safeExt;
      cb(null, name);
    }
  }),
  limits: { fileSize: Number(process.env.UPLOAD_MAX_BYTES || 8 * 1024 * 1024) }, // 8MB default
  fileFilter: (_req, file, cb) => {
    const t = String(file.mimetype || "").toLowerCase();
    const ok = t === "application/pdf" || t.startsWith("image/");
    if (!ok) return cb(new Error("Tipo file non supportato (solo immagini o PDF)."));
    cb(null, true);
  }
});

app.post("/api/admin/upload", requireToken, upload.single("file"), async (req, res) => {
  const f = req.file;
  if (!f) return res.status(400).json({ error: "Nessun file caricato" });
  const relUrl = `/uploads/${encodeURIComponent(f.filename)}`;
  const url = PUBLIC_BASE_URL ? (PUBLIC_BASE_URL + relUrl) : relUrl;
  return res.status(201).json({ ok: true, url, filename: f.filename, mime: f.mimetype, size: f.size });
});

// Handler errori upload (multer)
app.use((err, _req, res, next) => {
  if (!err) return next();
  const msg = err?.message || "Upload error";
  if (String(msg).toLowerCase().includes("file too large")) {
    return res.status(413).json({ error: "File troppo grande" });
  }
  if (String(msg).toLowerCase().includes("tipo file")) {
    return res.status(400).json({ error: msg });
  }
  return next(err);
});

app.use(express.urlencoded({ extended: false }));

// -------------------- API: Admin (login + contatti + contenuti) --------------------
app.post("/api/admin/login", apiLimiter, async (req, res) => {
  const user = cleanStr(req.body?.username, 80);
  const pass = cleanStr(req.body?.password, 160);

  const okUser = user === String(ADMIN_AUTH.username || ADMIN_USER);
  const okPass = okUser && bcrypt.compareSync(String(pass), String(ADMIN_AUTH.passHash || ""));
  if (!okUser || !okPass) return res.status(401).json({ error: "Credenziali non valide" });

  const { token, exp } = issueToken(user);
  return res.status(200).json({ ok: true, token, expiresAt: exp });
});

app.post("/api/admin/logout", requireToken, (_req, res) => {
  // Token stateless: lato server non c'è nulla da "dimenticare".
  // Il logout avviene cancellando il token dal browser.
  return res.status(200).json({ ok: true });
});

// Contatti (protetto)
app.get("/api/admin/contatti", requireToken, async (req, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.max(1, Math.min(100, Number(req.query.limit || 50)));
  const offset = (page - 1) * limit;
  await db.read();
  const total = db.data.contatti.length;
  const rows = db.data.contatti.slice(offset, offset + limit);
  return res.status(200).json({ ok: true, page, limit, total, rows });
});

app.delete("/api/admin/contatti/:id", requireToken, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "Bad request" });
  await db.read();
  const before = db.data.contatti.length;
  db.data.contatti = db.data.contatti.filter(x => Number(x.id) !== id);
  await db.write();
  return res.status(200).json({ ok: true, deleted: before - db.data.contatti.length });
});

// Prodotti / Incentivi (protetto)
function cleanList(text, maxItems = 12) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map(s => cleanStr(s, 240))
    .filter(Boolean);
  return lines.slice(0, maxItems);
}

app.post("/api/admin/prodotti", requireToken, async (req, res) => {
  const titolo = cleanStr(req.body?.titolo, 140);
  const descrizione = cleanStr(req.body?.descrizione, 2000);
  const categoria = cleanStr(req.body?.categoria, 80);
  const immagine = cleanStr(req.body?.immagine, 600);
  const pdf = cleanStr(req.body?.pdf, 600);
  const link = cleanStr(req.body?.link, 600);
  const bullets = cleanList(req.body?.bullets);

  if (!titolo) return res.status(400).json({ error: "Titolo obbligatorio" });

  await contentDb.read();
  const row = {
    id: nextProdottoId(),
    created_at: new Date().toISOString(),
    titolo,
    descrizione: descrizione || null,
    categoria: categoria || null,
    immagine: immagine || null,
    pdf: pdf || null,
    link: link || null,
    bullets
  };
  contentDb.data.prodotti.unshift(row);
  await contentDb.write();
  return res.status(201).json({ ok: true, id: row.id });
});

app.get("/api/admin/prodotti", requireToken, async (_req, res) => {
  await contentDb.read();
  return res.status(200).json({ ok: true, rows: contentDb.data.prodotti || [] });
});

app.delete("/api/admin/prodotti/:id", requireToken, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "Bad request" });
  await contentDb.read();
  const before = contentDb.data.prodotti.length;
  contentDb.data.prodotti = contentDb.data.prodotti.filter(x => Number(x.id) !== id);
  await contentDb.write();
  return res.status(200).json({ ok: true, deleted: before - contentDb.data.prodotti.length });
});

// Aggiorna prodotto esistente
app.put("/api/admin/prodotti/:id", requireToken, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "Bad request" });

  const titolo = cleanStr(req.body?.titolo, 140);
  const descrizione = cleanStr(req.body?.descrizione, 2000);
  const categoria = cleanStr(req.body?.categoria, 80);
  const immagine = cleanStr(req.body?.immagine, 600);
  const pdf = cleanStr(req.body?.pdf, 600);
  const link = cleanStr(req.body?.link, 600);
  const bullets = cleanList(req.body?.bullets);

  if (!titolo) return res.status(400).json({ error: "Titolo obbligatorio" });

  await contentDb.read();
  const idx = (contentDb.data.prodotti || []).findIndex(x => Number(x.id) === id);
  if (idx < 0) return res.status(404).json({ error: "Prodotto non trovato" });

  const old = contentDb.data.prodotti[idx];
  contentDb.data.prodotti[idx] = {
    ...old,
    titolo,
    descrizione: descrizione || null,
    categoria: categoria || null,
    immagine: immagine || null,
    pdf: pdf || null,
    link: link || null,
    bullets
  };
  await contentDb.write();
  return res.status(200).json({ ok: true });
});

app.post("/api/admin/incentivi", requireToken, async (req, res) => {
  const titolo = cleanStr(req.body?.titolo, 140);
  const descrizione = cleanStr(req.body?.descrizione, 2000);
  const stato = cleanStr(req.body?.stato, 60);
  const scadenza = cleanStr(req.body?.scadenza, 60);
  const immagine = cleanStr(req.body?.immagine, 600);
  const link1 = cleanStr(req.body?.link1, 600);
  const link1Label = cleanStr(req.body?.link1Label, 120);
  const link2 = cleanStr(req.body?.link2, 600);
  const link2Label = cleanStr(req.body?.link2Label, 120);
  const bullets = cleanList(req.body?.bullets);

  if (!titolo) return res.status(400).json({ error: "Titolo obbligatorio" });

  await contentDb.read();
  const row = {
    id: nextIncentivoId(),
    created_at: new Date().toISOString(),
    titolo,
    descrizione: descrizione || null,
    stato: stato || null,
    scadenza: scadenza || null,
    immagine: immagine || null,
    link1: link1 || null,
    link1Label: link1Label || null,
    link2: link2 || null,
    link2Label: link2Label || null,
    bullets
  };
  contentDb.data.incentivi.unshift(row);
  await contentDb.write();
  return res.status(201).json({ ok: true, id: row.id });
});

app.get("/api/admin/incentivi", requireToken, async (_req, res) => {
  await contentDb.read();
  return res.status(200).json({ ok: true, rows: contentDb.data.incentivi || [] });
});

app.delete("/api/admin/incentivi/:id", requireToken, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "Bad request" });
  await contentDb.read();
  const before = contentDb.data.incentivi.length;
  contentDb.data.incentivi = contentDb.data.incentivi.filter(x => Number(x.id) !== id);
  await contentDb.write();
  return res.status(200).json({ ok: true, deleted: before - contentDb.data.incentivi.length });
});

// Aggiorna incentivo esistente
app.put("/api/admin/incentivi/:id", requireToken, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "Bad request" });

  const titolo = cleanStr(req.body?.titolo, 140);
  const descrizione = cleanStr(req.body?.descrizione, 2000);
  const stato = cleanStr(req.body?.stato, 60);
  const scadenza = cleanStr(req.body?.scadenza, 60);
  const immagine = cleanStr(req.body?.immagine, 600);
  const link1 = cleanStr(req.body?.link1, 600);
  const link1Label = cleanStr(req.body?.link1Label, 120);
  const link2 = cleanStr(req.body?.link2, 600);
  const link2Label = cleanStr(req.body?.link2Label, 120);
  const bullets = cleanList(req.body?.bullets);

  if (!titolo) return res.status(400).json({ error: "Titolo obbligatorio" });

  await contentDb.read();
  const idx = (contentDb.data.incentivi || []).findIndex(x => Number(x.id) === id);
  if (idx < 0) return res.status(404).json({ error: "Incentivo non trovato" });

  const old = contentDb.data.incentivi[idx];
  contentDb.data.incentivi[idx] = {
    ...old,
    titolo,
    descrizione: descrizione || null,
    stato: stato || null,
    scadenza: scadenza || null,
    immagine: immagine || null,
    link1: link1 || null,
    link1Label: link1Label || null,
    link2: link2 || null,
    link2Label: link2Label || null,
    bullets
  };
  await contentDb.write();
  return res.status(200).json({ ok: true });
});

// Lettura pubblica (per mostrare sul sito)
app.get("/api/public/prodotti", async (req, res) => {
  await contentDb.read();
  return res.status(200).json({ ok: true, rows: contentDb.data.prodotti || [] });
});

app.get("/api/public/incentivi", async (req, res) => {
  await contentDb.read();
  return res.status(200).json({ ok: true, rows: contentDb.data.incentivi || [] });
});

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
// -------------------- Static front-end (sempre attivo) --------------------
// In questo pacchetto vogliamo che in locale funzioni “subito”, quindi
// il backend serve SEMPRE anche il frontend (html/css/js/immagini).
// Se in futuro vuoi disattivarlo, puoi lanciare il backend con FRONTEND_DIR
// che punta a una cartella vuota, oppure modificare questo blocco.
const FRONTEND_DIR = process.env.FRONTEND_DIR || path.join(__dirname, "..", "frontend");

// PDF (se presenti nel frontend)
app.use("/pdf-ke-energy", express.static(path.join(FRONTEND_DIR, "pdf-ke-energy"), { fallthrough: false }));

// serve TUTTI i file statici (html, css, js, immagini)
app.use(express.static(FRONTEND_DIR));

// home -> index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, "index.html"));
});


app.listen(PORT, () => {
  console.log(`Server avviato su http://localhost:${PORT}`);
  console.log(`Admin su http://localhost:${PORT}/admin`);
});
