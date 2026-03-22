const bcrypt = require("bcrypt");
const express = require("express");
// const { DatabaseSync } = require("node:sqlite");
const DatabaseSync = require("better-sqlite3");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const QRCode = require("qrcode");

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));


app.use((req, res, next) => {
  if (req.method !== "GET") {
    console.log(`→ ${req.method} ${req.url}`, JSON.stringify(req.body));
  }
  next();
});


const dbDir = path.join(__dirname, "database");
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });


const db = new DatabaseSync(path.join(dbDir, "waste_management.db"));
console.log("Connected to SQLite database");

// Subscription plan limits (per waste type per month)
const PLAN_LIMITS = {
  7000:  { id: 'basic',      name: 'Basic',      perType: 1, maxPickups: 4,  saving: 500 },
  13000: { id: 'standard',   name: 'Standard',   perType: 2, maxPickups: 8,  saving: 2000 },
  18000: { id: 'premium',    name: 'Premium',     perType: 3, maxPickups: 12, saving: 4500 },
  30000: { id: 'commercial', name: 'Commercial',  perType: 5, maxPickups: 20, saving: 7500 }
};
const WASTE_TYPES = ['general', 'recyclable', 'organic', 'hazardous'];


function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      address TEXT,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS bins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bin_code TEXT UNIQUE NOT NULL,
      location TEXT NOT NULL,
      area TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS bin_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      bin_code TEXT,
      issue_type TEXT NOT NULL,
      location TEXT NOT NULL,
      notes TEXT,
      photo_path TEXT,
      status TEXT DEFAULT 'pending',
      admin_response TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS pickups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      location TEXT NOT NULL,
      bin_type TEXT NOT NULL,
      pickup_date TEXT NOT NULL,
      time_slot TEXT NOT NULL,
      notes TEXT,
      status TEXT DEFAULT 'scheduled',
      payment_status TEXT DEFAULT 'unpaid',
      payment_id INTEGER,
      assigned_truck TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      billing_month TEXT NOT NULL,
      payment_method TEXT DEFAULT 'bank_transfer',
      payment_type TEXT DEFAULT 'subscription',
      pickup_id INTEGER,
      reference_number TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      verified_at DATETIME,
      verified_by INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      type TEXT DEFAULT 'info',
      is_read INTEGER DEFAULT 0,
      reference_type TEXT,
      reference_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS complaints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'open',
      admin_response TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
}

async function seedData() {
  const existing = db.prepare("SELECT id FROM users WHERE email = 'admin@swms.com'").get();
  if (!existing) {
    const hashedPassword = await bcrypt.hash("admin123", 10);
    db.prepare(
      `INSERT INTO users (name, email, password, role, phone, address) VALUES (?, ?, ?, ?, ?, ?)`
    ).run("System Admin", "admin@swms.com", hashedPassword, "admin", "+234 800 000 0000", "SWMS HQ, Lagos");
    console.log("Admin user seeded: admin@swms.com / admin123");
  }

  const bins = [
    { code: "BIN-001", location: "123 Main Street, Lekki", area: "Lekki" },
    { code: "BIN-002", location: "45 Victoria Island Road", area: "Victoria Island" },
    { code: "BIN-003", location: "78 Ikeja Mall, Ikeja", area: "Ikeja" },
    { code: "BIN-004", location: "12 Surulere Lane", area: "Surulere" },
    { code: "BIN-005", location: "90 Ikoyi Crescent", area: "Ikoyi" },
  ];

  const insertBin = db.prepare(`INSERT OR IGNORE INTO bins (bin_code, location, area) VALUES (?, ?, ?)`);
  for (const bin of bins) {
    insertBin.run(bin.code, bin.location, bin.area);
  }
  console.log("Seed data ready");
}


