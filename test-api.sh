#!/bin/bash
# ============================================================
# SWMS MVP — Full API Test Script
# Run: bash test-api.sh
# Requires: Backend running on http://localhost:3000
# ============================================================

BASE="http://localhost:3000"
PASS=0
FAIL=0
TOTAL=0
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Reset: kill existing server, wipe DB, restart fresh
echo -e "${yellow}Preparing clean test environment...${nc}"

# Kill any running server on port 3000
lsof -ti:3000 2>/dev/null | xargs kill -9 2>/dev/null
sleep 1

# Remove old database
rm -f "$SCRIPT_DIR/database/waste_management.db"

# Start server in background
node "$SCRIPT_DIR/server.js" &
SERVER_PID=$!
sleep 2

# Verify server is up
if ! curl -s "$BASE/test-db" > /dev/null 2>&1; then
  echo -e "${red}Server failed to start. Exiting.${nc}"
  kill $SERVER_PID 2>/dev/null
  exit 1
fi
echo -e "${green}Server running (PID $SERVER_PID) with fresh database.${nc}"
echo ""

# Kill server on exit unless KEEP_SERVER=1
if [ "$KEEP_SERVER" != "1" ]; then
  trap "kill $SERVER_PID 2>/dev/null; wait $SERVER_PID 2>/dev/null" EXIT
fi

green='\033[0;32m'
red='\033[0;31m'
yellow='\033[1;33m'
blue='\033[0;34m'
nc='\033[0m'

test_endpoint() {
  TOTAL=$((TOTAL + 1))
  local description="$1"
  local expected="$2"
  local response="$3"
  
  if echo "$response" | grep -q "$expected"; then
    PASS=$((PASS + 1))
    echo -e "  ${green}✓ PASS${nc} — $description"
  else
    FAIL=$((FAIL + 1))
    echo -e "  ${red}✗ FAIL${nc} — $description"
    echo -e "    Expected: ${yellow}$expected${nc}"
    echo -e "    Got: $response" | head -c 200
    echo ""
  fi
}

echo ""
echo -e "${blue}╔══════════════════════════════════════════════════╗${nc}"
echo -e "${blue}║     SWMS MVP — Full API Test Suite               ║${nc}"
echo -e "${blue}╚══════════════════════════════════════════════════╝${nc}"
echo ""

# ----------------------------------------------------------
# 0. Server health check
# ----------------------------------------------------------
echo -e "${yellow}[0] Server Health Check${nc}"
RESP=$(curl -s "$BASE/test-db" 2>&1)
test_endpoint "Server is running & DB has tables" "users" "$RESP"

# ----------------------------------------------------------
# 1. AUTH — Register
# ----------------------------------------------------------
echo ""
echo -e "${yellow}[1] Authentication — Register${nc}"

RESP=$(curl -s -X POST "$BASE/register" \
  -H "Content-Type: application/json" \
  -d '{"name":"Ade Johnson","email":"ade@test.com","phone":"08012345678","address":"15 Lekki Road, Lagos","password":"password123"}')
test_endpoint "Register new user" "User registered successfully" "$RESP"

# Extract user ID
USER_ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['user']['id'])" 2>/dev/null)
echo -e "    → User ID: $USER_ID"

RESP=$(curl -s -X POST "$BASE/register" \
  -H "Content-Type: application/json" \
  -d '{"name":"Ade Johnson","email":"ade@test.com","phone":"08012345678","address":"15 Lekki Road","password":"password123"}')
test_endpoint "Reject duplicate email" "Email already exists" "$RESP"

RESP=$(curl -s -X POST "$BASE/register" \
  -H "Content-Type: application/json" \
  -d '{"name":"","email":"","password":""}')
test_endpoint "Reject empty fields" "required" "$RESP"

# ----------------------------------------------------------
# 2. AUTH — Login
# ----------------------------------------------------------
echo ""
echo -e "${yellow}[2] Authentication — Login${nc}"

