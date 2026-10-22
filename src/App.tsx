// ─────────────────────────────────────────────
// App.tsx — Root Router with Admin Authentication Guard
// ─────────────────────────────────────────────

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LeaderboardPage from './pages/LeaderboardPage';
import AdminLayout from './pages/admin/AdminLayout';
import AdminLogin from './components/admin/AdminLogin';
import AdminRoute from './components/auth/AdminRoute';
import DashboardPage from './pages/admin/DashboardPage';
import ParticipantsPage from './pages/admin/ParticipantsPage';
import RepositoriesPage from './pages/admin/RepositoriesPage';
import PullRequestsPage from './pages/admin/PullRequestsPage';
import AdminLeaderboardPage from './pages/admin/AdminLeaderboardPage';
import TeamsPage from './pages/admin/TeamsPage';
import ScoreEventsPage from './pages/admin/ScoreEventsPage';
import WebhookEventsPage from './pages/admin/WebhookEventsPage';
import SettingsPage from './pages/admin/SettingsPage';
import { AuthProvider } from './context/AuthContext';
import { autoSyncService } from './services/autoSyncService';

export default function App() {
  useEffect(() => {
    // Automatically poll GitHub every 10 seconds for real-time PR sync & auto-merges
    autoSyncService.start(10);
    return () => autoSyncService.stop();
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public leaderboard — Unauthenticated access */}
          <Route path="/" element={<LeaderboardPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />

          {/* Admin Login Gate */}
          <Route path="/admin/login" element={<AdminLogin />} />

          {/* Protected Admin Command Center */}
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            }
          >
            {/* /admin -> Dashboard */}
            <Route index element={<DashboardPage />} />

            {/* /admin/teams — Squad & Issue Assignment Portal */}
            <Route path="teams" element={<TeamsPage />} />

            {/* /admin/participants */}
            <Route path="participants" element={<ParticipantsPage />} />

            {/* /admin/repositories */}
            <Route path="repositories" element={<RepositoriesPage />} />

            {/* /admin/pull-requests */}
            <Route path="pull-requests" element={<PullRequestsPage />} />

            {/* /admin/leaderboard */}
            <Route path="leaderboard" element={<AdminLeaderboardPage />} />

            {/* /admin/score-events */}
            <Route path="score-events" element={<ScoreEventsPage />} />

            {/* /admin/webhook-events */}
            <Route path="webhook-events" element={<WebhookEventsPage />} />

            {/* /admin/settings */}
            <Route path="settings" element={<SettingsPage />} />

            {/* Fallback under /admin */}
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>

          {/* Global Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
