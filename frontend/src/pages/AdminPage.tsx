import { useCallback, useEffect, useState } from "react";
import { apiFetch, withQuery } from "../api";
import { TablePagination } from "../components/TablePagination";
import { validateDateRange, validateUrgencyRange } from "../utils/listFilters";

type AdminRow = {
  request_id: number;
  request_date: string;
  urgency_level: number;
  units_required: number;
  request_status: string;
  patient_id: number;
  patient_name: string;
  facility_id: number;
  facility_name: string;
};

type PagedAdmin = {
  items: AdminRow[];
  total: number;
  page: number;
  page_size: number;
};

type AdminFilterOptions = {
  statuses: string[];
  cities: string[];
  blood_types: string[];
};

export function AdminPage() {
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [filterOpts, setFilterOpts] = useState<AdminFilterOptions>({
    statuses: [],
    cities: [],
    blood_types: [],
  });

  const [draftStatus, setDraftStatus] = useState("");
  const [draftCity, setDraftCity] = useState("");
  const [draftBloodType, setDraftBloodType] = useState("");
  const [draftUmin, setDraftUmin] = useState("");
  const [draftUmax, setDraftUmax] = useState("");
  const [draftDateFrom, setDraftDateFrom] = useState("");
  const [draftDateTo, setDraftDateTo] = useState("");

  const [appliedStatus, setAppliedStatus] = useState("");
  const [appliedCity, setAppliedCity] = useState("");
  const [appliedBloodType, setAppliedBloodType] = useState("");
  const [appliedUmin, setAppliedUmin] = useState("");
  const [appliedUmax, setAppliedUmax] = useState("");
  const [appliedDateFrom, setAppliedDateFrom] = useState("");
  const [appliedDateTo, setAppliedDateTo] = useState("");

  useEffect(() => {
    void apiFetch<AdminFilterOptions>("/api/admin/request-overview/filter-options").then(setFilterOpts);
  }, []);

  const load = useCallback(() => {
    setError(null);
    const path = withQuery("/api/admin/request-overview", {
      page,
      page_size: pageSize,
      request_status: appliedStatus || undefined,
      city_name: appliedCity || undefined,
      blood_type: appliedBloodType || undefined,
      urgency_min: appliedUmin === "" ? undefined : Number(appliedUmin),
      urgency_max: appliedUmax === "" ? undefined : Number(appliedUmax),
      date_from: appliedDateFrom || undefined,
      date_to: appliedDateTo || undefined,
    });
    return apiFetch<PagedAdmin>(path)
      .then((data) => {
        setRows(data.items);
        setTotal(data.total);
      })
      .catch((e: Error) => setError(e.message));
  }, [
    page,
    pageSize,
    appliedStatus,
    appliedCity,
    appliedBloodType,
    appliedUmin,
    appliedUmax,
    appliedDateFrom,
    appliedDateTo,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  function applyFilters() {
    const uErr = validateUrgencyRange(draftUmin, draftUmax);
    const dErr = validateDateRange(draftDateFrom, draftDateTo);
    const err = uErr || dErr;
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setAppliedStatus(draftStatus);
    setAppliedCity(draftCity);
    setAppliedBloodType(draftBloodType);
    setAppliedUmin(draftUmin);
    setAppliedUmax(draftUmax);
    setAppliedDateFrom(draftDateFrom);
    setAppliedDateTo(draftDateTo);
    setPage(1);
  }

  function clearFilters() {
    setError(null);
    setDraftStatus("");
    setDraftCity("");
    setDraftBloodType("");
    setDraftUmin("");
    setDraftUmax("");
    setDraftDateFrom("");
    setDraftDateTo("");
    setAppliedStatus("");
    setAppliedCity("");
    setAppliedBloodType("");
    setAppliedUmin("");
    setAppliedUmax("");
    setAppliedDateFrom("");
    setAppliedDateTo("");
    setPage(1);
  }

  return (
    <div className="page admin-page">
      <header className="page-header">
        <h1>Admin</h1>
        <p className="lead">All facilities — request overview (admin only).</p>
      </header>

      {error && <p className="error-banner">{error}</p>}

      <section className="card section-card">
        <h2>Request overview</h2>
        <div className="filter-bar">
          <div className="filter-field">
            <label htmlFor="adm-status">Request status</label>
            <select
              id="adm-status"
              value={draftStatus}
              onChange={(e) => setDraftStatus(e.target.value)}
            >
              <option value="">All</option>
              {filterOpts.statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-field filter-field--grow">
            <label htmlFor="adm-city">City (facility location)</label>
            <select id="adm-city" value={draftCity} onChange={(e) => setDraftCity(e.target.value)}>
              <option value="">All cities</option>
              {filterOpts.cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-field filter-field--grow">
            <label htmlFor="adm-blood">Patient blood type</label>
            <select
              id="adm-blood"
              value={draftBloodType}
              onChange={(e) => setDraftBloodType(e.target.value)}
            >
              <option value="">All blood types</option>
              {filterOpts.blood_types.map((bt) => (
                <option key={bt} value={bt}>
                  {bt}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="adm-umin">Urgency min</label>
            <input
              id="adm-umin"
              type="number"
              min={1}
              max={5}
              placeholder="1–5"
              value={draftUmin}
              onChange={(e) => setDraftUmin(e.target.value)}
            />
          </div>
          <div className="filter-field">
            <label htmlFor="adm-umax">Urgency max</label>
            <input
              id="adm-umax"
              type="number"
              min={1}
              max={5}
              placeholder="1–5"
              value={draftUmax}
              onChange={(e) => setDraftUmax(e.target.value)}
            />
          </div>
          <div className="filter-field">
            <label htmlFor="adm-df">From date</label>
            <input id="adm-df" type="date" value={draftDateFrom} onChange={(e) => setDraftDateFrom(e.target.value)} />
          </div>
          <div className="filter-field">
            <label htmlFor="adm-dt">To date</label>
            <input id="adm-dt" type="date" value={draftDateTo} onChange={(e) => setDraftDateTo(e.target.value)} />
          </div>
          <button type="button" className="btn btn-primary btn-filter-apply" onClick={applyFilters}>
            Apply filters
          </button>
          <button type="button" className="btn-filter-clear" onClick={clearFilters}>
            Clear
          </button>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Date</th>
                <th>Urgency</th>
                <th>Units</th>
                <th>Request status</th>
                <th>Patient</th>
                <th>Facility</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.request_id}>
                  <td>{r.request_id}</td>
                  <td>{String(r.request_date)}</td>
                  <td>{r.urgency_level}</td>
                  <td>{r.units_required}</td>
                  <td>{r.request_status}</td>
                  <td>{r.patient_name}</td>
                  <td>{r.facility_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <TablePagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setPage(1);
          }}
        />
      </section>
    </div>
  );
}
