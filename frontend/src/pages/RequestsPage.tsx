import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";

// Define the TypeScript interface for our request data
interface TransfusionRequest {
  request_id: number;
  requesting_facility_id: number;
  patient_id: number;
  blood_type_id: number;
  units_requested: number;
  status: string;
  urgency_level: string;
  request_date: string;
}

export function RequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<TransfusionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchingLoading, setMatchingLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Fetch the list of requests when the component mounts
  const fetchRequests = async () => {
    try {
      const token = localStorage.getItem("bn_access_token"); 
      
      const response = await fetch("http://127.0.0.1:8000/api/requests/", {
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      
      if (!response.ok) {
          const errorDetail = await response.json().catch(() => ({}));
          throw new Error(errorDetail.detail || `Server error: ${response.status}`);
      }
      
      const data = await response.json();
      setRequests(data);
    } catch (error: any) {
      console.error("Error fetching requests:", error);
      setMessage(error.message || "Error loading data from server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  // Trigger the Oracle PL/SQL blood matching process
  const handleRunMatching = async () => {
    // if (!window.confirm("Run the automated blood matching algorithm?")) return;
    
    setMatchingLoading(true);
    setMessage(null);
    
    try {
      const token = localStorage.getItem("bn_access_token");
      const response = await fetch("http://127.0.0.1:8000/api/requests/run-matching", {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      
      const result = await response.json();
      
      if (!response.ok) throw new Error(result.detail || "Matching failed");
      
      setMessage(result.message);
      // Refresh the list to see updated statuses after matching
      await fetchRequests();
    } catch (error: any) {
      console.error("Error running match:", error);
      setMessage(error.message);
    } finally {
      setMatchingLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Transfusion Requests</h1>
        <p>Manage and monitor clinical requests for blood units.</p>
      </div>

      {message && (
        <div className="message-box">
          {message}
        </div>
      )}

      <div className="actions-bar">
        {/* Only Admin can run the matching algorithm */}
        {user?.role === "admin" && (
          <button 
            type="button"
            className="btn btn-primary btn-oracle-match" 
            onClick={handleRunMatching}
            disabled={matchingLoading}
          >
            {matchingLoading ? "Processing in Oracle..." : "Run Auto-Matching Algorithm"}
          </button>
        )}
      </div>

      <div className="table-container">
        {loading ? (
          <p>Loading requests...</p>
        ) : (
          <table className="requests-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Date</th>
                <th>Facility</th>
                <th>Patient</th>
                <th>Blood Type ID</th>
                <th>Units</th>
                <th>Urgency</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req.request_id}>
                  <td>#{req.request_id}</td>
                  <td>{new Date(req.request_date).toLocaleDateString()}</td>
                  <td>{req.requesting_facility_id}</td>
                  <td>{req.patient_id}</td>
                  <td>{req.blood_type_id}</td>
                  <td>{req.units_requested}</td>
                  <td>
                    <span className={`urgency-badge ${req.urgency_level === 'Critical' ? 'urgency-critical' : 'urgency-normal'}`}>
                      {req.urgency_level}
                    </span>
                  </td>
                  <td>{req.status}</td>
                </tr>
              ))}
              {requests.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center">No requests found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}