# SWMS — Smart Waste Management System (Complete MVP)

## One-Time Setup

### Step 1: Install backend dependencies
```bash
npm install
```

### Step 2: Install frontend dependencies
```bash
cd frontend
npm install
```

### Step 3: Start the backend (Terminal 1)
```bash
node server.js
```
→ Runs at http://localhost:3000  
→ Database auto-creates on first run

### Step 4: Start the frontend (Terminal 2)
```bash
cd frontend
ng serve
```
→ Runs at http://localhost:4200

### Step 5: Open in browser
Go to http://localhost:4200

**Admin login:** admin@swms.com / admin123

> **Note:** You need Node.js v22+ (we use built-in SQLite — no external DB needed!)

---

## Features

### User Features
- **Register / Login** — bcrypt password hashing, localStorage session
- **Dashboard** — Live stats (next pickup, pending reports, completed pickups, outstanding balance) + recent activity feed
- **Schedule Pickup** — Pick date, time slot, waste type
- **Report Bin** — QR code support! Scan a bin → auto-fills form
- **Make Payment** — Bank transfer flow with admin verification
- **Notifications** — Real-time notifications for all actions
- **Complaints** — Submit and track with admin responses
- **Settings** — Edit profile, change password

### Admin Features
- **Admin Dashboard** — 8 system-wide stats (users, reports, pickups, revenue, complaints, bins)
- **Manage Pickups** — Assign trucks, mark complete/cancel
- **Bin Reports** — Assign, resolve
- **Verify Payments** — Verify or reject
- **Manage Bins** — Create bins, generate and download/print QR codes
- **Complaints** — Respond & resolve

### QR Code Flow
1. Admin creates a bin → clicks "View QR"
2. QR code is generated in-app → download as PNG or print directly
3. Attach printed QR code to the physical bin
4. User scans QR → app opens with bin code + location auto-filled → submit report

---

## Demo Flow (for Presentation)

1. Register a new user → auto welcome notification
2. Schedule Pickup → see it on dashboard
3. Report Bin → use BIN-001 → auto-fills location
4. Make Payment → submit bank transfer
5. Check Notifications → all actions created real notifications
6. Submit Complaint → view in history
7. Login as Admin (admin@swms.com / admin123)
8. Admin Dashboard → see system stats
9. Manage Pickups → assign truck TRK-007 → mark complete
10. Verify Payment → approve user's payment
11. Resolve Bin Report
12. Respond to Complaint
13. Manage Bins → create new bin → view/download QR code

---

## Tech Stack
- **Backend:** Node.js + Express.js + SQLite (built-in node:sqlite)
- **Frontend:** Angular 17 + Tailwind CSS + DaisyUI
- **Auth:** bcrypt + localStorage
- **Database:** 7 tables, 35+ API endpoints, auto-seeded admin + bins

## Project Structure
```
swms-mvp/
├── server.js           ← Backend (all API endpoints)
├── package.json        ← Backend dependencies
├── database/           ← SQLite DB (auto-created)
├── public/             ← Static files
└── frontend/           ← Angular app
    └── src/app/
        ├── services/   ← AuthService, ApiService
        ├── guards/     ← Auth + Admin guards
        └── features/   ← All pages
            ├── auth/          (login, register)
            ├── dashboard/     (user dashboard)
            ├── pickup/        (schedule pickup)
            ├── bin-reports/   (report bin + QR)
            ├── payments/      (make payment)
            ├── notifications/ (notification center)
            ├── complaints/    (submit complaints)
            ├── settings/      (profile, password)
            ├── sidebar/       (role-based nav)
            └── admin/         (6 admin pages)
```
