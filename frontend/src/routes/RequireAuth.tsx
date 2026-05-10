import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function RequireAuth() {
  const { ready, token } = useAuth();

  if (!ready) {
    return (
      <div className="page-loading">
        <p>Loading…</p>
      </div>
    );
  }
  if (!token) {
    return <Navigate to="/auth" replace />;
  }
  return <Outlet />;
}