function createNotification(userId, title, description, type = "info", refType = null, refId = null) {
  db.prepare(
    `INSERT INTO notifications (user_id, title, description, type, reference_type, reference_id) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(userId, title, description, type, refType, refId);
}

function validateUser(userId, res) {
  if (!userId) {
    res.status(401).json({ message: "Session expired. Please log out and log back in.", code: "INVALID_SESSION" });
    return false;
  }
  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(Number(userId));
  if (!user) {
    res.status(401).json({ message: "Session expired. Please log out and log back in.", code: "INVALID_SESSION" });
    return false;
  }
  return true;
}


initializeDatabase();
seedData();


app.get("/verify-session", (req, res) => {
  const userId = req.query.user_id;
  if (!userId) return res.status(400).json({ valid: false });
  const user = db.prepare("SELECT id, name, email, role FROM users WHERE id = ?").get(Number(userId));
  if (!user) return res.status(401).json({ valid: false, code: "INVALID_SESSION" });
  res.json({ valid: true, user });
});


app.post("/register", async (req, res) => {
  const { name, email, password, phone, address } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, email, and password are required" });
  }
  if (phone && !/^[0-9+\-\s()]+$/.test(phone)) {
    return res.status(400).json({ message: "Please enter a valid phone number (digits only)" });
  }
  if (phone && phone.replace(/\D/g, '').length < 10) {
    return res.status(400).json({ message: "Phone number must be at least 10 digits" });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = db.prepare(
      `INSERT INTO users (name, email, password, phone, address) VALUES (?, ?, ?, ?, ?)`
    ).run(name, email, hashedPassword, phone || null, address || null);
    const userId = Number(result.lastInsertRowid);
    createNotification(userId, "Welcome to SWMS!", "Your account has been created successfully.", "success");
    res.json({
      message: "User registered successfully",
      user: { id: userId, name, email, role: "user", phone, address },
    });
  } catch (error) {
    if (error.message && error.message.includes("UNIQUE")) {
      return res.status(400).json({ message: "Email already exists" });
    }
    console.error("Server error:", error);
    res.status(500).json({ message: "Server error", detail: error?.message || "Unknown error" });
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: "Email and password are required" });
  try {
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!user) return res.status(400).json({ message: "User not found" });
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ message: "Invalid password" });
    res.json({
      message: "Login successful",
      user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone, address: user.address },
    });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ message: "Failed to fetch user", detail: error?.message || "Unknown error" });
  }
});

app.get("/user/:id", (req, res) => {
  try {
    const user = db.prepare("SELECT id, name, email, role, phone, address, created_at FROM users WHERE id = ?").get(Number(req.params.id));
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ message: "Server error", detail: error?.message || "Unknown error" });
  }
});

app.patch("/user/:id", (req, res) => {
  const { name, email, phone, address } = req.body;
  try {
    db.prepare(`UPDATE users SET name = ?, email = ?, phone = ?, address = ? WHERE id = ?`)
      .run(name, email, phone, address, Number(req.params.id));
    res.json({ message: "Profile updated successfully" });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ message: "Error updating profile", detail: error?.message || "Unknown error" });
  }
});

app.patch("/user/:id/password", async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  try {
    const user = db.prepare("SELECT password FROM users WHERE id = ?").get(Number(req.params.id));
    if (!user) return res.status(400).json({ message: "User not found" });
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(400).json({ message: "Current password is incorrect" });
    const hashed = await bcrypt.hash(newPassword, 10);
    db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashed, Number(req.params.id));
    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ message: "Error updating password", detail: error?.message || "Unknown error" });
  }
});



app.get("/pickup-prices", (req, res) => {
  res.json([
    { bin_type: "general", name: "General Waste", amount: 1000 },
    { bin_type: "recyclable", name: "Recyclable", amount: 1500 },
    { bin_type: "organic", name: "Organic / Compost", amount: 2000 },
    { bin_type: "hazardous", name: "Hazardous", amount: 3000 }
  ]);
});


app.get("/user-subscription", (req, res) => {
  const userId = req.query.user_id;
  if (!userId) return res.status(400).json({ subscribed: false });
  try {
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];

    let targetMonth;
    if (req.query.pickup_date) {
      const d = new Date(req.query.pickup_date + 'T00:00:00');
      targetMonth = `${months[d.getMonth()]} ${d.getFullYear()}`;
    } else {
      const now = new Date();
      targetMonth = `${months[now.getMonth()]} ${now.getFullYear()}`;
    }

    const sub = db.prepare(
      `SELECT * FROM payments WHERE user_id = ? AND billing_month = ? AND payment_type = 'subscription' AND status = 'verified'`
    ).get(Number(userId), targetMonth);

    if (!sub) {
      return res.json({ subscribed: false, month: targetMonth, plan: null });
    }

    const planInfo = PLAN_LIMITS[sub.amount] || { perType: 1, maxPickups: 4, name: 'Basic' };
    const yearMonth = req.query.pickup_date ? req.query.pickup_date.substring(0, 7) : new Date().toISOString().substring(0, 7);

    // Count per-type usage
    const typeUsage = {};
    let totalUsed = 0;
    for (const wt of WASTE_TYPES) {
      const used = db.prepare(
        `SELECT COUNT(*) as count FROM pickups WHERE user_id = ? AND payment_status = 'subscription' AND bin_type = ? AND pickup_date LIKE ?`
      ).get(Number(userId), wt, `${yearMonth}%`)?.count || 0;
      typeUsage[wt] = { used, limit: planInfo.perType, remaining: Math.max(0, planInfo.perType - used) };
      totalUsed += used;
    }

    res.json({
      subscribed: true,
      month: targetMonth,
      plan: {
        amount: sub.amount,
        billing_month: sub.billing_month,
        verified_at: sub.verified_at,
        name: planInfo.name,
        perType: planInfo.perType,
        maxPickups: planInfo.maxPickups,
        usedPickups: totalUsed,
        remainingPickups: Math.max(0, planInfo.maxPickups - totalUsed),
        typeUsage: typeUsage
      }
    });
  } catch (error) {
    res.json({ subscribed: false, month: null });
  }
});

app.post("/pickups", (req, res) => {
  const { user_id, location, bin_type, pickup_date, time_slot, notes, payment_status } = req.body;
  if (!user_id || !location || !bin_type || !pickup_date || !time_slot) {
    return res.status(400).json({ message: "All required fields must be provided" });
  }
  try {
    if (!validateUser(user_id, res)) return;

    // If client claims subscription, verify it against the pickup's month
    let pStatus = payment_status || 'unpaid';
    if (pStatus === 'subscription') {
      const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      const d = new Date(pickup_date + 'T00:00:00');
      const pickupMonth = `${months[d.getMonth()]} ${d.getFullYear()}`;
      const sub = db.prepare(
        `SELECT id, amount FROM payments WHERE user_id = ? AND billing_month = ? AND payment_type = 'subscription' AND status = 'verified'`
      ).get(user_id, pickupMonth);
      if (!sub) {
        pStatus = 'unpaid';
      } else {
        // Enforce per-type pickup limit
        const planInfo = PLAN_LIMITS[sub.amount] || { perType: 1 };
        const yearMonth = pickup_date.substring(0, 7);
        const usedForType = db.prepare(
          `SELECT COUNT(*) as count FROM pickups WHERE user_id = ? AND payment_status = 'subscription' AND bin_type = ? AND pickup_date LIKE ?`
        ).get(user_id, bin_type, `${yearMonth}%`)?.count || 0;
        if (usedForType >= planInfo.perType) {
          const typeName = bin_type.charAt(0).toUpperCase() + bin_type.slice(1);
          return res.status(400).json({
            message: `${typeName} pickup limit reached for your ${planInfo.id || 'current'} plan (${planInfo.perType} per type/month). You can pay per-pickup for additional ${typeName.toLowerCase()} collections or upgrade your plan.`,
            limit_reached: true,
            bin_type: bin_type,
            used: usedForType,
            max: planInfo.perType
          });
        }
      }
    }

    const result = db.prepare(
      `INSERT INTO pickups (user_id, location, bin_type, pickup_date, time_slot, notes, payment_status) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(user_id, location, bin_type, pickup_date, time_slot, notes || null, pStatus);
    const pickupId = Number(result.lastInsertRowid);
    const noteText = notes ? `\nNotes: ${notes}` : '';
    const payTag = pStatus === 'subscription' ? '\nCovered by subscription' : (pStatus === 'paid' ? '\nPaid' : '\nPayment pending');
    createNotification(user_id, "Pickup Scheduled", `Your ${bin_type} waste pickup has been scheduled for ${pickup_date} at ${time_slot}.\nLocation: ${location}${noteText}${payTag}`, "success", "pickup", pickupId);
    res.json({ message: "Pickup scheduled successfully", id: pickupId, payment_status: pStatus });
  } catch (error) {
    console.error("Pickup creation error:", error);
    res.status(500).json({ message: "Error scheduling pickup", detail: error?.message || "Unknown error" });
  }
});


