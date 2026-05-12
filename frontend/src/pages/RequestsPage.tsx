import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";

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

  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    patient_id: "",
    units_requested: "1", 
    urgency_level: "2" 
  });

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

  const handleRunMatching = async () => {
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
      
      setMessage("✅ " + result.message);
      await fetchRequests();
    } catch (error: any) {
      console.error("Error running match:", error);
      setMessage("❌ " + error.message);
    } finally {
      setMatchingLoading(false);
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const token = localStorage.getItem("bn_access_token");
      const response = await fetch("http://127.0.0.1:8000/api/requests/", {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          patient_id: Number(formData.patient_id),
          units_requested: Number(formData.units_requested),
          urgency_level: Number(formData.urgency_level)
        })
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.detail || "Failed to create request");

      setMessage("✅ " + result.message);
      setShowAddForm(false); 
      setFormData({ patient_id: "", units_requested: "", urgency_level: "2" }); 
      await fetchRequests(); 
    } catch (error: any) {
      console.error("Error creating request:", error);
      setMessage("❌ " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Transfusion Requests</h1>
          <p>Manage and monitor clinical requests for blood units.</p>
        </div>
        
       
        {user?.role === "admin" && (
          <button 
            className="btn btn-primary"
            onClick={() => setShowAddForm(!showAddForm)}
            style={{ padding: '10px 20px', cursor: 'pointer', borderRadius: '8px' }}
          >
            {showAddForm ? "Cancel" : "+ New Request"}
          </button>
        )}
      </div>

      {message && (
        <div className="message-box" style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px' }}>
          {message}
        </div>
      )}

      
      {user?.role === "admin" && showAddForm && (
        <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '30px' }}>
          <h3 style={{ marginTop: 0 }}>Create Blood Request</h3>
          <form onSubmit={handleCreateRequest} style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label htmlFor="patient_id">Patient ID</label>
              <input 
                id="patient_id"
                type="number" 
                required 
                value={formData.patient_id}
                onChange={(e) => setFormData({...formData, patient_id: e.target.value})}
                style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label htmlFor="units">Units Needed</label>
              <input 
                id="units"
                type="number" 
                min="1"
                required 
                value={formData.units_requested}
                onChange={(e) => setFormData({...formData, units_requested: e.target.value})}
                style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label htmlFor="urgency">Urgency</label>
              <select 
                id="urgency"
                value={formData.urgency_level}
                onChange={(e) => setFormData({...formData, urgency_level: e.target.value})}
                style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              >
                <option value="1">1 - Critical</option>
                <option value="2">2 - Urgent</option>
                <option value="3">3 - Moderate</option>
                <option value="4">4 - Routine</option>
                <option value="5">5 - Low</option>
              </select>
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting}
              style={{ padding: '10px 20px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', height: '40px' }}
            >
              {isSubmitting ? "Saving..." : "Submit Request"}
            </button>
          </form>
        </div>
      )}

      <div className="actions-bar" style={{ marginBottom: '20px' }}>
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