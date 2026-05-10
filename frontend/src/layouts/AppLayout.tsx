import { Outlet } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";

export function AppLayout() {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