app.post("/pickups/pay", (req, res) => {
  const { user_id, pickup_id, amount, payment_method, reference_number } = req.body;
  if (!user_id || !pickup_id || !amount) return res.status(400).json({ message: "Required fields missing" });
  try {
    if (!validateUser(user_id, res)) return;
    const pickup = db.prepare("SELECT * FROM pickups WHERE id = ? AND user_id = ?").get(pickup_id, user_id);
    if (!pickup) return res.status(404).json({ message: "Pickup not found" });

    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const now = new Date();
    const billingMonth = `${months[now.getMonth()]} ${now.getFullYear()}`;

    const result = db.prepare(
      `INSERT INTO payments (user_id, amount, billing_month, payment_method, payment_type, pickup_id, reference_number) VALUES (?, ?, ?, ?, 'per_pickup', ?, ?)`
    ).run(user_id, amount, billingMonth, payment_method || 'card', pickup_id, reference_number || null);
    const paymentId = Number(result.lastInsertRowid);

    // auto-verify card
    if (payment_method === 'card') {
      db.prepare(`UPDATE payments SET status = 'verified', verified_at = ? WHERE id = ?`).run(new Date().toISOString(), paymentId);
      db.prepare(`UPDATE pickups SET payment_status = 'paid', payment_id = ? WHERE id = ?`).run(paymentId, pickup_id);
      createNotification(user_id, "Pickup Payment Confirmed", `Your payment of ₦${amount.toLocaleString()} for pickup #${pickup_id} has been confirmed.`, "success", "payment", paymentId);
    } else {
      db.prepare(`UPDATE pickups SET payment_status = 'pending', payment_id = ? WHERE id = ?`).run(paymentId, pickup_id);
      createNotification(user_id, "Pickup Payment Submitted", `Your payment of ₦${amount.toLocaleString()} for pickup #${pickup_id} is pending verification.`, "warning", "payment", paymentId);
    }

    res.json({ message: "Payment processed", id: paymentId, status: payment_method === 'card' ? 'verified' : 'pending' });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ message: "Error processing payment", detail: error?.message || "Unknown error" });
  }
});

app.get("/pickups", (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM pickups WHERE user_id = ? ORDER BY created_at DESC").all(Number(req.query.user_id));
    res.json(rows);
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ message: "Server error", detail: error?.message || "Unknown error" });
  }
});

app.get("/pickups/all", (req, res) => {
  try {
    const rows = db.prepare(
      `SELECT p.*, u.name as user_name, u.email as user_email, u.phone as user_phone
       FROM pickups p JOIN users u ON p.user_id = u.id ORDER BY p.created_at DESC`
    ).all();
    res.json(rows);
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ message: "Server error", detail: error?.message || "Unknown error" });
  }
});

app.patch("/pickups/:id/status", (req, res) => {
  const { status } = req.body;
  const completedAt = status === "completed" ? new Date().toISOString() : null;
  try {
    db.prepare(`UPDATE pickups SET status = ?, completed_at = ? WHERE id = ?`).run(status, completedAt, Number(req.params.id));
    const pickup = db.prepare("SELECT user_id FROM pickups WHERE id = ?").get(Number(req.params.id));
    if (pickup) {
      const msgs = {
        assigned: { title: "Pickup Assigned", desc: "A truck has been assigned to your pickup.", type: "info" },
        completed: { title: "Pickup Completed", desc: "Your waste pickup has been completed.", type: "success" },
        cancelled: { title: "Pickup Cancelled", desc: "Your pickup has been cancelled.", type: "warning" },
      };
      const msg = msgs[status];
      if (msg) createNotification(pickup.user_id, msg.title, msg.desc, msg.type, "pickup", Number(req.params.id));
    }
    res.json({ message: "Pickup status updated" });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ message: "Error updating pickup", detail: error?.message || "Unknown error" });
  }
});