RESP=$(curl -s -X POST "$BASE/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"ade@test.com","password":"password123"}')
test_endpoint "Login with valid credentials" "Login successful" "$RESP"

RESP=$(curl -s -X POST "$BASE/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"ade@test.com","password":"wrongpassword"}')
test_endpoint "Reject wrong password" "Invalid password" "$RESP"

RESP=$(curl -s -X POST "$BASE/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"nonexistent@test.com","password":"password123"}')
test_endpoint "Reject nonexistent user" "User not found" "$RESP"

RESP=$(curl -s -X POST "$BASE/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@swms.com","password":"admin123"}')
test_endpoint "Admin login" "admin" "$RESP"

# ----------------------------------------------------------
# 3. USER PROFILE
# ----------------------------------------------------------
echo ""
echo -e "${yellow}[3] User Profile${nc}"

RESP=$(curl -s "$BASE/user/$USER_ID")
test_endpoint "Get user profile" "ade@test.com" "$RESP"

RESP=$(curl -s -X PATCH "$BASE/user/$USER_ID" \
  -H "Content-Type: application/json" \
  -d '{"name":"Ade Updated","email":"ade@test.com","phone":"09099999999","address":"20 VI Road, Lagos"}')
test_endpoint "Update profile" "Profile updated" "$RESP"

RESP=$(curl -s "$BASE/user/$USER_ID")
test_endpoint "Verify profile update" "Ade Updated" "$RESP"

# ----------------------------------------------------------
# 4. PASSWORD CHANGE
# ----------------------------------------------------------
echo ""
echo -e "${yellow}[4] Password Change${nc}"

RESP=$(curl -s -X PATCH "$BASE/user/$USER_ID/password" \
  -H "Content-Type: application/json" \
  -d '{"currentPassword":"password123","newPassword":"newpass456"}')
test_endpoint "Change password" "Password updated" "$RESP"

RESP=$(curl -s -X PATCH "$BASE/user/$USER_ID/password" \
  -H "Content-Type: application/json" \
  -d '{"currentPassword":"wrongpassword","newPassword":"newpass456"}')
test_endpoint "Reject wrong current password" "incorrect" "$RESP"

RESP=$(curl -s -X POST "$BASE/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"ade@test.com","password":"newpass456"}')
test_endpoint "Login with new password" "Login successful" "$RESP"

# ----------------------------------------------------------
# 5. SCHEDULE PICKUPS
# ----------------------------------------------------------
echo ""
echo -e "${yellow}[5] Schedule Pickups${nc}"

RESP=$(curl -s -X POST "$BASE/pickups" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":$USER_ID,\"location\":\"15 Lekki Road\",\"bin_type\":\"household\",\"pickup_date\":\"2026-03-01\",\"time_slot\":\"morning\",\"notes\":\"Gate is green\"}")
test_endpoint "Schedule pickup" "Pickup scheduled" "$RESP"
PICKUP_ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
echo -e "    → Pickup ID: $PICKUP_ID"

RESP=$(curl -s -X POST "$BASE/pickups" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":$USER_ID,\"location\":\"20 VI Road\",\"bin_type\":\"recyclable\",\"pickup_date\":\"2026-03-05\",\"time_slot\":\"afternoon\",\"notes\":\"\"}")
test_endpoint "Schedule second pickup" "Pickup scheduled" "$RESP"
PICKUP_ID2=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)

RESP=$(curl -s "$BASE/pickups?user_id=$USER_ID")
test_endpoint "Get user pickups" "household" "$RESP"

RESP=$(curl -s "$BASE/pickups/all")
test_endpoint "Admin: get all pickups" "Ade Updated" "$RESP"

# ----------------------------------------------------------
# 6. BIN REPORTS
# ----------------------------------------------------------
echo ""
echo -e "${yellow}[6] Bin Reports${nc}"

RESP=$(curl -s -X POST "$BASE/bin-reports" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":$USER_ID,\"bin_code\":\"BIN-001\",\"issue_type\":\"overflow\",\"location\":\"123 Main Street, Lekki\",\"notes\":\"Bin overflowing since morning\"}")
test_endpoint "Submit bin report" "Report submitted" "$RESP"
REPORT_ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
echo -e "    → Report ID: $REPORT_ID"

RESP=$(curl -s -X POST "$BASE/bin-reports" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":$USER_ID,\"bin_code\":\"BIN-003\",\"issue_type\":\"damaged\",\"location\":\"78 Ikeja Mall\",\"notes\":\"Lid is broken\"}")
test_endpoint "Submit second report" "Report submitted" "$RESP"

RESP=$(curl -s "$BASE/bin-reports?user_id=$USER_ID")
test_endpoint "Get user reports" "overflow" "$RESP"

RESP=$(curl -s "$BASE/bin-reports/all")
test_endpoint "Admin: get all reports" "Ade Updated" "$RESP"

# ----------------------------------------------------------
# 7. PAYMENTS
# ----------------------------------------------------------
echo ""
echo -e "${yellow}[7] Payments${nc}"

RESP=$(curl -s -X POST "$BASE/payments" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":$USER_ID,\"amount\":5000,\"billing_month\":\"March 2026\",\"payment_method\":\"bank_transfer\",\"reference_number\":\"REF-20260301-001\"}")
test_endpoint "Submit payment" "Payment submitted" "$RESP"
PAYMENT_ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
echo -e "    → Payment ID: $PAYMENT_ID"

RESP=$(curl -s -X POST "$BASE/payments" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":$USER_ID,\"amount\":7500,\"billing_month\":\"April 2026\",\"payment_method\":\"bank_transfer\",\"reference_number\":\"REF-20260401-002\"}")
test_endpoint "Submit second payment" "Payment submitted" "$RESP"
PAYMENT_ID2=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)

RESP=$(curl -s "$BASE/payments?user_id=$USER_ID")
test_endpoint "Get user payments" "March 2026" "$RESP"

RESP=$(curl -s "$BASE/payments/all")
test_endpoint "Admin: get all payments" "Ade Updated" "$RESP"

# ----------------------------------------------------------
# 8. COMPLAINTS
# ----------------------------------------------------------
echo ""
echo -e "${yellow}[8] Complaints${nc}"

RESP=$(curl -s -X POST "$BASE/complaints" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":$USER_ID,\"subject\":\"Late Pickup\",\"message\":\"My scheduled pickup was 3 hours late last Wednesday.\"}")
test_endpoint "Submit complaint" "Complaint submitted" "$RESP"
COMPLAINT_ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
echo -e "    → Complaint ID: $COMPLAINT_ID"

RESP=$(curl -s "$BASE/complaints?user_id=$USER_ID")
test_endpoint "Get user complaints" "Late Pickup" "$RESP"

RESP=$(curl -s "$BASE/complaints/all")
test_endpoint "Admin: get all complaints" "Ade Updated" "$RESP"

# ----------------------------------------------------------
# 9. BINS & QR CODES
# ----------------------------------------------------------
echo ""
echo -e "${yellow}[9] Bins & QR Codes${nc}"

RESP=$(curl -s "$BASE/bins")
test_endpoint "Get all bins" "BIN-001" "$RESP"

RESP=$(curl -s "$BASE/bins/BIN-001")
test_endpoint "Lookup bin by code" "Lekki" "$RESP"

RESP=$(curl -s "$BASE/bins/BIN-999")
test_endpoint "Reject nonexistent bin" "not found" "$RESP"

RESP=$(curl -s -X POST "$BASE/bins" \
  -H "Content-Type: application/json" \
  -d '{"bin_code":"BIN-006","location":"200 Ajah Express, Ajah","area":"Ajah"}')
test_endpoint "Create new bin" "Bin created" "$RESP"

RESP=$(curl -s "$BASE/bins/BIN-006/qr")
test_endpoint "Get QR URL for bin" "report-bin?bin=BIN-006" "$RESP"

RESP=$(curl -s -X POST "$BASE/bins" \
  -H "Content-Type: application/json" \
  -d '{"bin_code":"BIN-006","location":"Duplicate","area":"Test"}')
test_endpoint "Reject duplicate bin code" "already exists" "$RESP"

# ----------------------------------------------------------
# 10. ADMIN ACTIONS
# ----------------------------------------------------------
echo ""
echo -e "${yellow}[10] Admin Actions${nc}"

RESP=$(curl -s -X PATCH "$BASE/pickups/$PICKUP_ID/assign-truck" \
  -H "Content-Type: application/json" \
  -d '{"truck":"TRK-007"}')
test_endpoint "Assign truck to pickup" "Truck assigned" "$RESP"

RESP=$(curl -s -X PATCH "$BASE/pickups/$PICKUP_ID/status" \
  -H "Content-Type: application/json" \
  -d '{"status":"completed"}')
test_endpoint "Mark pickup completed" "status updated" "$RESP"

RESP=$(curl -s -X PATCH "$BASE/pickups/$PICKUP_ID2/status" \
  -H "Content-Type: application/json" \
  -d '{"status":"cancelled"}')
test_endpoint "Cancel pickup" "status updated" "$RESP"

RESP=$(curl -s -X PATCH "$BASE/bin-reports/$REPORT_ID/status" \
  -H "Content-Type: application/json" \
  -d '{"status":"assigned"}')
test_endpoint "Assign bin report" "status updated" "$RESP"

RESP=$(curl -s -X PATCH "$BASE/bin-reports/$REPORT_ID/status" \
  -H "Content-Type: application/json" \
  -d '{"status":"resolved"}')
test_endpoint "Resolve bin report" "status updated" "$RESP"

RESP=$(curl -s -X PATCH "$BASE/payments/$PAYMENT_ID/verify" \
  -H "Content-Type: application/json" \
  -d '{"status":"verified","admin_id":1}')
test_endpoint "Verify payment" "verified" "$RESP"

RESP=$(curl -s -X PATCH "$BASE/payments/$PAYMENT_ID2/verify" \
  -H "Content-Type: application/json" \
  -d '{"status":"rejected","admin_id":1}')
test_endpoint "Reject payment" "rejected" "$RESP"

RESP=$(curl -s -X PATCH "$BASE/complaints/$COMPLAINT_ID/respond" \
  -H "Content-Type: application/json" \
  -d '{"admin_response":"We sincerely apologize. The collection team has been notified and this will not happen again.","status":"resolved"}')
test_endpoint "Respond to complaint" "Response saved" "$RESP"

# ----------------------------------------------------------
# 11. NOTIFICATIONS
# ----------------------------------------------------------
echo ""
echo -e "${yellow}[11] Notifications${nc}"

RESP=$(curl -s "$BASE/notifications?user_id=$USER_ID")
NOTIF_COUNT=$(echo "$RESP" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null)
test_endpoint "Notifications created ($NOTIF_COUNT total)" "Welcome to SWMS" "$RESP"
test_endpoint "Has pickup notification" "Pickup Scheduled" "$RESP"
test_endpoint "Has payment notification" "Payment Submitted" "$RESP"
test_endpoint "Has truck assignment notification" "Truck Assigned" "$RESP"
test_endpoint "Has payment verified notification" "Payment Confirmed" "$RESP"
test_endpoint "Has report resolved notification" "Bin Report Resolved" "$RESP"
test_endpoint "Has complaint response notification" "Complaint Updated" "$RESP"

# Get first notification ID for mark-as-read test
NOTIF_ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])" 2>/dev/null)

