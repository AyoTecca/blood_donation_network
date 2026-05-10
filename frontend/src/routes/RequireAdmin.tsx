import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { ready, user } = useAuth();

  if (!ready) {
    return (
      <div className="page-loading">
        <p>Loading…</p>
      </div>
    );
  }
  if (user?.role !== "admin") {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
