import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { TablePagination } from "../components/TablePagination";

interface DispatchRecord {
  dispatch_id: number;
  request_id: number;
  unit_id: number;
  dispatch_status: string;
  dispatch_time: string;
  urgency: string;
  destination_facility: string;
}

interface MapPoint {
  facility_id: number;
  facility_name: string;
  facility_type: string;
  city_name: string;
  latitude: number;
  longitude: number;
  active_requests: number;
  active_dispatches: number;
}

// ── Raw-Leaflet map (no react-leaflet) ──────────────────────────────────────
function FacilityMap({ points }: { points: MapPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView([48.0, 66.9], 5);
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    points.forEach((p) => {
      const color =
        p.active_dispatches > 0 ? "#2563eb" :
        p.active_requests   > 0 ? "#d97706" : "#94a3b8";
      const radius = Math.max(6, Math.min(18, 6 + (p.active_requests + p.active_dispatches) * 1.5));

      L.circleMarker([p.latitude, p.longitude], {
        radius,
        color,
        fillColor: color,
        fillOpacity: 0.75,
        weight: 1.5,
      })
        .bindTooltip(
          `<div style="min-width:160px;font-size:12px;line-height:1.7">
            <strong style="font-size:13px">${p.facility_name}</strong><br/>
            <span style="color:#64748b">${p.facility_type} · ${p.city_name}</span>
            <hr style="margin:4px 0;border:none;border-top:1px solid #e2e8f0"/>
            🔴 Pending requests: <strong>${p.active_requests}</strong><br/>
            🚚 Active dispatches: <strong>${p.active_dispatches}</strong>
          </div>`,
          { direction: "top" }
        )
        .addTo(map);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [points]);

  return (
    <div
      ref={containerRef}
      style={{ height: "460px", width: "100%", borderRadius: "10px", overflow: "hidden" }}
    />
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
export function DispatchesPage() {
  const [dispatches, setDispatches] = useState<DispatchRecord[]>([]);
  const [mapPoints,  setMapPoints]  = useState<MapPoint[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [mapLoading, setMapLoading] = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const token   = localStorage.getItem("bn_access_token");
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetch("/api/dispatches/", { headers })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setDispatches)
      .catch(() => setError("Error loading logistics data."))
      .finally(() => setLoading(false));

    fetch("/api/dispatches/map-points", { headers })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setMapPoints)
      .catch(() => {})
      .finally(() => setMapLoading(false));
  }, []);

  if (loading) return <div className="page-container">Loading logistics map...</div>;
  if (error)   return <div className="page-container message-box">{error}</div>;

  const visibleDispatches = dispatches.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Dispatch & Logistics</h1>
        <p>Monitor blood units in transit across the network.</p>
      </div>

      {/* ── Table ── */}
      <div className="dashboard-card" style={{ marginTop: "20px" }}>
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
              visibleDispatches.map((d) => (
                <tr key={d.dispatch_id}>
                  <td><strong>#{d.dispatch_id}</strong></td>
                  <td>{d.destination_facility || "Unknown"}</td>
                  <td>{d.unit_id}</td>
                  <td>
                    <span style={{
                      color: d.urgency === "Critical" ? "red" : "inherit",
                      fontWeight: d.urgency === "Critical" ? "bold" : "normal",
                    }}>
                      {d.urgency}
                    </span>
                  </td>
                  <td>{d.dispatch_time || "Pending"}</td>
                  <td>
                    <span className="stat-item" style={{
                      padding: "4px 8px", borderLeft: "none",
                      background: "#e9ecef", borderRadius: "4px",
                    }}>
                      {d.dispatch_status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <TablePagination
          page={page}
          pageSize={pageSize}
          total={dispatches.length}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        />
      </div>

      {/* ── Map ── */}
      <div className="dashboard-card" style={{ marginTop: "28px", padding: "20px" }}>
        <div style={{ marginBottom: "14px" }}>
          <h3 style={{ margin: "0 0 4px" }}>Facility Network Map</h3>
          <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
            Each dot is a facility — size and colour reflect current activity.
          </p>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", marginBottom: "14px", fontSize: "12px" }}>
          {[
            { color: "#2563eb", label: "Active dispatches (In Transit / Queued)" },
            { color: "#d97706", label: "Pending requests only" },
            { color: "#94a3b8", label: "No current activity" },
          ].map(({ color, label }) => (
            <div key={color} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: color, flexShrink: 0 }} />
              <span style={{ color: "#475569" }}>{label}</span>
            </div>
          ))}
        </div>

        {mapLoading ? (
          <div style={{
            height: "460px", display: "flex", alignItems: "center",
            justifyContent: "center", background: "#f8fafc",
            borderRadius: "10px", color: "#94a3b8",
          }}>
            Loading map data...
          </div>
        ) : (
          <div style={{ border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden" }}>
            <FacilityMap points={mapPoints} />
          </div>
        )}
      </div>
    </div>
  );
}
