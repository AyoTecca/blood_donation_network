import { useEffect, useState } from "react";

interface DispatchRecord {
  dispatch_id: number;
  request_id: number;
  unit_id: number;
  dispatch_status: string;
  dispatch_time: string;
  urgency: string;
  destination_facility: string;
}

export function DispatchesPage() {
  const [dispatches, setDispatches] = useState<DispatchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDispatches = async () => {
      try {
        const token = localStorage.getItem("bn_access_token");
        const response = await fetch("/api/dispatches/", {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error("Failed to fetch dispatches");
        
        const data = await response.json();
        setDispatches(data);
      } catch (err: any) {
        console.error(err);
        setError("Error loading logistics data.");
      } finally {
        setLoading(false);
      }
    };
    fetchDispatches();
  }, []);

  if (loading) return <div className="page-container">Loading logistics map...</div>;
  if (error) return <div className="page-container message-box">{error}</div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Dispatch & Logistics</h1>
        <p>Monitor blood units in transit across the network.</p>
      </div>

      <div className="dashboard-card" style={{ marginTop: '20px' }}>
        <table className="stats-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Destination</th>
              <th>Unit ID</th>
              <th>Urgency</th>
              <th>Dispatch Time</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {dispatches.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: "20px" }}>
                  No active dispatches found.
                </td>
              </tr>
            ) : (
              dispatches.map((d) => (
                <tr key={d.dispatch_id}>
                  <td><strong>#{d.dispatch_id}</strong></td>
                  <td>{d.destination_facility || "Unknown"}</td>
                  <td>{d.unit_id}</td>
                  <td>
                    <span style={{ 
                      color: d.urgency === 'Critical' ? 'red' : 'inherit',
                      fontWeight: d.urgency === 'Critical' ? 'bold' : 'normal'
                    }}>
                      {d.urgency}
                    </span>
                  </td>
                  <td>{d.dispatch_time || "Pending"}</td>
                  <td>
                    <span className="stat-item" style={{ padding: '4px 8px', borderLeft: 'none', background: '#e9ecef', borderRadius: '4px'}}>
                      {d.dispatch_status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}