app.patch("/pickups/:id/assign-truck", (req, res) => {
  const { truck } = req.body;
  try {
    db.prepare(`UPDATE pickups SET assigned_truck = ?, status = 'assigned' WHERE id = ?`).run(truck, Number(req.params.id));
    const pickup = db.prepare("SELECT user_id, location, pickup_date FROM pickups WHERE id = ?").get(Number(req.params.id));
    if (pickup) createNotification(pickup.user_id, "Truck Assigned", `Truck ${truck} has been assigned to your pickup on ${pickup.pickup_date}.\nLocation: ${pickup.location || 'N/A'}`, "info", "pickup", Number(req.params.id));
    res.json({ message: "Truck assigned successfully" });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ message: "Error assigning truck", detail: error?.message || "Unknown error" });
  }
});

app.post("/bin-reports", (req, res) => {
  const { user_id, bin_code, issue_type, location, notes } = req.body;
  if (!user_id || !issue_type || !location) return res.status(400).json({ message: "Required fields missing" });
  if (!bin_code || !/^BIN-\d{1,5}$/i.test(bin_code)) return res.status(400).json({ message: "Bin ID must be in format BIN-001" });
  try {
    if (!validateUser(user_id, res)) return;
    const result = db.prepare(
      `INSERT INTO bin_reports (user_id, bin_code, issue_type, location, notes) VALUES (?, ?, ?, ?, ?)`
    ).run(user_id, bin_code || null, issue_type, location, notes || null);
    const reportId = Number(result.lastInsertRowid);
    const noteText = notes ? `\nNotes: ${notes}` : '';
    createNotification(user_id, "Bin Report Submitted", `Your ${issue_type} report for bin ${bin_code || 'N/A'} at ${location} has been received.${noteText}`, "success", "report", reportId);
    res.json({ message: "Report submitted successfully", id: reportId });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ message: "Error submitting report", detail: error?.message || "Unknown error" });
  }
});

app.get("/bin-reports", (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM bin_reports WHERE user_id = ? ORDER BY created_at DESC").all(Number(req.query.user_id));
    res.json(rows);
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ message: "Server error", detail: error?.message || "Unknown error" });
  }
});

app.get("/bin-reports/all", (req, res) => {
  try {
    const rows = db.prepare(
      `SELECT br.*, u.name as user_name, u.email as user_email
       FROM bin_reports br JOIN users u ON br.user_id = u.id ORDER BY br.created_at DESC`
    ).all();
    res.json(rows);
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ message: "Server error", detail: error?.message || "Unknown error" });
  }
});

app.patch("/bin-reports/:id/status", (req, res) => {
  const { status } = req.body;
  const resolvedAt = status === "resolved" ? new Date().toISOString() : null;
  try {
    db.prepare(`UPDATE bin_reports SET status = ?, resolved_at = ? WHERE id = ?`).run(status, resolvedAt, Number(req.params.id));
    const report = db.prepare("SELECT user_id FROM bin_reports WHERE id = ?").get(Number(req.params.id));
    if (report) {
      const msg = status === "resolved"
        ? { title: "Bin Report Resolved", desc: "Your bin report has been resolved.", type: "success" }
        : { title: "Bin Report Updated", desc: `Your bin report status: ${status}.`, type: "info" };
      createNotification(report.user_id, msg.title, msg.desc, msg.type, "report", Number(req.params.id));
    }
    res.json({ message: "Report status updated" });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ message: "Error updating report", detail: error?.message || "Unknown error" });
  }
});


app.patch("/bin-reports/:id/simulate-response", (req, res) => {
  try {
    const report = db.prepare("SELECT * FROM bin_reports WHERE id = ?").get(Number(req.params.id));
    if (!report) return res.status(404).json({ message: "Report not found" });

    const responses = {
      overflow: [
        "We've dispatched a collection crew to empty this bin. Expected clearance within 24 hours.",
        "Overflow reported and logged. An additional bin will be placed at this location by end of day.",
        "Our team is aware of the overflow at this location. Emergency pickup has been scheduled."
      ],
      damaged: [
        "A maintenance crew has been assigned to inspect and repair/replace this bin within 48 hours.",
        "Thank you for reporting the damage. A replacement bin is being prepared for delivery.",
        "We've logged the damage report. Our field team will assess the bin and arrange a replacement."
      ],
      missing: [
        "We're investigating the missing bin. A temporary replacement will be deployed within 24 hours.",
        "Missing bin confirmed. Our logistics team is arranging delivery of a new unit to this location.",
        "Thank you for alerting us. We've filed a report and will have a bin installed by tomorrow."
      ],
      contaminated: [
        "A decontamination team has been alerted and will sanitize this bin within 48 hours.",
        "Contamination report received. The bin will be cleaned and treated by our hazmat-certified team.",
        "We take contamination seriously. A specialized cleanup crew is being dispatched to this location."
      ],
      pest_infestation: [
        "Pest control has been notified and will treat this bin and surrounding area within 24 hours.",
        "We've escalated this to our pest management contractor. Treatment is scheduled for this week.",
        "Infestation report logged. Fumigation and deep cleaning of the bin area has been arranged."
      ],
      odor: [
        "A sanitation crew will deep-clean and deodorize this bin within 24 hours.",
        "Odor complaint received. We're scheduling a thorough wash and applying odor-neutralizing treatment.",
        "Thank you for reporting. Enhanced cleaning frequency has been assigned to this bin location."
      ],
      other: [
        "Thank you for your report. Our team has been notified and will investigate this issue promptly.",
        "We've logged your concern and assigned a field officer to inspect this location.",
        "Your report has been received. We'll provide an update once our team has assessed the situation."
      ]
    };

    const issueType = report.issue_type || 'other';
    const pool = responses[issueType] || responses.other;
    const response = pool[Math.floor(Math.random() * pool.length)];

    db.prepare(
      `UPDATE bin_reports SET admin_response = ?, status = 'investigating', resolved_at = ? WHERE id = ?`
    ).run(response, new Date().toISOString(), Number(req.params.id));

    createNotification(report.user_id, "Bin Report Update",
      `Your ${issueType} report for bin ${report.bin_code || 'N/A'} at ${report.location} has been reviewed.\n${response}`,
      "info", "report", Number(req.params.id));

    res.json({ message: "Response simulated", response });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ message: "Error simulating response", detail: error?.message || "Unknown error" });
  }
});



