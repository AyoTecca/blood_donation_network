import { useEffect, useState } from "react";
import "../style.css"; 


interface InventoryStat {
  status: string;
  unit_count: number;
}

interface RequestStat {
  status: string;
  request_count: number;
}

export function DashboardPage() {
  const [data, setData] = useState<{ inventory: InventoryStat[], requests: RequestStat[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const token = localStorage.getItem("bn_access_token");
        const response = await fetch("/api/analytics/summary", {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error("Failed to fetch analytics");
        
        const result = await response.json();
        setData(result);
      } catch (err: any) {
        console.error(err);
        setError("Error loading analytics data from Oracle.");
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading) return <div className="page-container">Loading analytics...</div>;
  if (error) return <div className="page-container message-box">{error}</div>;

  
  const totalUnits = data?.inventory.reduce((sum, item) => sum + item.unit_count, 0) || 1;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Analytics Dashboard</h1>
        
      </div>

      <div className="dashboard-grid">
        
        <div className="dashboard-card">
          <h3>Requests by Status</h3>
          <div className="stats-list">
            {data?.requests.map((stat, index) => (
              <div key={index} className="stat-item">
                <span>{stat.status}</span>
                
                <strong>{stat.request_count}</strong>
              </div>
            ))}
            {data?.requests.length === 0 && <p>No request data available.</p>}
          </div>
        </div>

        {/* Карточка 2: Запасы крови */}
        <div className="dashboard-card">
          <h3>Blood Inventory by Status</h3>
          <table className="stats-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Units</th>
                <th>% of Total</th>
              </tr>
            </thead>
            <tbody>
              {data?.inventory.map((inv, index) => {
                // Высчитываем процент от общего числа пакетов
                const fillPercentage = (inv.unit_count / totalUnits) * 100;

                return (
                  <tr key={index}>
                   
                    <td><strong>{inv.status}</strong></td>
                    <td>{inv.unit_count}</td>
                    <td>
                      <div className="progress-bar-bg">
                       
                        <div 
                          className="progress-bar-fill" 
                          style={{ width: `${fillPercentage}%` }}
                        ></div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}