import { useEffect, useState } from "react";
import { apiFetch } from "../api";
import { TablePagination } from "../components/TablePagination";

type AuditRow = {
  history_id: number;
  request_id: number;
  operation_type: string;
  old_status: string | null;
  new_status: string | null;
  change_time: string;
  user_id: string;
};

export function AuditPage() {
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    apiFetch<AuditRow[]>("/api/audit/requests")
      .then((data) => {
        setLogs(data);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const start = (page - 1) * pageSize;
  const visibleLogs = logs.slice(start, start + pageSize);

  return (
    <div className="page-container">
      <h1>Audit Trail — History of Changes</h1>
      <p className="muted" style={{ marginTop: "0.35rem" }}>
        Rows from <code>transfusion_request_history</code> (trigger on changes; seed data backfilled once).
      </p>
      {error && <p className="error-banner">{error}</p>}
      <div className="dashboard-card" style={{ marginTop: "20px" }}>
        <table className="stats-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Operation</th>
              <th>Transition</th>
              <th>Date</th>
              <th>User</th>
            </tr>
          </thead>
          <tbody>
            {visibleLogs.map((log: any) => (
              <tr key={log.history_id}>
                <td>#{log.request_id}</td>
                <td><span className="op-type">{log.operation_type}</span></td>
                <td>
                  <span className="status-badge old">{log.old_status || 'NONE'}</span>
                  {' → '}
                  <span className="status-badge new">{log.new_status}</span>
                </td>
                <td>{log.change_time}</td>
                <td>{log.user_id}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <TablePagination
          page={page}
          pageSize={pageSize}
          total={logs.length}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        />
      </div>
    </div>
  );
}