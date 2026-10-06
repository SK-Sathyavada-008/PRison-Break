// ─────────────────────────────────────────────
// Admin Layout — Shell with Sidebar, TopBar, and Outlet
// ─────────────────────────────────────────────

import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../../components/layout/Sidebar';
import TopBar from '../../components/layout/TopBar';

const PATH_METADATA: Record<string, { title: string; breadcrumb?: string }> = {
  '/admin':               { title: 'Command Center' },
  '/admin/participants':   { title: 'Prisoner Roster', breadcrumb: 'Admin' },
  '/admin/repositories':  { title: 'Cell Repositories', breadcrumb: 'Admin' },
  '/admin/pull-requests': { title: 'Escape Pull Requests', breadcrumb: 'Admin' },
  '/admin/leaderboard':   { title: 'Leaderboard Audit', breadcrumb: 'Admin' },
  '/admin/score-events':  { title: 'Telemetry & XP Events', breadcrumb: 'Admin' },
  '/admin/webhook-events':{ title: 'GitHub Webhook Telemetry', breadcrumb: 'Admin' },
  '/admin/settings':      { title: 'System Settings', breadcrumb: 'Admin' },
};

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const currentPath = location.pathname.replace(/\/$/, '') || '/admin';
  const meta = PATH_METADATA[currentPath] || { title: 'Warden Portal', breadcrumb: 'Admin' };

  return (
    <div className="min-h-screen bg-[#030712]">
      {/* Fixed sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main area — offset by sidebar width on md+ */}
      <div className="md:ml-[240px] flex flex-col min-h-screen">
        {/* Topbar */}
        <TopBar
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          title={meta.title}
          breadcrumb={meta.breadcrumb}
        />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