RESP=$(curl -s -X PATCH "$BASE/notifications/$NOTIF_ID/read")
test_endpoint "Mark notification as read" "marked as read" "$RESP"

RESP=$(curl -s -X PATCH "$BASE/notifications/read-all?user_id=$USER_ID")
test_endpoint "Mark all notifications read" "All notifications" "$RESP"

# ----------------------------------------------------------
# 12. DASHBOARD STATS
# ----------------------------------------------------------
echo ""
echo -e "${yellow}[12] Dashboard Stats${nc}"

RESP=$(curl -s "$BASE/dashboard/stats?user_id=$USER_ID")
test_endpoint "User dashboard stats" "completedPickups" "$RESP"
test_endpoint "Has recent activity" "recentActivity" "$RESP"

RESP=$(curl -s "$BASE/dashboard/admin-stats")
test_endpoint "Admin dashboard stats" "totalUsers" "$RESP"
test_endpoint "Has total revenue" "totalRevenue" "$RESP"
test_endpoint "Has total bins" "totalBins" "$RESP"

# ----------------------------------------------------------
# 13. USERS LIST (Admin)
# ----------------------------------------------------------
echo ""
echo -e "${yellow}[13] Users List${nc}"

RESP=$(curl -s "$BASE/users")
test_endpoint "Get all users" "ade@test.com" "$RESP"
test_endpoint "Includes admin" "admin@swms.com" "$RESP"