app.get("/billing-plans", (req, res) => {
  res.json([
    { id: "basic", name: "Basic", amount: 7000, maxPickups: 4, perType: 1, description: "1 pickup per waste type/month", savings: "Save ₦500 vs per-pickup (₦7,500)" },
    { id: "standard", name: "Standard", amount: 13000, maxPickups: 8, perType: 2, description: "2 pickups per waste type/month", savings: "Save ₦2,000 vs per-pickup (₦15,000)" },
    { id: "premium", name: "Premium", amount: 18000, maxPickups: 12, perType: 3, description: "3 pickups per waste type/month", savings: "Save ₦4,500 vs per-pickup (₦22,500)" },
    { id: "commercial", name: "Commercial", amount: 30000, maxPickups: 20, perType: 5, description: "5 pickups per waste type/month", savings: "Save ₦7,500 vs per-pickup (₦37,500)" }
  ]);
});

app.post("/payments", (req, res) => {
  const { user_id, amount, billing_month, payment_method, reference_number, payment_type, pickup_id } = req.body;
  if (!user_id || !amount || !billing_month) return res.status(400).json({ message: "Required fields missing" });
  try {
    if (!validateUser(user_id, res)) return;
    const pType = payment_type || 'subscription';
    const result = db.prepare(
      `INSERT INTO payments (user_id, amount, billing_month, payment_method, payment_type, pickup_id, reference_number) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(user_id, amount, billing_month, payment_method || "bank_transfer", pType, pickup_id || null, reference_number || null);
    const paymentId = Number(result.lastInsertRowid);
    const label = pType === 'per_pickup' ? `pickup #${pickup_id}` : billing_month;
    createNotification(user_id, "Payment Submitted", `Your payment of ₦${amount.toLocaleString()} for ${label} via ${payment_method || 'bank transfer'} is being verified.\nReference: ${reference_number || 'N/A'}`, "warning", "payment", paymentId);
    res.json({ message: "Payment submitted for verification", id: paymentId });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ message: "Error submitting payment", detail: error?.message || "Unknown error" });
  }
});

app.get("/payments", (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC").all(Number(req.query.user_id));
    res.json(rows);
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ message: "Server error", detail: error?.message || "Unknown error" });
  }
});

app.get("/payments/all", (req, res) => {
  try {
    const rows = db.prepare(
      `SELECT p.*, u.name as user_name, u.email as user_email
       FROM payments p JOIN users u ON p.user_id = u.id ORDER BY p.created_at DESC`
    ).all();
    res.json(rows);
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ message: "Server error", detail: error?.message || "Unknown error" });
  }
});

app.patch("/payments/:id/verify", (req, res) => {
  const { status, admin_id } = req.body;
  try {
    db.prepare(
      `UPDATE payments SET status = ?, verified_at = ?, verified_by = ? WHERE id = ?`
    ).run(status, new Date().toISOString(), admin_id, Number(req.params.id));
    const payment = db.prepare("SELECT user_id, amount, billing_month FROM payments WHERE id = ?").get(Number(req.params.id));
    if (payment) {
      if (status === "verified") {
        createNotification(payment.user_id, "Payment Confirmed", `Your payment of ₦${payment.amount} for ${payment.billing_month} has been confirmed.`, "success", "payment", Number(req.params.id));
      } else {
        createNotification(payment.user_id, "Payment Rejected", `Your payment for ${payment.billing_month} was not verified. Please contact support.`, "warning", "payment", Number(req.params.id));
      }
    }
    res.json({ message: `Payment ${status}` });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ message: "Error updating payment", detail: error?.message || "Unknown error" });
  }
});


app.patch("/payments/:id/auto-verify", (req, res) => {
  const { paystack_reference } = req.body;
  try {
    const payment = db.prepare("SELECT * FROM payments WHERE id = ?").get(Number(req.params.id));
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    db.prepare(
      `UPDATE payments SET status = 'verified', verified_at = ?, reference_number = ? WHERE id = ?`
    ).run(new Date().toISOString(), paystack_reference || payment.reference_number, Number(req.params.id));
    // If linked to a pickup, mark it paid
    if (payment.pickup_id) {
      db.prepare(`UPDATE pickups SET payment_status = 'paid', payment_id = ? WHERE id = ?`).run(Number(req.params.id), payment.pickup_id);
    }
    createNotification(payment.user_id, "Payment Confirmed", `Your payment of ₦${payment.amount} for ${payment.billing_month} has been confirmed.`, "success", "payment", Number(req.params.id));
    res.json({ message: "Payment verified", status: "verified" });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ message: "Error verifying payment", detail: error?.message || "Unknown error" });
  }
});

app.get("/notifications", (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC").all(Number(req.query.user_id));
    res.json(rows);
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ message: "Server error", detail: error?.message || "Unknown error" });
  }
});

