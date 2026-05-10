import { useCallback, useEffect, useState } from "react";
import { apiFetch, withQuery } from "../api";
import { TablePagination } from "../components/TablePagination";
import { validateUrgencyRange } from "../utils/listFilters";

type OpenRequest = {
  request_id: number;
  facility_id: number;
  facility_name: string;
  patient_name: string;
  blood_type: string;
  urgency_level: number;
  units_required: number;
  status: string;
  request_date: string;
};

type CountRow = { status: string; unit_count?: number; request_count?: number };
type DispatchRow = { status: string; dispatch_count: number; avg_distance_km: number };

type PagedOpen = {
  items: OpenRequest[];
  total: number;
  page: number;
  page_size: number;
};

type OpenRequestFilterOptions = {
  statuses: string[];
  facilities: string[];
  blood_types: string[];
};

export function HomePage() {
  const [inventory, setInventory] = useState<CountRow[]>([]);
  const [requestsByStatus, setRequestsByStatus] = useState<CountRow[]>([]);
  const [dispatch, setDispatch] = useState<DispatchRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [openRows, setOpenRows] = useState<OpenRequest[]>([]);
  const [openTotal, setOpenTotal] = useState(0);
  const [openPage, setOpenPage] = useState(1);
  const [openPageSize, setOpenPageSize] = useState(10);
  const [openError, setOpenError] = useState<string | null>(null);
  const [openFilterOpts, setOpenFilterOpts] = useState<OpenRequestFilterOptions>({
    statuses: [],
    facilities: [],
    blood_types: [],
  });

  const [draftStatus, setDraftStatus] = useState("");
  const [draftFacility, setDraftFacility] = useState("");
  const [draftBlood, setDraftBlood] = useState("");
  const [draftUmin, setDraftUmin] = useState("");
  const [draftUmax, setDraftUmax] = useState("");

  const [appliedStatus, setAppliedStatus] = useState("");
  const [appliedFacility, setAppliedFacility] = useState("");
  const [appliedBlood, setAppliedBlood] = useState("");
  const [appliedUmin, setAppliedUmin] = useState("");
  const [appliedUmax, setAppliedUmax] = useState("");

  const loadDashboard = useCallback((opts?: { silent?: boolean }) => {
    setError(null);
    if (!opts?.silent) setLoading(true);
    Promise.all([
      apiFetch<CountRow[]>("/api/dashboard/inventory-by-status"),
      apiFetch<CountRow[]>("/api/dashboard/requests-by-status"),
      apiFetch<DispatchRow[]>("/api/dashboard/dispatch-performance"),
    ])
      .then(([inv, rs, dp]) => {
        setInventory(inv);
        setRequestsByStatus(rs);
        setDispatch(dp);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => {
        if (!opts?.silent) setLoading(false);
      });
  }, []);

  const loadOpen = useCallback(() => {
    setOpenError(null);
    const path = withQuery("/api/open-requests", {
      page: openPage,
      page_size: openPageSize,
      status: appliedStatus || undefined,
      facility_name: appliedFacility || undefined,
      blood_type: appliedBlood || undefined,
      urgency_min: appliedUmin === "" ? undefined : Number(appliedUmin),
      urgency_max: appliedUmax === "" ? undefined : Number(appliedUmax),
    });
    return apiFetch<PagedOpen>(path)
      .then((data) => {
        setOpenRows(data.items);
        setOpenTotal(data.total);
      })
      .catch((e: Error) => setOpenError(e.message));
  }, [openPage, openPageSize, appliedStatus, appliedFacility, appliedBlood, appliedUmin, appliedUmax]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    void apiFetch<OpenRequestFilterOptions>("/api/open-requests/filter-options").then(setOpenFilterOpts);
  }, []);

  useEffect(() => {
    void loadOpen();
  }, [loadOpen]);

  useEffect(() => {
    const intervalMs = 60_000;
    const id = window.setInterval(() => {
      loadDashboard({ silent: true });
      void apiFetch<OpenRequestFilterOptions>("/api/open-requests/filter-options").then(setOpenFilterOpts);
      void loadOpen();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [loadDashboard, loadOpen]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        loadDashboard({ silent: true });
        void apiFetch<OpenRequestFilterOptions>("/api/open-requests/filter-options").then(setOpenFilterOpts);
        void loadOpen();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [loadDashboard, loadOpen]);

  const totalUnits = inventory.reduce((s, r) => s + (Number(r.unit_count) || 0), 0);
  const totalRequests = requestsByStatus.reduce((s, r) => s + (Number(r.request_count) || 0), 0);
  const totalDispatches = dispatch.reduce((s, r) => s + (Number(r.dispatch_count) || 0), 0);

  function applyOpenFilters() {
    const uErr = validateUrgencyRange(draftUmin, draftUmax);
    if (uErr) {
      setOpenError(uErr);
      return;
    }
    setOpenError(null);
    setAppliedStatus(draftStatus);
    setAppliedFacility(draftFacility);
    setAppliedBlood(draftBlood);
    setAppliedUmin(draftUmin);
    setAppliedUmax(draftUmax);
    setOpenPage(1);
  }

  function clearOpenFilters() {
    setOpenError(null);
    setDraftStatus("");
    setDraftFacility("");
    setDraftBlood("");
    setDraftUmin("");
    setDraftUmax("");
    setAppliedStatus("");
    setAppliedFacility("");
    setAppliedBlood("");
    setAppliedUmin("");
    setAppliedUmax("");
    setOpenPage(1);
  }

  return (
    <div className="page home-page">
      <header className="page-header">
        <h1>Home</h1>
        <p className="lead">Operational overview and open transfusion workload.</p>
      </header>

      {error && <p className="error-banner">{error}</p>}

      <section className="insight-cards">
        <article className="card">
          <h3>Blood units tracked</h3>
          <p className="metric">{loading ? "…" : totalUnits}</p>
          <p className="muted">
            Sum of physical units in inventory
          </p>
        </article>
        <article className="card">
          <h3>Open pipeline requests</h3>
          <p className="metric">{loading ? "…" : openTotal}</p>
          <p className="muted">Pending / partially fulfilled (matches filters below)</p>
        </article>
        <article className="card">
          <h3>All transfusion requests</h3>
          <p className="metric">{loading ? "…" : totalRequests}</p>
          <p className="muted">
            Total request records in the database, every status combined
          </p>
        </article>
      </section>

      <div className="grid-2">
        <section className="card section-card">
          <h2>Blood unit inventory by status</h2>
          <p className="section-lead muted">
            One row per unit in <code className="inline-code">blood_units</code>; the status column is
            each unit&apos;s inventory state (available, reserved, etc.).
          </p>
          <table className="data-table">
            <thead>
              <tr>
                <th>Unit inventory status</th>
                <th>Units</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((row) => (
                <tr key={row.status}>
                  <td>{row.status}</td>
                  <td>{row.unit_count}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td>{loading ? "…" : totalUnits}</td>
              </tr>
            </tfoot>
          </table>
        </section>

        <section className="card section-card">
          <h2>Transfusion requests by status</h2>
          <p className="section-lead muted">
            Rows in <code className="inline-code">transfusion_requests</code>; the status column is the
            clinical request workflow (pending, completed, etc.) — not the same as unit inventory status.
          </p>
          <table className="data-table">
            <thead>
              <tr>
                <th>Request workflow status</th>
                <th>Requests</th>
              </tr>
            </thead>
            <tbody>
              {requestsByStatus.map((row) => (
                <tr key={row.status}>
                  <td>{row.status}</td>
                  <td>{row.request_count}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td>{loading ? "…" : totalRequests}</td>
              </tr>
            </tfoot>
          </table>
        </section>
      </div>

      <section className="card section-card">
        <h2>Dispatch performance</h2>
        <p className="section-lead muted">
          Rows in <code className="inline-code">match_dispatches</code>; the first column is dispatch
          logistics status (queued, arrived, etc.) — not unit or request workflow status.
        </p>
        <table className="data-table">
          <thead>
            <tr>
              <th>Dispatch status</th>
              <th>Dispatches</th>
              <th>Avg distance (km)</th>
            </tr>
          </thead>
          <tbody>
            {dispatch.map((row) => (
              <tr key={row.status}>
                <td>{row.status}</td>
                <td>{row.dispatch_count}</td>
                <td>{row.avg_distance_km}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Total dispatches</td>
              <td>{loading ? "…" : totalDispatches}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </section>

      <section className="card section-card">
        <h2>Open transfusion requests</h2>
        {openError && <p className="error-banner">{openError}</p>}
        <div className="filter-bar">
          <div className="filter-field">
            <label htmlFor="home-status">Request status</label>
            <select id="home-status" value={draftStatus} onChange={(e) => setDraftStatus(e.target.value)}>
              <option value="">All</option>
              {openFilterOpts.statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-field filter-field--grow">
            <label htmlFor="home-fac">Facility</label>
            <select id="home-fac" value={draftFacility} onChange={(e) => setDraftFacility(e.target.value)}>
              <option value="">All facilities</option>
              {openFilterOpts.facilities.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="home-blood">Blood type</label>
            <select id="home-blood" value={draftBlood} onChange={(e) => setDraftBlood(e.target.value)}>
              <option value="">All blood types</option>
              {openFilterOpts.blood_types.map((bt) => (
                <option key={bt} value={bt}>
                  {bt}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="home-umin">Urgency min</label>
            <input
              id="home-umin"
              type="number"
              min={1}
              max={5}
              placeholder="1–5"
              value={draftUmin}
              onChange={(e) => setDraftUmin(e.target.value)}
            />
          </div>
          <div className="filter-field">
            <label htmlFor="home-umax">Urgency max</label>
            <input
              id="home-umax"
              type="number"
              min={1}
              max={5}
              placeholder="1–5"
              value={draftUmax}
              onChange={(e) => setDraftUmax(e.target.value)}
            />
          </div>
          <button type="button" className="btn btn-primary btn-filter-apply" onClick={applyOpenFilters}>
            Apply filters
          </button>
          <button type="button" className="btn-filter-clear" onClick={clearOpenFilters}>
            Clear
          </button>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Facility</th>
                <th>Patient</th>
                <th>Blood</th>
                <th>Urgency</th>
                <th>Units</th>
                <th>Request status</th>
              </tr>
            </thead>
            <tbody>
              {openRows.map((r) => (
                <tr key={r.request_id}>
                  <td>{r.request_id}</td>
                  <td>{r.facility_name}</td>
                  <td>{r.patient_name}</td>
                  <td className="accent-text">{r.blood_type}</td>
                  <td>{r.urgency_level}</td>
                  <td>{r.units_required}</td>
                  <td>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={openPage}
          pageSize={openPageSize}
          total={openTotal}
          onPageChange={setOpenPage}
          onPageSizeChange={(n) => {
            setOpenPageSize(n);
            setOpenPage(1);
          }}
        />
      </section>
    </div>
  );
}
