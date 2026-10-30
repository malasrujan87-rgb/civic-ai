const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data", "reports.json");
const UPLOAD_DIR = path.join(__dirname, "uploads");

fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(UPLOAD_DIR));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, Date.now() + "-" + safe);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed."));
  }
});

function readReports() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
  catch { return []; }
}
function saveReports(reports) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(reports, null, 2));
}
function words(text) {
  return (text || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/).filter(w => w.length > 2);
}
function similarity(a, b) {
  const A = new Set(words(a)), B = new Set(words(b));
  if (!A.size || !B.size) return 0;
  let common = 0;
  A.forEach(w => { if (B.has(w)) common++; });
  return common / new Set([...A, ...B]).size;
}
function analyzeReport(report, existing) {
  const text = `${report.title} ${report.description}`.toLowerCase();
  const rules = [
    ["Drainage", ["drain", "waterlogging", "water entering", "flood", "sewage", "blocked water"]],
    ["Road Damage", ["pothole", "road", "crack", "damaged road"]],
    ["Waste", ["garbage", "waste", "rubbish", "overflowing bin", "trash"]],
    ["Streetlight", ["streetlight", "street light", "lamp", "dark road", "light not working"]],
    ["Water Supply", ["water supply", "no water", "pipe leak", "water leakage"]]
  ];
  let category = report.category || "Other";
  for (const [name, terms] of rules) {
    if (terms.some(term => text.includes(term))) { category = name; break; }
  }

  const urgentTerms = ["entering houses", "school", "hospital", "accident", "injury", "electric wire", "fire", "flood", "open manhole"];
  const highTerms = ["waterlogging", "blocked drain", "large pothole", "overflowing", "dangerous"];
  let score = 20;
  const reasons = [];
  if (urgentTerms.some(t => text.includes(t))) {
    score += 55; reasons.push("The description contains a possible immediate safety or property-risk indicator.");
  }
  if (highTerms.some(t => text.includes(t))) {
    score += 25; reasons.push("The reported condition may affect public movement or sanitation.");
  }
  if (category === "Road Damage" || category === "Drainage") {
    score += 10; reasons.push("This category can affect public safety or access.");
  }
  if (report.severity === "Critical") {
    score += 25; reasons.push("The submitter marked the issue as critical.");
  }
  score = Math.min(score, 100);
  const priority = score >= 75 ? "Critical" : score >= 50 ? "High" : score >= 30 ? "Medium" : "Low";

  let duplicate = null;
  let best = 0;
  for (const old of existing) {
    if (old.status === "Resolved") continue;
    const sameArea = (old.location || "").trim().toLowerCase() === (report.location || "").trim().toLowerCase();
    const sim = similarity(`${report.title} ${report.description}`, `${old.title} ${old.description}`);
    const combined = sim + (sameArea ? 0.2 : 0);
    if (combined > best && (sim >= 0.28 || (sameArea && old.category === category))) {
      best = combined; duplicate = old;
    }
  }
  if (!reasons.length) reasons.push("No strong emergency keywords were detected; routine review is recommended.");
  return {
    category, score, priority, reasons,
    summary: `${report.title}. ${report.description}`.slice(0, 180),
    duplicateOf: duplicate ? duplicate.id : null,
    duplicateConfidence: duplicate ? Math.min(99, Math.round(best * 100)) : 0,
    aiNote: "Prototype AI: transparent keyword rules and text similarity. Human review is required."
  };
}

app.get("/api/reports", (_req, res) => {
  const reports = readReports().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(reports);
});

app.post("/api/reports", upload.single("image"), (req, res) => {
  const { title, description, category, location, severity, latitude, longitude, citizenName } = req.body;
  if (!title || !description || !location) {
    return res.status(400).json({ error: "Please provide a title, description and location." });
  }
  const reports = readReports();
  const report = {
    id: "CA-" + Date.now().toString().slice(-7),
    title: title.trim(), description: description.trim(),
    category: category || "Other", location: location.trim(),
    severity: severity || "Normal",
    latitude: latitude ? Number(latitude) : null,
    longitude: longitude ? Number(longitude) : null,
    citizenName: citizenName || "Citizen",
    image: req.file ? "/uploads/" + req.file.filename : null,
    status: "Submitted", assignedTo: "",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  };
  Object.assign(report, analyzeReport(report, reports));
  reports.push(report);
  saveReports(reports);
  res.status(201).json(report);
});

app.patch("/api/reports/:id", (req, res) => {
  const reports = readReports();
  const report = reports.find(r => r.id === req.params.id);
  if (!report) return res.status(404).json({ error: "Complaint not found." });
  const allowedStatuses = ["Submitted", "Under Review", "Assigned", "In Progress", "Resolved"];
  if (req.body.status && allowedStatuses.includes(req.body.status)) report.status = req.body.status;
  if (typeof req.body.assignedTo === "string") report.assignedTo = req.body.assignedTo;
  report.updatedAt = new Date().toISOString();
  saveReports(reports);
  res.json(report);
});

app.get("/api/insights", (_req, res) => {
  const reports = readReports();
  const active = reports.filter(r => r.status !== "Resolved");
  const byCategory = {};
  const byLocation = {};
  reports.forEach(r => {
    byCategory[r.category] = (byCategory[r.category] || 0) + 1;
    const key = r.location || "Unknown";
    byLocation[key] = (byLocation[key] || 0) + 1;
  });
  const hotspots = Object.entries(byLocation).filter(([, count]) => count >= 2)
    .map(([location, count]) => ({ location, count })).sort((a,b) => b.count-a.count);
  res.json({
    total: reports.length,
    active: active.length,
    urgent: active.filter(r => ["Critical", "High"].includes(r.priority)).length,
    resolved: reports.filter(r => r.status === "Resolved").length,
    byCategory, hotspots
  });
});

app.get("/api/health", (_req, res) => res.json({ ok: true, app: "CivicAI" }));

app.use((err, _req, res, _next) => {
  res.status(400).json({ error: err.message || "Something went wrong." });
});

app.listen(PORT, () => console.log(`CivicAI is running at http://localhost:${PORT}`));
