import { useEffect, useState } from "react";

export function AuditPage() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    fetch("/api/audit/requests")
      .then((res) => res.json())
      .then((data) => setLogs(data));
  }, []);

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
            {logs.map((log: any) => (
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
      </div>
    </div>
  );
}