app.patch("/notifications/:id/read", (req, res) => {
  try {
    db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").run(Number(req.params.id));
    res.json({ message: "Notification marked as read" });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ message: "Server error", detail: error?.message || "Unknown error" });
  }
});

app.patch("/notifications/read-all", (req, res) => {
  try {
    db.prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ?").run(Number(req.query.user_id));
    res.json({ message: "All notifications marked as read" });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ message: "Server error", detail: error?.message || "Unknown error" });
  }
});

app.post("/complaints", (req, res) => {
  const { user_id, subject, message } = req.body;
  if (!user_id || !subject || !message) return res.status(400).json({ message: "All fields are required" });
  try {
    if (!validateUser(user_id, res)) return;
    const result = db.prepare(`INSERT INTO complaints (user_id, subject, message) VALUES (?, ?, ?)`).run(user_id, subject, message);
    const complaintId = Number(result.lastInsertRowid);
    createNotification(user_id, "Complaint Received", `Your complaint "${subject}" has been received.\n${message}`, "info", "complaint", complaintId);
    res.json({ message: "Complaint submitted", id: complaintId });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ message: "Error submitting complaint", detail: error?.message || "Unknown error" });
  }
});

app.get("/complaints", (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM complaints WHERE user_id = ? ORDER BY created_at DESC").all(Number(req.query.user_id));
    res.json(rows);
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ message: "Server error", detail: error?.message || "Unknown error" });
  }
});

app.get("/complaints/all", (req, res) => {
  try {
    const rows = db.prepare(
      `SELECT c.*, u.name as user_name, u.email as user_email
       FROM complaints c JOIN users u ON c.user_id = u.id ORDER BY c.created_at DESC`
    ).all();
    res.json(rows);
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ message: "Server error", detail: error?.message || "Unknown error" });
  }
});

app.patch("/complaints/:id/respond", (req, res) => {
  const { admin_response, status } = req.body;
  const resolvedAt = status === "resolved" ? new Date().toISOString() : null;
  try {
    db.prepare(
      `UPDATE complaints SET admin_response = ?, status = ?, resolved_at = ? WHERE id = ?`
    ).run(admin_response, status || "responded", resolvedAt, Number(req.params.id));
    const c = db.prepare("SELECT user_id, subject FROM complaints WHERE id = ?").get(Number(req.params.id));
    if (c) createNotification(c.user_id, "Complaint Updated", `Your complaint "${c.subject}" has received a response.`, "info", "complaint", Number(req.params.id));
    res.json({ message: "Response saved" });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ message: "Error responding", detail: error?.message || "Unknown error" });
  }
});


app.patch("/complaints/:id/simulate-response", (req, res) => {
  try {
    const c = db.prepare("SELECT * FROM complaints WHERE id = ?").get(Number(req.params.id));
    if (!c) return res.status(404).json({ message: "Complaint not found" });
    const responses = [
      "Thank you for bringing this to our attention. Our team is looking into this issue and will take corrective action within 48 hours.",
      "We sincerely apologize for the inconvenience. A supervisor has been assigned to resolve this matter promptly.",
      "Your feedback is valuable to us. We have escalated this to our operations team and will provide an update shortly.",
      "We acknowledge your concern and have initiated an investigation. You should see improvements within the next service cycle."
    ];
    const response = responses[Math.floor(Math.random() * responses.length)];
    db.prepare(
      `UPDATE complaints SET admin_response = ?, status = 'responded', resolved_at = ? WHERE id = ?`
    ).run(response, new Date().toISOString(), Number(req.params.id));
    createNotification(c.user_id, "Complaint Responded", `Your complaint "${c.subject}" has received a response from our team.`, "success", "complaint", Number(req.params.id));
    res.json({ message: "Response simulated", response });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ message: "Error simulating response", detail: error?.message || "Unknown error" });
  }
});

app.get("/bins", (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM bins ORDER BY bin_code").all();
    res.json(rows);
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ message: "Server error", detail: error?.message || "Unknown error" });
  }
});

app.get("/bins/:code", (req, res) => {
  try {
    const bin = db.prepare("SELECT * FROM bins WHERE bin_code = ?").get(req.params.code);
    if (!bin) return res.status(404).json({ message: "Bin not found" });
    res.json(bin);
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ message: "Server error", detail: error?.message || "Unknown error" });
  }
});

app.post("/bins", (req, res) => {
  const { bin_code, location, area } = req.body;
  if (!bin_code || !location) return res.status(400).json({ message: "Bin code and location required" });
  try {
    const result = db.prepare(`INSERT INTO bins (bin_code, location, area) VALUES (?, ?, ?)`).run(bin_code, location, area || null);
    res.json({ message: "Bin created", id: Number(result.lastInsertRowid) });
  } catch (error) {
    if (error.message && error.message.includes("UNIQUE")) {
      return res.status(400).json({ message: "Bin code already exists" });
    }
    console.error("Server error:", error);
    res.status(500).json({ message: "Error creating bin", detail: error?.message || "Unknown error" });
  }
});

app.get("/bins/:code/qr", (req, res) => {
  const binCode = req.params.code;
  const baseUrl = req.query.base_url || "http://localhost:4200";
  try {
    const bin = db.prepare("SELECT * FROM bins WHERE bin_code = ?").get(binCode);
    if (!bin) return res.status(404).json({ message: "Bin not found" });
    res.json({ bin_code: binCode, qr_url: `${baseUrl}/report-bin?bin=${binCode}`, location: bin.location, area: bin.area });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ message: "Server error", detail: error?.message || "Unknown error" });
  }
});

