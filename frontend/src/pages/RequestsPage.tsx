import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { TablePagination } from "../components/TablePagination";

interface TransfusionRequest {
  request_id: number;
  patient_id: number;
  patient_name: string;
  blood_type: string;
  facility_name: string;
  requesting_facility_id: number;
  units_requested: number;
  status: string;
  urgency_level: string;
  request_date: string;
}

interface Patient {
  patient_id: number;
  full_name: string;
  blood_type: string;
  facility_name: string;
}

export function RequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<TransfusionRequest[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchingLoading, setMatchingLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    patient_id: "",
    units_requested: "1",
    urgency_level: "2"
  });

  const getAuthHeaders = () => ({
    "Authorization": `Bearer ${localStorage.getItem("bn_access_token")}`,
    "Content-Type": "application/json"
  });

  const fetchRequests = async () => {
    try {
      const response = await fetch("/api/requests/", { headers: getAuthHeaders() });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || `Server error: ${response.status}`);
      }
      setRequests(await response.json());
    } catch (error: any) {
      setMessage(error.message || "Error loading requests.");
    } finally {
      setLoading(false);
    }
  };

  const [patientsError, setPatientsError] = useState<string | null>(null);

  const fetchPatients = async () => {
    try {
      const response = await fetch("/api/requests/patients", { headers: getAuthHeaders() });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${response.status}`);
      }
      setPatients(await response.json());
    } catch (error: any) {
      console.error("Patients load failed:", error);
      setPatientsError(error.message || "Failed to load patients");
    }
  };

  useEffect(() => {
    fetchRequests();
    fetchPatients();
  }, []);

  const handleRunMatching = async () => {
    setMatchingLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/requests/run-matching", {
        method: "POST",
        headers: getAuthHeaders()
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || "Matching failed");
      setMessage("✅ " + result.message);
      await fetchRequests();
    } catch (error: any) {
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
      const response = await fetch("/api/requests/", {
        method: "POST",
        headers: getAuthHeaders(),
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
      setFormData({ patient_id: "", units_requested: "1", urgency_level: "2" });
      await fetchRequests();
    } catch (error: any) {
      setMessage("❌ " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedPatient = patients.find(p => String(p.patient_id) === formData.patient_id);

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Transfusion Requests</h1>
          <p>Manage and monitor clinical requests for blood units.</p>
        </div>
        {user?.role === "admin" && (
          <button
            type="button"
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
          <form onSubmit={handleCreateRequest}>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: '220px' }}>
                <label htmlFor="patient_id">Patient</label>
                <select
                  id="patient_id"
                  required
                  value={formData.patient_id}
                  onChange={(e) => setFormData({ ...formData, patient_id: e.target.value })}
                  style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', height: '42px' }}
                >
                  <option value="">— Select patient —</option>
                  {patients.map(p => (
                    <option key={p.patient_id} value={p.patient_id}>
                      {p.full_name} ({p.blood_type})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label htmlFor="units">Units Needed</label>
                <input
                  id="units"
                  type="number"
                  min="1"
                  required
                  value={formData.units_requested}
                  onChange={(e) => setFormData({ ...formData, units_requested: e.target.value })}
                  style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', width: '100px', height: '42px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label htmlFor="urgency">Urgency</label>
                <select
                  id="urgency"
                  value={formData.urgency_level}
                  onChange={(e) => setFormData({ ...formData, urgency_level: e.target.value })}
                  style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', height: '42px' }}
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
                style={{ padding: '10px 20px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', height: '42px', alignSelf: 'flex-end' }}
              >
                {isSubmitting ? "Saving..." : "Submit Request"}
              </button>

            </div>

            {selectedPatient && (
              <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#64748b' }}>
                Facility: <strong>{selectedPatient.facility_name}</strong> · Blood type: <strong>{selectedPatient.blood_type}</strong>
              </p>
            )}
            {patientsError && (
              <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#dc2626' }}>
                Could not load patients: {patientsError}
              </p>
            )}
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
          <>
            <table className="requests-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Date</th>
                  <th>Patient</th>
                  <th>Blood Type</th>
                  <th>Facility</th>
                  <th>Units</th>
                  <th>Urgency</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {requests.slice((page - 1) * pageSize, page * pageSize).map((req) => (
                  <tr key={req.request_id}>
                    <td>#{req.request_id}</td>
                    <td>{new Date(req.request_date).toLocaleDateString()}</td>
                    <td>{req.patient_name}</td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#b91c1c' }}>{req.blood_type}</span>
                    </td>
                    <td>{req.facility_name}</td>
                    <td>{req.units_requested}</td>
                    <td>
                      <span className={`urgency-badge ${req.urgency_level.startsWith('1') ? 'urgency-critical' : 'urgency-normal'}`}>
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
            <TablePagination
              page={page}
              pageSize={pageSize}
              total={requests.length}
              onPageChange={setPage}
              onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
            />
          </>
        )}
      </div>
    </div>
  );
}
