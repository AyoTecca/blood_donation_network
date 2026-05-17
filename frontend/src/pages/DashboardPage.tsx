import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { TablePagination } from "../components/TablePagination";
import "../style.css";

// ── Types ──────────────────────────────────────────────────────────────────

interface KPI {
  available_units: number;
  reserved_units: number;
  expired_units: number;
  pending_requests: number;
  partial_requests: number;
  completed_requests: number;
  in_transit: number;
  total_patients: number;
  total_donors: number;
}

interface InventoryStat { status: string; unit_count: number; }
interface RequestStat   { status: string; request_count: number; }
interface DispatchStat  { status: string; dispatch_count: number; avg_distance_km: number; }

interface OpenRequest {
  request_id: number;
  facility_name: string;
  patient_name: string;
  blood_type: string;
  urgency_level: number;
  units_required: number;
  status: string;
  request_date: string;
}

interface Notification {
  notification_id: number;
  request_id: number;
  facility_name: string;
  event_type: string;
  message_text: string;
  is_read: string;
  created_at: string;
}

interface Facility {
  facility_id: number;
  facility_name: string;
  facility_type: string;
  city_name: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getToken() {
  return localStorage.getItem("bn_access_token") ?? "";
}

function authHeaders() {
  return { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" };
}

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: authHeaders(), ...opts });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).detail ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Status colour map ──────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  Available:           "#16a34a",
  Reserved:            "#2563eb",
  Expired:             "#dc2626",
  Transfused:          "#7c3aed",
  Discarded:           "#6b7280",
  Pending:             "#d97706",
  "Partially Fulfilled": "#0891b2",
  Completed:           "#16a34a",
  Cancelled:           "#dc2626",
  Queued:              "#d97706",
  "In Transit":        "#2563eb",
  Arrived:             "#16a34a",
  Failed:              "#dc2626",
};

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? "#6b7280";
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: "12px",
      fontSize: "12px",
      fontWeight: 600,
      background: color + "22",
      color,
      border: `1px solid ${color}44`,
    }}>
      {status}
    </span>
  );
}

// ── KPI Card ───────────────────────────────────────────────────────────────

function KpiCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      background: "#fff",
      borderRadius: "12px",
      padding: "18px 20px",
      borderLeft: `4px solid ${color}`,
      boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
      minWidth: "140px",
      flex: "1 1 140px",
    }}>
      <div style={{ fontSize: "28px", fontWeight: 700, color }}>{value.toLocaleString()}</div>
      <div style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>{label}</div>
    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────

