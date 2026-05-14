import { useEffect, useState } from "react";
import { TablePagination } from "../components/TablePagination";

export function AuditPage() {
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    fetch("/api/audit/requests")
      .then((res) => res.json())
      .then((data) => setLogs(data));
  }, []);

  const start = (page - 1) * pageSize;
  const visibleLogs = logs.slice(start, start + pageSize);

  return (
    <div className="page-container">
      <h1>Audit Trail — History of Changes</h1>
      <div className="dashboard-card" style={{ marginTop: '20px' }}>
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