RESP=$(curl -s "$BASE/predictions/area-demand")
test_endpoint "Area demand prediction" "area" "$RESP"

RESP=$(curl -s "$BASE/predictions/weekly-pattern")
test_endpoint "Weekly pattern" "Sunday" "$RESP"

RESP=$(curl -s "$BASE/predictions/upcoming")
test_endpoint "7-day forecast" "predicted_demand" "$RESP"

RESP=$(curl -s "$BASE/payment-config")
test_endpoint "Payment config" "paystack_enabled" "$RESP"

# ----------------------------------------------------------
# RESULTS
# ----------------------------------------------------------
echo ""
echo -e "${blue}══════════════════════════════════════════════════${nc}"
echo -e "${blue}  TEST RESULTS${nc}"
echo -e "${blue}══════════════════════════════════════════════════${nc}"
echo ""
echo -e "  Total:  $TOTAL"
echo -e "  ${green}Passed: $PASS${nc}"
echo -e "  ${red}Failed: $FAIL${nc}"
echo ""

if [ $FAIL -eq 0 ]; then
  echo -e "  ${green}ALL TESTS PASSED${nc}"
else
  echo -e "  ${red}$FAIL test(s) failed. Check output above.${nc}"
fi
echo ""
if [ "$KEEP_SERVER" = "1" ]; then
  echo -e "${blue}  Server still running on $BASE (PID $SERVER_PID) with test data.${nc}"
  echo -e "${blue}  Stop server: kill $SERVER_PID${nc}"
else
  echo -e "${blue}  Tip: run KEEP_SERVER=1 bash test-api.sh to keep the server alive after tests.${nc}"
fi
echo ""