function Section({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "#fff",
      borderRadius: "12px",
      padding: "20px 24px",
      boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
      marginBottom: "24px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
        <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>{title}</h3>
        {badge && (
          <span style={{ fontSize: "11px", background: "#f1f5f9", color: "#475569", padding: "2px 8px", borderRadius: "8px" }}>
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

// ── Simple table ───────────────────────────────────────────────────────────

function SimpleTable({ cols, rows }: { cols: string[]; rows: (string | number | React.ReactNode)[][] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
            {cols.map(c => (
              <th key={c} style={{ textAlign: "left", padding: "8px 10px", color: "#475569", fontWeight: 600 }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: "8px 10px", color: "#1e293b" }}>{cell}</td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={cols.length} style={{ padding: "16px 10px", color: "#94a3b8", textAlign: "center" }}>No data</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { user } = useAuth();

  const [kpi,        setKpi]        = useState<KPI | null>(null);
  const [inventory,  setInventory]  = useState<InventoryStat[]>([]);
  const [requests,   setRequests]   = useState<RequestStat[]>([]);
  const [dispatches, setDispatches] = useState<DispatchStat[]>([]);
  const [openReqs,   setOpenReqs]   = useState<OpenRequest[]>([]);
  const [notifs,     setNotifs]     = useState<Notification[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  // Distance tool state
  const [fac1,         setFac1]         = useState("");
  const [fac2,         setFac2]         = useState("");
  const [distResult,   setDistResult]   = useState<{ distance_km: number; facility_1: string; facility_2: string } | null>(null);
  const [distLoading,  setDistLoading]  = useState(false);
  const [distError,    setDistError]    = useState<string | null>(null);

  // Expire units state
  const [expireLoading, setExpireLoading] = useState(false);
  const [expireMsg,     setExpireMsg]     = useState<string | null>(null);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);

  // Pagination — Open Requests
  const [openPage,     setOpenPage]     = useState(1);
  const [openPageSize, setOpenPageSize] = useState(10);

  // Pagination — Notifications
  const [notifPage,     setNotifPage]     = useState(1);
  const [notifPageSize, setNotifPageSize] = useState(10);

  useEffect(() => {
    const load = async () => {
      try {
        const [k, inv, req, disp, open, nf, facs] = await Promise.all([
          apiFetch<KPI>("/api/dashboard/kpi"),
          apiFetch<InventoryStat[]>("/api/dashboard/inventory-by-status"),
          apiFetch<RequestStat[]>("/api/dashboard/requests-by-status"),
          apiFetch<DispatchStat[]>("/api/dashboard/dispatch-performance"),
          apiFetch<OpenRequest[]>("/api/dashboard/open-by-facility"),
          apiFetch<Notification[]>("/api/dashboard/notifications"),
          apiFetch<Facility[]>("/api/dashboard/facilities"),
        ]);
        setKpi(k); setInventory(inv); setRequests(req);
        setDispatches(disp); setOpenReqs(open); setNotifs(nf); setFacilities(facs);
      } catch (e: any) {
        setError(e.message ?? "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleDistance = async () => {
    if (!fac1 || !fac2) return;
    setDistLoading(true); setDistError(null); setDistResult(null);
    try {
      const r = await apiFetch<any>(`/api/dashboard/distance?fac1=${fac1}&fac2=${fac2}`);
      setDistResult(r);
    } catch (e: any) {
      setDistError(e.message);
    } finally {
      setDistLoading(false);
    }
  };

  const handleExpire = async () => {
    setExpireLoading(true); setExpireMsg(null);
    try {
      const r = await apiFetch<any>("/api/dashboard/expire-units", { method: "POST" });
      setExpireMsg(`✅ ${r.message}`);
      // Refresh inventory
      const inv = await apiFetch<InventoryStat[]>("/api/dashboard/inventory-by-status");
      setInventory(inv);
      const k = await apiFetch<KPI>("/api/dashboard/kpi");
      setKpi(k);
    } catch (e: any) {
      setExpireMsg(`❌ ${e.message}`);
    } finally {
      setExpireLoading(false);
    }
  };

  const handleDemoRestore = async () => {
    setRestoreLoading(true);
    setRestoreMsg(null);
    try {
      const r = await apiFetch<any>("/api/dashboard/demo-restore-inventory", { method: "POST" });
      setRestoreMsg(`✅ ${r.message}`);
      const inv = await apiFetch<InventoryStat[]>("/api/dashboard/inventory-by-status");
      setInventory(inv);
      const k = await apiFetch<KPI>("/api/dashboard/kpi");
      setKpi(k);
    } catch (e: any) {
      setRestoreMsg(`❌ ${e.message}`);
    } finally {
      setRestoreLoading(false);
    }
  };

  if (loading) return <div className="page-container">Loading dashboard...</div>;
  if (error)   return <div className="page-container" style={{ color: "#dc2626" }}>Error: {error}</div>;

  const totalUnits = inventory.reduce((s, i) => s + i.unit_count, 0) || 1;

  return (
    <div className="page-container">
      <div className="page-header" style={{ marginBottom: "24px" }}>
        <h1>Analytics Dashboard</h1>
        
      </div>

      {/* ── KPI Cards ── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", marginBottom: "28px" }}>
        <KpiCard label="Available Units"    value={kpi?.available_units   ?? 0} color="#16a34a" />
        <KpiCard label="Reserved Units"     value={kpi?.reserved_units    ?? 0} color="#2563eb" />
        <KpiCard label="Expired Units"      value={kpi?.expired_units     ?? 0} color="#dc2626" />
        <KpiCard label="Pending Requests"   value={kpi?.pending_requests  ?? 0} color="#d97706" />
        <KpiCard label="Partial Requests"   value={kpi?.partial_requests  ?? 0} color="#0891b2" />
        <KpiCard label="In Transit"         value={kpi?.in_transit        ?? 0} color="#7c3aed" />
        <KpiCard label="Total Patients"     value={kpi?.total_patients    ?? 0} color="#475569" />
        <KpiCard label="Total Donors"       value={kpi?.total_donors      ?? 0} color="#475569" />
      </div>

      {/* ── Two column: Inventory + Requests ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "24px" }}>

        <Section title="Blood Inventory" badge="vw_dashboard_inventory_by_status">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                <th style={{ textAlign: "left", padding: "8px 10px", color: "#475569" }}>Status</th>
                <th style={{ textAlign: "right", padding: "8px 10px", color: "#475569" }}>Units</th>
                <th style={{ padding: "8px 10px", color: "#475569" }}>Share</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((inv, i) => {
                const pct = ((inv.unit_count / totalUnits) * 100).toFixed(1);
                return (
                  <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 10px" }}><StatusBadge status={inv.status} /></td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>{inv.unit_count}</td>
                    <td style={{ padding: "8px 10px", minWidth: "100px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <div style={{ flex: 1, height: "6px", background: "#f1f5f9", borderRadius: "3px" }}>
                          <div style={{
                            width: `${pct}%`, height: "100%",
                            background: STATUS_COLORS[inv.status] ?? "#94a3b8",
                            borderRadius: "3px",
                          }} />
                        </div>
                        <span style={{ fontSize: "11px", color: "#64748b", minWidth: "34px" }}>{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>

        <Section title="Requests by Status" badge="vw_dashboard_requests_by_status">
          <SimpleTable
            cols={["Status", "Count"]}
            rows={requests.map(r => [<StatusBadge status={r.status} />, <strong>{r.request_count}</strong>])}
          />
          <div style={{ marginTop: "12px", padding: "12px", background: "#f8fafc", borderRadius: "8px", fontSize: "13px" }}>
            <strong>Total requests: </strong>
            {requests.reduce((s, r) => s + r.request_count, 0).toLocaleString()}
          </div>
        </Section>
      </div>

      {/* ── Dispatch Performance ── */}
      <Section title="Dispatch Performance" badge="vw_dashboard_dispatch_performance · pkg_blood_operations.calculate_distance_km">
        <SimpleTable
          cols={["Status", "Dispatches", "Avg Distance (km)"]}
          rows={dispatches.map(d => [
            <StatusBadge status={d.status} />,
            d.dispatch_count,
            d.avg_distance_km != null ? `${Number(d.avg_distance_km).toFixed(1)} km` : "—",
          ])}
        />
      </Section>

      {/* ── PL/SQL Tools ── */}
      <Section title="PL/SQL Tools" badge="Oracle Functions & Procedures">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>

          {/* Distance Calculator */}
          <div style={{ background: "#f8fafc", borderRadius: "10px", padding: "16px" }}>
            <h4 style={{ margin: "0 0 4px", fontSize: "14px" }}>Distance Calculator</h4>
            <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#64748b" }}>
              Calls <code>pkg_blood_operations.calculate_distance_km(loc1, loc2)</code> — Haversine formula in PL/SQL
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <select
                title="From facility"
                value={fac1}
                onChange={e => { setFac1(e.target.value); setDistResult(null); }}
                style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
              >
                <option value="">— From facility —</option>
                {facilities.map(f => (
                  <option key={f.facility_id} value={f.facility_id}>
                    {f.facility_name} ({f.city_name})
                  </option>
                ))}
              </select>
              <select
                title="To facility"
                value={fac2}
                onChange={e => { setFac2(e.target.value); setDistResult(null); }}
                style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
              >
                <option value="">— To facility —</option>
                {facilities.map(f => (
                  <option key={f.facility_id} value={f.facility_id}>
                    {f.facility_name} ({f.city_name})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleDistance}
                disabled={!fac1 || !fac2 || distLoading}
                style={{
                  padding: "9px 16px", background: "#2563eb", color: "#fff",
                  border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 600, fontSize: "13px",
                }}
              >
                {distLoading ? "Calculating..." : "Calculate Distance"}
              </button>
              {distError && <p style={{ color: "#dc2626", fontSize: "12px", margin: 0 }}>{distError}</p>}
              {distResult && (
                <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "8px", padding: "10px", fontSize: "13px" }}>
                  <strong>{distResult.facility_1}</strong> → <strong>{distResult.facility_2}</strong>
                  <div style={{ fontSize: "22px", fontWeight: 700, color: "#2563eb", marginTop: "4px" }}>
                    {Number(distResult.distance_km).toFixed(2)} km
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Demo inventory restore */}
          <div style={{ background: "#f0fdf4", borderRadius: "10px", padding: "16px", marginBottom: "16px", border: "1px solid #bbf7d0" }}>
            <h4 style={{ margin: "0 0 4px", fontSize: "14px" }}>Demo: Restore Matching Inventory</h4>
            <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#64748b" }}>
              After testing auto-matching, all units may show as <strong>Reserved</strong> and{" "}
              <strong>Available = 0</strong>. This moves up to 300 non-expired Reserved units back to{" "}
              <strong>Available</strong> so <code>process_blood_matches</code> can run again for your presentation.
            </p>
            {user?.role === "admin" ? (
              <>
                <button
                  type="button"
                  onClick={handleDemoRestore}
                  disabled={restoreLoading}
                  style={{
                    padding: "9px 16px", background: "#16a34a", color: "#fff",
                    border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 600, fontSize: "13px",
                  }}
                >
                  {restoreLoading ? "Restoring..." : "Restore Demo Inventory"}
                </button>
                {restoreMsg && (
                  <p style={{ marginTop: "10px", fontSize: "13px", color: restoreMsg.startsWith("✅") ? "#16a34a" : "#dc2626" }}>
                    {restoreMsg}
                  </p>
                )}
              </>
            ) : (
              <p style={{ fontSize: "12px", color: "#64748b", margin: 0 }}>Admin only.</p>
            )}
          </div>

          {/* Expire Old Units */}
          <div style={{ background: "#f8fafc", borderRadius: "10px", padding: "16px" }}>
            <h4 style={{ margin: "0 0 4px", fontSize: "14px" }}>Expire Old Blood Units</h4>
            <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#64748b" }}>
              Calls <code>pkg_blood_management.expire_old_blood_units</code> — uses{" "}
              <code>BULK COLLECT + FORALL</code> to mark expired units in one batch operation.
            </p>
            <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: "8px", padding: "10px", marginBottom: "12px", fontSize: "12px", color: "#92400e" }}>
              <strong>Trigger:</strong> <code>trg_blood_units_validate</code> will block setting
              Available/Reserved status on expired units. <code>trg_blood_units_audit_status</code>{" "}
              records each status change in <code>blood_unit_status_audit</code>.
            </div>
            {user?.role === "admin" ? (
              <>
                <button
                  type="button"
                  onClick={handleExpire}
                  disabled={expireLoading}
                  style={{
                    padding: "9px 16px", background: "#dc2626", color: "#fff",
                    border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 600, fontSize: "13px",
                  }}
                >
                  {expireLoading ? "Running procedure..." : "Run Expire Procedure"}
                </button>
                {expireMsg && (
                  <p style={{ marginTop: "10px", fontSize: "13px", color: expireMsg.startsWith("✅") ? "#16a34a" : "#dc2626" }}>
                    {expireMsg}
                  </p>
                )}
              </>
            ) : (
              <p style={{ fontSize: "12px", color: "#94a3b8", fontStyle: "italic" }}>Admin access required.</p>
            )}
          </div>
        </div>
      </Section>

      {/* ── Triggers info panel ── */}
      <Section title="Active Database Triggers" badge="Oracle Triggers">
        <SimpleTable
          cols={["Trigger", "Event", "Table", "Action"]}
          rows={[
            ["trg_blood_units_validate",          "BEFORE INSERT/UPDATE", "blood_units",           "Validates status values, blocks invalid state transitions"],
            ["trg_blood_units_audit_status",       "AFTER UPDATE status",  "blood_units",           "Writes to blood_unit_status_audit on every status change"],
            ["trg_transfusion_requests_validate",  "BEFORE INSERT/UPDATE", "transfusion_requests",  "Ensures units > 0, request_date not in future"],
            ["trg_transfusion_requests_history",   "AFTER INSERT/UPDATE/DELETE", "transfusion_requests", "Records full lifecycle in transfusion_request_history"],
            ["trg_transfusion_requests_notify",    "AFTER INSERT/UPDATE status", "transfusion_requests", "Creates notification in app_notifications"],
            ["trg_unit_transfers_validate",        "BEFORE INSERT/UPDATE", "unit_transfers",        "Prevents same-facility transfers, blocks future dates"],
            ["trg_match_dispatches_validate",      "BEFORE INSERT/UPDATE", "match_dispatches",      "Validates distance ≥ 0, status enum, no future dispatch dates"],
          ]}
        />
      </Section>

      {/* ── Open Requests by Facility ── */}
      <Section title="Open Requests by Facility" badge="vw_open_requests_by_facility">
        <SimpleTable
          cols={["#", "Facility", "Patient", "Blood Type", "Urgency", "Units", "Status", "Date"]}
          rows={openReqs
            .slice((openPage - 1) * openPageSize, openPage * openPageSize)
            .map(r => [
              `#${r.request_id}`,
              r.facility_name,
              r.patient_name,
              <span style={{ fontWeight: 700, color: "#b91c1c" }}>{r.blood_type}</span>,
              r.urgency_level,
              r.units_required,
              <StatusBadge status={r.status} />,
              new Date(r.request_date).toLocaleDateString(),
            ])}
        />
        <TablePagination
          page={openPage}
          pageSize={openPageSize}
          total={openReqs.length}
          onPageChange={setOpenPage}
          onPageSizeChange={(s) => { setOpenPageSize(s); setOpenPage(1); }}
        />
      </Section>

      {/* ── Notifications Feed ── */}
      <Section title="Notifications Feed" badge="vw_notifications_feed · trg_transfusion_requests_notify">
        <SimpleTable
          cols={["#", "Event", "Message", "Facility", "Read", "Time"]}
          rows={notifs
            .slice((notifPage - 1) * notifPageSize, notifPage * notifPageSize)
            .map(n => [
              `#${n.request_id ?? "—"}`,
              <span style={{ fontSize: "11px", fontWeight: 600, background: "#f1f5f9", padding: "2px 6px", borderRadius: "6px" }}>
                {n.event_type}
              </span>,
              n.message_text,
              n.facility_name ?? "—",
              n.is_read === "Y"
                ? <span style={{ color: "#16a34a", fontSize: "12px" }}>✓ Read</span>
                : <span style={{ color: "#d97706", fontSize: "12px" }}>● New</span>,
              new Date(n.created_at).toLocaleString(),
            ])}
        />
        {notifs.length === 0 && (
          <p style={{ fontSize: "13px", color: "#94a3b8", marginTop: "8px" }}>
            No notifications yet — they appear automatically when requests are created or updated (trigger: <code>trg_transfusion_requests_notify</code>).
          </p>
        )}
        {notifs.length > 0 && (
          <TablePagination
            page={notifPage}
            pageSize={notifPageSize}
            total={notifs.length}
            onPageChange={setNotifPage}
            onPageSizeChange={(s) => { setNotifPageSize(s); setNotifPage(1); }}
          />
        )}
      </Section>
    </div>
  );
}
