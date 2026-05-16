import { useEffect, useState } from "react";
import { apiFetch } from "../api";

interface BloodType { id: number; type: string; }

// ── Persist state across navigation via sessionStorage ───────────────────────
function usePersistedState<T>(key: string, def: T): [T, (v: T) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const s = sessionStorage.getItem(key);
      return s !== null ? (JSON.parse(s) as T) : def;
    } catch {
      return def;
    }
  });
  const set = (v: T) => {
    sessionStorage.setItem(key, JSON.stringify(v));
    setState(v);
  };
  return [state, set];
}

// ── Shared UI helpers ────────────────────────────────────────────────────────
function Badge({
  children, bg = "#dbeafe", color = "#1d4ed8",
}: { children: React.ReactNode; bg?: string; color?: string }) {
  return (
    <span style={{
      background: bg, color, borderRadius: 6,
      padding: "3px 10px", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
    }}>
      {children}
    </span>
  );
}

function SqlBlock({ label, code }: { label: string; code: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 14 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          background: "none", border: "1px solid #e2e8f0", borderRadius: 6,
          padding: "4px 14px", fontSize: 12, color: "#64748b", cursor: "pointer",
        }}
      >
        {open ? "▼" : "▶"} SQL — {label}
      </button>
      {open && (
        <pre style={{
          background: "#0f172a", color: "#e2e8f0", padding: "14px 18px",
          borderRadius: 8, fontSize: 12, overflow: "auto", margin: "8px 0 0",
          lineHeight: 1.65, whiteSpace: "pre",
        }}>
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}

function CardHeader({
  title, subtitle, badge,
}: { title: string; subtitle: React.ReactNode; badge: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
      <div>
        <h3 style={{ margin: "0 0 4px" }}>{title}</h3>
        <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>{subtitle}</p>
      </div>
      {badge}
    </div>
  );
}

// ── 1. Compatibility Check ───────────────────────────────────────────────────
function CompatibilitySection({ bloodTypes }: { bloodTypes: BloodType[] }) {
  // Use v2 keys so stale IDs from old hardcoded list don't interfere
  const [donorId,     setDonorId]     = usePersistedState("lab_donor_v2", "");
  const [recipientId, setRecipientId] = usePersistedState("lab_recipient_v2", "");
  const [result,      setResult]      = useState<boolean | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [apiError,    setApiError]    = useState("");

  useEffect(() => {
    if (!donorId || !recipientId) { setResult(null); setApiError(""); return; }
    setLoading(true); setApiError("");
    apiFetch<Record<string, unknown>>(
      `/api/compatibility/check?donor_type_id=${donorId}&recipient_type_id=${recipientId}`
    )
      .then(data => {
        // Accept any of: compatible:bool, compatible:"Y"/"N", compatible_flag:"Y"/"N"
        const v = data.compatible ?? data.compatible_flag;
        setResult(v === true || v === "Y");
      })
      .catch(e => { setApiError(e.message || "API error"); setResult(null); })
      .finally(() => setLoading(false));
  }, [donorId, recipientId]);

  return (
    <div className="dashboard-card" style={{ marginTop: 20, padding: "24px 28px" }}>
      <CardHeader
        title="Compatibility Check"
        subtitle={<>Oracle PL/SQL function <code>pkg_blood_operations.check_compatibility()</code></>}
        badge={<Badge>PL/SQL Function</Badge>}
      />

      {/* Row 1: dropdowns */}
      <div style={{ display: "flex", gap: 24, alignItems: "center", marginTop: 20, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Donor Blood Type</div>
          <select title="Donor Blood Type" value={donorId} onChange={e => setDonorId(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 8, border: "2px solid #e2e8f0", fontSize: 15, minWidth: 130 }}>
            <option value="">Select...</option>
            {bloodTypes.map(bt => <option key={`d${bt.id}`} value={bt.id}>{bt.type}</option>)}
          </select>
        </div>

        <div style={{ fontSize: 22, color: "#94a3b8", paddingTop: 18 }}>→</div>

        <div>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Recipient Blood Type</div>
          <select title="Recipient Blood Type" value={recipientId} onChange={e => setRecipientId(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 8, border: "2px solid #e2e8f0", fontSize: 15, minWidth: 130 }}>
            <option value="">Select...</option>
            {bloodTypes.map(bt => <option key={`r${bt.id}`} value={bt.id}>{bt.type}</option>)}
          </select>
        </div>
      </div>

      {/* Row 2: result — always below, full width */}
      <div style={{ marginTop: 20 }}>
        {!donorId || !recipientId ? (
          <div style={{ color: "#94a3b8", fontSize: 14, padding: "10px 0" }}>
            Select both blood types above to see the result.
          </div>
        ) : loading ? (
          <div style={{ color: "#64748b", fontSize: 15, padding: "10px 0" }}>
            Querying Oracle database... ⏳
          </div>
        ) : apiError ? (
          <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", color: "#92400e", borderRadius: 8, padding: "12px 16px", fontSize: 13 }}>
            ⚠️ {apiError}
          </div>
        ) : result === true ? (
          <div style={{ background: "#dcfce7", border: "2px solid #86efac", color: "#166534", borderRadius: 10, padding: "14px 22px", fontWeight: 700, fontSize: 18 }}>
            ✅ Compatible — these blood types can be transfused
          </div>
        ) : result === false ? (
          <div style={{ background: "#fee2e2", border: "2px solid #fca5a5", color: "#991b1b", borderRadius: 10, padding: "14px 22px", fontWeight: 700, fontSize: 18 }}>
            ❌ Incompatible — transfusion would be rejected
          </div>
        ) : (
          <div style={{ color: "#94a3b8", fontSize: 14, padding: "10px 0" }}>
            No result returned — check that the backend is running.
          </div>
        )}
      </div>

      <SqlBlock label="pkg_blood_operations.check_compatibility()" code={
`-- Resolves blood type names from IDs, then applies standard ABO/Rh rules:
SELECT d.type_group || d.rh_factor AS donor_type,
       r.type_group || r.rh_factor AS recipient_type
FROM blood_types d, blood_types r
WHERE d.blood_type_id = :donor_type_id
  AND r.blood_type_id = :recipient_type_id;

-- PL/SQL package function (package_of_all.sql) — same logic via COMPATIBILITY_MATRIX:
FUNCTION check_compatibility(p_donor_type_id IN NUMBER, p_recipient_type_id IN NUMBER)
RETURN VARCHAR2 IS
    v_is_compatible NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_is_compatible
    FROM COMPATIBILITY_MATRIX
    WHERE donor_blood_type_id    = p_donor_type_id
      AND recipient_blood_type_id = p_recipient_type_id;
    RETURN CASE WHEN v_is_compatible > 0 THEN 'Y' ELSE 'N' END;
EXCEPTION WHEN OTHERS THEN RETURN 'ERROR';
END;`} />
    </div>
  );
}

// ── 2. Provenance Tracer ─────────────────────────────────────────────────────
interface UnitSummary {
  unit_id: number;
  donor_name: string;
  blood_type: string;
  unit_status: string;
}

interface ProvenanceData {
  unit_id: number;
  blood_type: string;
  unit_status: string;
  donor_id: number;
  donor_name: string;
  donation_date: string;
  expiry_date: string;
  donation_id: number;
}

function ProvenanceSection() {
  const [units,   setUnits]   = useState<UnitSummary[]>([]);
  const [search,  setSearch]  = usePersistedState("lab_prov_search", "");
  const [unitId,  setUnitId]  = usePersistedState("lab_prov_unit", "");
  const [data,    setData]    = useState<ProvenanceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  // Load units list once on mount
  useEffect(() => {
    apiFetch<UnitSummary[]>("/api/provenance/units")
      .then(setUnits)
      .catch(() => {});
  }, []);

  // Load provenance when unitId is selected
  useEffect(() => {
    if (!unitId) { setData(null); setError(""); return; }
    setLoading(true); setError("");
    apiFetch<ProvenanceData>(`/api/provenance/${unitId}`)
      .then(setData)
      .catch(e => { setError(e.message || "Unit not found"); setData(null); })
      .finally(() => setLoading(false));
  }, [unitId]);

  const filtered = search.trim()
    ? units.filter(u => u.donor_name.toLowerCase().includes(search.toLowerCase()))
    : units;

  const fields: [string, React.ReactNode][] = data ? [
    ["Blood Type",    <span style={{ color: "#dc2626", fontWeight: 700 }}>{data.blood_type}</span>],
    ["Status",        data.unit_status],
    ["Donor",         `${data.donor_name} (ID: ${data.donor_id})`],
    ["Donation Date", data.donation_date],
    ["Expiry Date",   data.expiry_date],
    ["Donation ID",   String(data.donation_id)],
  ] : [];

  return (
    <div className="dashboard-card" style={{ marginTop: 20, padding: "24px 28px" }}>
      <CardHeader
        title="Provenance Tracer"
        subtitle={<>Queries view <code>vw_unit_lineage</code> — full chain from donor to dispatch</>}
        badge={<Badge bg="#f0fdf4" color="#15803d">Oracle View</Badge>}
      />

      <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "0 0 220px" }}>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Search by donor name</div>
          <input
            type="text"
            placeholder="e.g. John"
            value={search}
            onChange={e => { setSearch(e.target.value); setUnitId(""); setData(null); }}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14, width: "100%", boxSizing: "border-box" }}
          />
        </div>

        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>
            Select blood unit ({filtered.length} found)
          </div>
          <select
            title="Select blood unit"
            value={unitId}
            onChange={e => setUnitId(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 8, border: "2px solid #e2e8f0", fontSize: 14, width: "100%" }}
          >
            <option value="">— pick a unit —</option>
            {filtered.map(u => (
              <option key={u.unit_id} value={u.unit_id}>
                {u.donor_name} — Unit #{u.unit_id} ({u.blood_type}, {u.unit_status})
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && <div style={{ color: "#64748b", marginTop: 10 }}>Loading...</div>}
      {error   && <div style={{ color: "#dc2626", marginTop: 10, fontSize: 14 }}>{error}</div>}

      {data && (
        <div style={{ marginTop: 16, border: "1px solid #e2e8f0", borderRadius: 10, padding: 20, background: "#f8fafc" }}>
          <strong style={{ fontSize: 15 }}>Unit #{data.unit_id}</strong>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginTop: 14 }}>
            {fields.map(([label, value]) => (
              <div key={String(label)}>
                <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>
                  {label}
                </div>
                <div style={{ fontWeight: 600 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <SqlBlock label="vw_unit_lineage" code={
`-- API query (provenance.py):
SELECT * FROM vw_unit_lineage WHERE unit_id = :unit_id;

-- View joins the full chain of custody:
--   blood_units
--     → donation_events  (when it was collected)
--     → donors           (who donated)
--     → blood_types      (ABO / Rh classification)
-- Result columns: unit_id, blood_type, unit_status,
--                 donor_id, donor_name, donation_date,
--                 expiry_date, donation_id`} />
    </div>
  );
}

// ── 3. Request History Timeline ──────────────────────────────────────────────
interface HistoryRow {
  history_id: number;
  operation_type: string;
  old_status: string | null;
  new_status: string | null;
  old_units_required: number | null;
  new_units_required: number | null;
  changed_at: string;
  changed_by: string;
  change_note: string | null;
}

const OP_COLOR: Record<string, string> = {
  INSERT: "#dbeafe",
  UPDATE: "#fef3c7",
  DELETE: "#fee2e2",
};

function RequestHistorySection() {
  const [requestId, setRequestId] = usePersistedState("lab_req_id", "");
  const [rows,      setRows]      = useState<HistoryRow[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [searched,  setSearched]  = useState(false);

  const search = () => {
    if (!requestId) return;
    setLoading(true); setError(""); setSearched(true);
    apiFetch<HistoryRow[]>(`/api/compatibility/request-history/${requestId}`)
      .then(setRows)
      .catch(e => { setError(e.message || "Error"); setRows([]); })
      .finally(() => setLoading(false));
  };

  return (
    <div className="dashboard-card" style={{ marginTop: 20, padding: "24px 28px" }}>
      <CardHeader
        title="Request History Timeline"
        subtitle={<>Trigger <code>trg_transfusion_requests_history</code> writes to <code>transfusion_request_history</code> on every change</>}
        badge={<Badge bg="#fef3c7" color="#92400e">Trigger + Package</Badge>}
      />

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <input
          type="number"
          placeholder="Request ID (e.g. 1)"
          value={requestId}
          onChange={e => setRequestId(e.target.value)}
          onKeyDown={e => e.key === "Enter" && search()}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14, width: 200 }}
        />
        <button type="button" onClick={search} disabled={loading || !requestId}>
          {loading ? "Loading..." : "Load History"}
        </button>
      </div>

      {error && <div style={{ color: "#dc2626", marginTop: 10, fontSize: 14 }}>{error}</div>}
      {searched && !loading && rows.length === 0 && !error && (
        <div style={{ color: "#94a3b8", marginTop: 10, fontSize: 14 }}>No history records found for this request ID.</div>
      )}

      {rows.length > 0 && (
        <div style={{ overflowX: "auto", marginTop: 16 }}>
          <table className="stats-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Operation</th>
                <th>Old Status</th>
                <th>New Status</th>
                <th>Units old→new</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.history_id}>
                  <td style={{ fontSize: 12, color: "#64748b", whiteSpace: "nowrap" }}>{r.changed_at}</td>
                  <td>
                    <span style={{
                      background: OP_COLOR[r.operation_type] ?? "#f1f5f9",
                      borderRadius: 4, padding: "2px 8px", fontSize: 12, fontWeight: 600,
                    }}>
                      {r.operation_type}
                    </span>
                  </td>
                  <td style={{ color: "#64748b" }}>{r.old_status ?? "—"}</td>
                  <td style={{ fontWeight: 600 }}>{r.new_status ?? "—"}</td>
                  <td style={{ fontSize: 12 }}>{r.old_units_required ?? "—"} → {r.new_units_required ?? "—"}</td>
                  <td style={{ fontSize: 12, color: "#64748b" }}>{r.change_note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SqlBlock label="trg_transfusion_requests_history + pkg_request_workflow.get_request_history()" code={
`-- Oracle TRIGGER — captures every INSERT / UPDATE / DELETE automatically:
CREATE OR REPLACE TRIGGER trg_transfusion_requests_history
AFTER INSERT OR UPDATE OR DELETE ON transfusion_requests
FOR EACH ROW
BEGIN
    IF INSERTING THEN
        INSERT INTO transfusion_request_history(request_id, operation_type, new_status, ...)
        VALUES (:NEW.request_id, 'INSERT', :NEW.status, ...);
    ELSIF UPDATING THEN
        -- only record when status or units actually changed
        IF NVL(:OLD.status,'NULL') <> NVL(:NEW.status,'NULL')
           OR NVL(:OLD.units_required,-1) <> NVL(:NEW.units_required,-1) THEN
            INSERT INTO transfusion_request_history(...)
            VALUES (:NEW.request_id, 'UPDATE', :OLD.status, :NEW.status, ...);
        END IF;
    ELSIF DELETING THEN
        INSERT INTO transfusion_request_history(...)
        VALUES (:OLD.request_id, 'DELETE', :OLD.status, NULL, ...);
    END IF;
END;

-- Package function that retrieves history using BULK COLLECT:
FUNCTION get_request_history(p_request_id IN NUMBER) RETURN t_request_hist_tab IS
    v_hist t_request_hist_tab;
BEGIN
    SELECT history_id, operation_type, old_status, new_status, changed_at, ...
    BULK COLLECT INTO v_hist
    FROM transfusion_request_history
    WHERE request_id = p_request_id
    ORDER BY changed_at DESC;
    RETURN v_hist;
END;`} />
    </div>
  );
}

// ── 4. Compatible Donors — BULK COLLECT demo ─────────────────────────────────
interface CompatibleDonor {
  donor_blood_type_id: number;
  donor_blood_type: string;
}

function CompatibleDonorsSection({ bloodTypes }: { bloodTypes: BloodType[] }) {
  const [recipientId, setRecipientId] = usePersistedState("lab_compat_rec_v2", "");
  const [donors,      setDonors]      = useState<CompatibleDonor[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [searched,    setSearched]    = useState(false);

  useEffect(() => {
    if (!recipientId) { setDonors([]); setSearched(false); return; }
    setLoading(true); setSearched(true);
    apiFetch<CompatibleDonor[]>(`/api/compatibility/for-recipient/${recipientId}`)
      .then(setDonors)
      .catch(() => setDonors([]))
      .finally(() => setLoading(false));
  }, [recipientId]);

  const recipientLabel = bloodTypes.find(b => String(b.id) === recipientId)?.type ?? "";

  return (
    <div className="dashboard-card" style={{ marginTop: 20, padding: "24px 28px" }}>
      <CardHeader
        title="Compatible Donors Lookup"
        subtitle={
          <>Demonstrates <code>pkg_blood_management.get_compatible_donor_types()</code> using <strong>BULK COLLECT</strong></>
        }
        badge={<Badge bg="#fdf4ff" color="#7e22ce">BULK COLLECT</Badge>}
      />

      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>Recipient Blood Type</div>
        <select
          title="Recipient Blood Type"
          value={recipientId}
          onChange={e => setRecipientId(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 8, border: "2px solid #e2e8f0", fontSize: 15, minWidth: 180 }}
        >
          <option value="">Select recipient type...</option>
          {bloodTypes.map(bt => <option key={bt.id} value={bt.id}>{bt.type}</option>)}
        </select>
      </div>

      {loading && <div style={{ marginTop: 12, color: "#64748b" }}>Loading...</div>}

      {searched && !loading && (
        <div style={{ marginTop: 16 }}>
          {donors.length === 0 ? (
            <div style={{ color: "#94a3b8", fontSize: 14 }}>No compatible donors found.</div>
          ) : (
            <>
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 10 }}>
                {donors.length} blood type{donors.length > 1 ? "s" : ""} can donate to <strong>{recipientLabel}</strong>:
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {donors.map(d => (
                  <div key={d.donor_blood_type_id} style={{
                    background: "#fee2e2", border: "2px solid #fca5a5",
                    borderRadius: 8, padding: "8px 20px",
                    fontWeight: 700, fontSize: 18, color: "#991b1b",
                  }}>
                    {d.donor_blood_type}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <SqlBlock label="pkg_blood_management.get_compatible_donor_types() — BULK COLLECT" code={
`-- PL/SQL Collection + BULK COLLECT (package_of_all.sql):
FUNCTION get_compatible_donor_types(p_recipient_type_id IN NUMBER)
RETURN t_blood_type_list IS          -- t_blood_type_list = TABLE OF NUMBER
    v_list t_blood_type_list;
BEGIN
    SELECT donor_blood_type_id
    BULK COLLECT INTO v_list          -- fills PL/SQL collection in one SQL round-trip
    FROM COMPATIBILITY_MATRIX
    WHERE recipient_blood_type_id = p_recipient_type_id;
    RETURN v_list;
END;

-- API uses the readable view (same data, richer labels):
SELECT donor_blood_type_id, donor_blood_type
FROM vw_compat_pairs_readable
WHERE recipient_blood_type_id = :recipient_id;`} />
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export function BloodLabPage() {
  const [bloodTypes, setBloodTypes] = useState<BloodType[]>([]);

  useEffect(() => {
    apiFetch<BloodType[]>("/api/compatibility/blood-types")
      .then(setBloodTypes)
      .catch(() => {});
  }, []);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Blood Lab — PL/SQL Showcase</h1>
        
      </div>

      <CompatibilitySection bloodTypes={bloodTypes} />
      <ProvenanceSection />
      <RequestHistorySection />
      <CompatibleDonorsSection bloodTypes={bloodTypes} />
    </div>
  );
}
