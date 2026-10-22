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
    <div className="h-screen w-screen bg-[#030408] text-slate-100 p-2 sm:p-4 lg:p-6 flex flex-col overflow-hidden">
      {/* Framed Application Container — Inset from all screen edges */}
      <div className="flex-1 min-h-0 w-full rounded-2xl lg:rounded-3xl border border-slate-800/90 bg-[#070913] flex overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] relative">
        {/* Sidebar: desktop static flex column, mobile slide-in drawer */}
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main content column: takes remaining width with independent scrolling */}
        <div className="flex-1 min-w-0 flex flex-col h-full overflow-y-auto bg-[#070913]">
          {/* Sticky TopBar */}
          <TopBar
            onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
            title={meta.title}
            breadcrumb={meta.breadcrumb}
          />

          {/* Page content with generous breathing room and max-width scaling */}
          <main className="flex-1 w-full px-6 sm:px-10 lg:px-12 py-8 sm:py-10 pb-36">
            <div className="w-full max-w-[1480px] mx-auto">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