// Serve QR code as PNG image
app.get("/bins/:code/qr-image", async (req, res) => {
  const binCode = req.params.code;
  const baseUrl = req.query.base_url || "http://localhost:4200";
  const size = parseInt(req.query.size) || 300;
  try {
    const bin = db.prepare("SELECT * FROM bins WHERE bin_code = ?").get(binCode);
    if (!bin) return res.status(404).json({ message: "Bin not found" });
    const url = `${baseUrl}/report-bin?bin=${binCode}`;
    const buffer = await QRCode.toBuffer(url, {
      width: size,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' },
      errorCorrectionLevel: 'M'
    });
    res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' });
    res.send(buffer);
  } catch (error) {
    console.error("QR generation error:", error);
    res.status(500).json({ message: "Error generating QR code", detail: error?.message || "Unknown error" });
  }
});

app.get("/dashboard/stats", (req, res) => {
  const userId = Number(req.query.user_id);
  try {
    const nextPickup = db.prepare("SELECT pickup_date, time_slot FROM pickups WHERE user_id = ? AND status IN ('scheduled','assigned') ORDER BY pickup_date ASC LIMIT 1").get(userId) || null;
    const pendingReports = db.prepare("SELECT COUNT(*) as count FROM bin_reports WHERE user_id = ? AND status = 'pending'").get(userId)?.count || 0;
    const completedPickups = db.prepare("SELECT COUNT(*) as count FROM pickups WHERE user_id = ? AND status = 'completed'").get(userId)?.count || 0;
    const outstandingPayment = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE user_id = ? AND status = 'pending'").get(userId)?.total || 0;
    const recentActivity = db.prepare(
      `SELECT 'pickup' as activity_type, 'Pickup ' || status as title, location as description, created_at FROM pickups WHERE user_id = ?
       UNION ALL
       SELECT 'report', 'Bin Report', issue_type || ' at ' || location, created_at FROM bin_reports WHERE user_id = ?
       UNION ALL
       SELECT 'payment', 'Payment', '₦' || amount || ' - ' || status, created_at FROM payments WHERE user_id = ?
       ORDER BY created_at DESC LIMIT 10`
    ).all(userId, userId, userId);

    res.json({ nextPickup, pendingReports, completedPickups, outstandingPayment, recentActivity });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ message: "Server error", detail: error?.message || "Unknown error" });
  }
});

app.get("/dashboard/admin-stats", (req, res) => {
  try {
    const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'user'").get()?.count || 0;
    const pendingReports = db.prepare("SELECT COUNT(*) as count FROM bin_reports WHERE status = 'pending'").get()?.count || 0;
    const scheduledPickups = db.prepare("SELECT COUNT(*) as count FROM pickups WHERE status = 'scheduled'").get()?.count || 0;
    const pendingPayments = db.prepare("SELECT COUNT(*) as count FROM payments WHERE status = 'pending'").get()?.count || 0;
    const completedPickups = db.prepare("SELECT COUNT(*) as count FROM pickups WHERE status = 'completed'").get()?.count || 0;
    const totalRevenue = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'verified'").get()?.total || 0;
    const openComplaints = db.prepare("SELECT COUNT(*) as count FROM complaints WHERE status = 'open'").get()?.count || 0;
    const totalBins = db.prepare("SELECT COUNT(*) as count FROM bins").get()?.count || 0;

    res.json({ totalUsers, pendingReports, scheduledPickups, pendingPayments, completedPickups, totalRevenue, openComplaints, totalBins });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ message: "Server error", detail: error?.message || "Unknown error" });
  }
});

app.get("/users", (req, res) => {
  try {
    const rows = db.prepare("SELECT id, name, email, role, phone, address, created_at FROM users ORDER BY created_at DESC").all();
    res.json(rows);
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ message: "Server error", detail: error?.message || "Unknown error" });
  }
});

app.get("/test-db", (req, res) => {
  try {
    const rows = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    res.json(rows);
  } catch (error) {
    console.error("Server error:", error);
    res.status(400).json({ error: error.message });
  }
});

// -------- Pickup Demand Prediction --------

app.get("/predictions/area-demand", (req, res) => {
  try {
    const reportsByArea = db.prepare(`
      SELECT b.area, COUNT(r.id) as report_count,
        SUM(CASE WHEN r.status = 'pending' THEN 1 ELSE 0 END) as unresolved,
        MAX(r.created_at) as last_report
      FROM bin_reports r
      LEFT JOIN bins b ON LOWER(r.bin_code) = LOWER(b.bin_code)
      WHERE b.area IS NOT NULL
      GROUP BY b.area
    `).all();

    const pickupsByArea = db.prepare(`
      SELECT location, COUNT(*) as pickup_count,
        SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as pending_pickups
      FROM pickups GROUP BY location
    `).all();

    const areas = {};
    for (const r of reportsByArea) {
      if (!r.area) continue;
      areas[r.area] = areas[r.area] || { area: r.area, reports: 0, unresolved: 0, pickups: 0, pending_pickups: 0, score: 0 };
      areas[r.area].reports = r.report_count;
      areas[r.area].unresolved = r.unresolved;
      areas[r.area].last_report = r.last_report;
    }

    for (const p of pickupsByArea) {
      const matchedArea = Object.keys(areas).find(a => p.location && p.location.toLowerCase().includes(a.toLowerCase()));
      if (matchedArea) {
        areas[matchedArea].pickups += p.pickup_count;
        areas[matchedArea].pending_pickups += p.pending_pickups;
      }
    }

    const results = Object.values(areas).map(a => {
      const recency = a.last_report ? Math.max(0, 7 - Math.floor((Date.now() - new Date(a.last_report + 'Z').getTime()) / 86400000)) : 0;
      a.score = Math.round((a.reports * 2) + (a.unresolved * 5) + (a.pickups * 1) + (a.pending_pickups * 3) + (recency * 2));
      a.priority = a.score >= 15 ? 'high' : a.score >= 7 ? 'medium' : 'low';
      return a;
    });

    results.sort((a, b) => b.score - a.score);
    res.json(results);
  } catch (error) {
    console.error("Prediction error:", error);
    res.status(500).json({ message: "Server error", detail: error?.message });
  }
});

