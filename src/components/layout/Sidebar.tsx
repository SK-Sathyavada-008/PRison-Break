// ─────────────────────────────────────────────
// Sidebar — Clean Admin Navigation Sidebar with Real Routes
// ─────────────────────────────────────────────

import {
  LayoutDashboard,
  Users,
  Folder,
  GitPullRequest,
  Trophy,
  Zap,
  Radio,
  Settings,
  Shield,
  X,
  ExternalLink,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const NAV_ITEMS = [
  { path: '/admin',              exact: true,  label: 'Dashboard',     icon: LayoutDashboard },
  { path: '/admin/participants', exact: false, label: 'Participants',   icon: Users },
  { path: '/admin/repositories', exact: false, label: 'Repositories',   icon: Folder },
  { path: '/admin/pull-requests',exact: false, label: 'Pull Requests',  icon: GitPullRequest },
  { path: '/admin/leaderboard',  exact: false, label: 'Leaderboard',    icon: Trophy },
  { path: '/admin/score-events', exact: false, label: 'Score Events',   icon: Zap },
  { path: '/admin/webhook-events', exact: false, label: 'Webhook Events', icon: Radio },
  { path: '/admin/settings',     exact: false, label: 'Settings',       icon: Settings },
];

export default function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const location = useLocation();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && onClose && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`sidebar z-50 ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#FF0A3B]/10 border border-[#FF0A3B]/30 flex items-center justify-center text-[#FF1E46]">
                <Shield size={18} />
              </div>
              <div>
                <div className="text-sm font-bold text-white tracking-tight font-mono">PRison Control</div>
                <div className="text-[11px] text-slate-400 font-medium font-mono">Warden Portal</div>
              </div>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="md:hidden text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto font-mono text-xs">
          <div className="px-3 py-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Menu
          </div>

          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact
              ? location.pathname === item.path || location.pathname === `${item.path}/`
              : location.pathname.startsWith(item.path);

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={`sidebar-item w-full ${isActive ? 'active text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                <Icon size={16} className={isActive ? 'text-[#FF5470]' : 'text-slate-500'} />
                <span className="flex-1 text-left">{item.label}</span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF0A3B] shadow-[0_0_8px_#FF0A3B]" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer Quick Links */}
        <div className="p-4 border-t border-slate-800 space-y-2 font-mono">
          <Link
            to="/"
            className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-medium transition-colors"
          >
            <span>Public Leaderboard</span>
            <ExternalLink size={12} />
          </Link>
          <div className="text-center text-[10px] text-slate-500">
            PRison Break &mdash; Sector NØLL
          </div>
        </div>
      </aside>
    </>
  );
}
