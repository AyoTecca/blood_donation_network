import {  NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <h2 className="sidebar-title">Blood Donation</h2>
        <p className="sidebar-sub">Compatibility Network</p>
      </div>
      <nav className="sidebar-nav">
        <NavLink to="/" end className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
          Home
        </NavLink>
        <NavLink to="/audit" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
          Audit Log
        </NavLink>
        <NavLink to="/requests" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
          Requests
        </NavLink>
        <NavLink to="/dashboard" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
          Dashboard
        </NavLink>
        <NavLink to="/dispatches" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
          Logistics
        </NavLink>
        <NavLink to="/compatibility" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
          Compatibility
        </NavLink>
        {user?.role === "admin" && (
          <NavLink
            to="/admin"
            className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
          >
            Admin
          </NavLink>
        )}
      </nav>
      <div className="sidebar-footer">
        {user && (
          <p className="sidebar-user">
            {user.email}
            <span className="role-badge">{user.role}</span>
          </p>
        )}
        <button type="button" className="btn btn-secondary" onClick={logout}>
          Sign out
        </button>
      </div>
    </aside>
  );
}