app.get("/predictions/weekly-pattern", (req, res) => {
  try {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const reportPattern = db.prepare(`
      SELECT CAST(strftime('%w', created_at) AS INTEGER) as dow, COUNT(*) as count
      FROM bin_reports GROUP BY dow
    `).all();

    const pickupPattern = db.prepare(`
      SELECT CAST(strftime('%w', pickup_date) AS INTEGER) as dow, COUNT(*) as count
      FROM pickups GROUP BY dow
    `).all();

    const pattern = days.map((name, i) => {
      const rp = reportPattern.find(r => r.dow === i);
      const pp = pickupPattern.find(p => p.dow === i);
      const reports = rp ? rp.count : 0;
      const pickups = pp ? pp.count : 0;
      return { day: name, day_index: i, reports, pickups, demand: reports + pickups };
    });

    res.json(pattern);
  } catch (error) {
    console.error("Prediction error:", error);
    res.status(500).json({ message: "Server error", detail: error?.message });
  }
});

app.get("/predictions/upcoming", (req, res) => {
  try {
    const now = new Date();
    const forecasts = [];

    for (let i = 0; i < 7; i++) {
      const target = new Date(now);
      target.setDate(target.getDate() + i);
      const dow = target.getDay();
      const dateStr = target.toISOString().split('T')[0];

      const historicalDow = db.prepare(`
        SELECT COUNT(*) as total FROM (
          SELECT created_at FROM bin_reports WHERE CAST(strftime('%w', created_at) AS INTEGER) = ?
          UNION ALL
          SELECT pickup_date as created_at FROM pickups WHERE CAST(strftime('%w', pickup_date) AS INTEGER) = ?
        )
      `).get(dow, dow);

      const pendingInArea = db.prepare(`
        SELECT b.area, COUNT(*) as count FROM bin_reports r
        LEFT JOIN bins b ON LOWER(r.bin_code) = LOWER(b.bin_code)
        WHERE r.status = 'pending' AND b.area IS NOT NULL
        GROUP BY b.area ORDER BY count DESC LIMIT 3
      `).all();

      const demand = historicalDow?.total || 0;
      forecasts.push({
        date: dateStr,
        day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dow],
        predicted_demand: demand,
        level: demand >= 5 ? 'high' : demand >= 2 ? 'medium' : 'low',
        hotspot_areas: i === 0 ? pendingInArea.map(p => p.area) : []
      });
    }

    res.json(forecasts);
  } catch (error) {
    console.error("Prediction error:", error);
    res.status(500).json({ message: "Server error", detail: error?.message });
  }
});

// -------- Paystack Integration --------
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || 'sk_test_3b344ea6fbdf89ee683f88a5fdf7165758df3910';
const PAYSTACK_ENABLED = PAYSTACK_SECRET_KEY.length > 0;

app.get("/payment-config", (req, res) => {
  res.json({
    paystack_enabled: PAYSTACK_ENABLED,
    paystack_public_key: PAYSTACK_ENABLED ? process.env.PAYSTACK_PUBLIC_KEY || 'pk_test_8e89be8d8c2e9c4ac2223f7ce30a408ca89230d0' : ''
  });
});

app.post("/paystack/initialize", async (req, res) => {
  if (!PAYSTACK_ENABLED) return res.status(400).json({ message: "Paystack not configured. Using simulated payments." });
  const { email, amount, callback_url, metadata } = req.body;
  if (!email || !amount) return res.status(400).json({ message: "Email and amount required" });

  try {
    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { "Authorization": `Bearer ${PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email, amount: Math.round(amount * 100), callback_url, metadata })
    });
    const data = await response.json();
    if (data.status) {
      res.json({ authorization_url: data.data.authorization_url, reference: data.data.reference, access_code: data.data.access_code });
    } else {
      res.status(400).json({ message: data.message || "Paystack initialization failed" });
    }
  } catch (error) {
    console.error("Paystack error:", error);
    res.status(500).json({ message: "Payment service unavailable" });
  }
});

app.get("/paystack/verify/:reference", async (req, res) => {
  if (!PAYSTACK_ENABLED) return res.status(400).json({ message: "Paystack not configured" });
  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${req.params.reference}`, {
      headers: { "Authorization": `Bearer ${PAYSTACK_SECRET_KEY}` }
    });
    const data = await response.json();
    if (data.status && data.data.status === 'success') {
      res.json({ verified: true, amount: data.data.amount / 100, reference: data.data.reference, channel: data.data.channel });
    } else {
      res.json({ verified: false, message: data.data?.gateway_response || "Verification failed" });
    }
  } catch (error) {
    console.error("Paystack verify error:", error);
    res.status(500).json({ message: "Verification failed" });
  }
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
  console.log("Admin login: admin@swms.com / admin123");
  if (PAYSTACK_ENABLED) console.log("Paystack: enabled");
  else console.log("Paystack: disabled (set PAYSTACK_SECRET_KEY env to enable)");
});
