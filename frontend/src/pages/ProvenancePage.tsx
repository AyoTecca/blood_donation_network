import { useState } from "react";
import { apiFetch } from '../api'; 
import '../style.css';

export function ProvenancePage() {
  const [unitId, setUnitId] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleTrace = () => {
    if (!unitId) return;
    setLoading(true);
    setError("");
    
    apiFetch(`/api/provenance/${unitId}`)
      .then((res: any) => {
        if (res.detail) {
          // Captures "Blood unit not found" from FastAPI or 422 errors
          setError(res.detail); 
          setData(null);
        } else {
          setData(res);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Fetch failed:", err);
        setError("Error fetching provenance data. Please check the ID.");
        setLoading(false);
      });
  };

  return (
    <div className="page-container">
      <h1>Donation Provenance 📦</h1>
      <p style={{ color: '#64748b' }}>
        Provenance audit: tracing the blood unit path back to the donor.
      </p>

      <div className="dashboard-card" style={{ marginTop: '20px', padding: '30px', textAlign: 'center' }}>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '20px' }}>
          <input 
            type="number" 
            placeholder="Enter Unit ID (e.g., 1)" 
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            style={{ padding: '10px', width: '250px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
          />
          <button onClick={handleTrace} disabled={loading}>
            {loading ? "Searching..." : "Trace Unit"}
          </button>
        </div>

        {error && <div style={{ color: '#dc2626', marginBottom: '15px' }}>{error}</div>}

        {data && (
          <div style={{ textAlign: 'left', border: '1px solid #e2e8f0', padding: '20px', borderRadius: '12px', background: '#f8fafc' }}>
            <h3 style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginTop: 0 }}>
              Audit Results for Unit #{data.unit_id}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '15px' }}>
              <div><strong>Blood Type:</strong> <span style={{ color: '#dc2626' }}>{data.blood_type}</span></div>
              <div><strong>Status:</strong> <span className="status-badge new">{data.unit_status}</span></div>
              <div><strong>Donor:</strong> {data.donor_name} (ID: {data.donor_id})</div>
              <div><strong>Donation Date:</strong> {data.donation_date}</div>
              <div><strong>Expiry Date:</strong> {data.expiry_date}</div>
              <div><strong>Donation ID:</strong> {data.donation_id}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}