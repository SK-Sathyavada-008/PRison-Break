// ─────────────────────────────────────────────
// Admin Settings Page — Connected to Firestore
// ─────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { Sliders, Flag, Database, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { eventConfigService } from '../../services/eventConfigService';
import { seedService } from '../../services/seedService';
import { isFirebaseConfigured } from '../../config/firebase';
import type { FirestoreEventConfig } from '../../types';

interface SettingsSectionProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function SettingsSection({ title, description, icon, children }: SettingsSectionProps) {
  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-800/60 border border-slate-700/40 flex items-center justify-center text-slate-400">
            {icon}
          </div>
          <div>
            <div className="font-mono text-sm font-semibold text-slate-300">{title}</div>
            <div className="font-mono text-[11px] text-slate-600 mt-0.5">{description}</div>
          </div>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const isFirebaseReady = isFirebaseConfigured();
  const [config, setConfig] = useState<FirestoreEventConfig>({
    eventName: 'PRison Break',
    tagline: 'Escape the Code. Earn the Merge.',
    status: 'ongoing',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [seedResult, setSeedResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    const unsub = eventConfigService.subscribeToEventConfig((data) => {
      if (data) setConfig(data);
    });

    return () => unsub();
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await eventConfigService.updateEventConfig(config);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('[SettingsPage] Error saving config:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSeedData = async () => {
    try {
      setSeeding(true);
      setSeedResult(null);
      const res = await seedService.seedAll();
      setSeedResult(res);
    } catch (err: any) {
      setSeedResult({ success: false, message: err?.message || 'Seeding failed' });
    } finally {
      setSeeding(false);
    }
  };

  const handleClearData = async () => {
    if (!window.confirm('Are you sure you want to completely purge all participants, repositories, PRs, and score events from Firestore?')) {
      return;
    }
    try {
      setClearing(true);
      setSeedResult(null);
      const res = await seedService.clearAll();
      setSeedResult(res);
    } catch (err: any) {
      setSeedResult({ success: false, message: err?.message || 'Purge failed' });
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-100 tracking-wide mb-1">Settings</h1>
          <p className="font-mono text-xs text-slate-500">Event configuration and system preferences</p>
        </div>
      </div>

      {/* Database Status Card */}
      <div className={`rounded-lg border p-5 flex items-start justify-between flex-wrap gap-4 ${
        isFirebaseReady
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : 'border-amber-500/30 bg-amber-500/5'
      }`}>
        <div className="flex items-center gap-3">
          <Database size={20} className={isFirebaseReady ? 'text-emerald-400' : 'text-amber-400'} />
          <div>
            <div className="font-mono text-xs font-semibold text-slate-200">
              Firebase Firestore: {isFirebaseReady ? 'CONNECTED' : 'LOCAL DEV FALLBACK'}
            </div>
            <p className="font-mono text-[11px] text-slate-500 mt-0.5">
              {isFirebaseReady
                ? 'Primary database connected via environment variables.'
                : 'Credentials not detected in .env file. Running in local fallback mode.'}
            </p>
          </div>
        </div>

        {isFirebaseReady && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleClearData}
              disabled={clearing || seeding}
              className="btn bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-800/60 text-xs flex items-center gap-1.5"
            >
              <RefreshCw size={12} className={clearing ? 'animate-spin' : ''} />
              {clearing ? 'Purging Firestore...' : 'Purge All Data'}
            </button>
            <button
              onClick={handleSeedData}
              disabled={seeding || clearing}
              className="btn btn-secondary text-xs flex items-center gap-1.5"
            >
              <RefreshCw size={12} className={seeding ? 'animate-spin' : ''} />
              {seeding ? 'Populating Firestore...' : 'Seed Sample Data to Firestore'}
            </button>
          </div>
        )}
      </div>

      {seedResult && (
        <div className={`p-3 rounded-lg border text-xs font-mono flex items-center gap-2 ${
          seedResult.success
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
            : 'border-red-500/30 bg-red-500/10 text-red-400'
        }`}>
          {seedResult.success ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
          <span>{seedResult.message}</span>
        </div>
      )}

      {/* Event Configuration (Connected to Firestore) */}
      <SettingsSection
        title="Event Information (Firestore Collection: eventConfig)"
        description="Configuration synced across public leaderboard and admin screens"
        icon={<Flag size={14} />}
      >
        <form onSubmit={handleSaveConfig} className="space-y-4">
          <div>
            <label className="block font-mono text-[10px] text-slate-400 uppercase tracking-widest mb-1.5">
              Event Name
            </label>
            <input
              type="text"
              value={config.eventName}
              onChange={(e) => setConfig({ ...config, eventName: e.target.value })}
              className="input font-mono text-xs"
              required
            />
          </div>

          <div>
            <label className="block font-mono text-[10px] text-slate-400 uppercase tracking-widest mb-1.5">
              Event Tagline
            </label>
            <input
              type="text"
              value={config.tagline}
              onChange={(e) => setConfig({ ...config, tagline: e.target.value })}
              className="input font-mono text-xs"
              required
            />
          </div>

          <div>
            <label className="block font-mono text-[10px] text-slate-400 uppercase tracking-widest mb-1.5">
              Event Status
            </label>
            <select
              value={config.status}
              onChange={(e) => setConfig({ ...config, status: e.target.value })}
              className="input font-mono text-xs"
            >
              <option value="ongoing">Ongoing (Live)</option>
              <option value="upcoming">Upcoming</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary text-xs"
            >
              {saving ? 'Saving to Firestore...' : 'Save Configuration'}
            </button>
            {saveSuccess && (
              <span className="font-mono text-xs text-emerald-400 flex items-center gap-1.5">
                <CheckCircle size={13} /> Saved to Firestore!
              </span>
            )}
          </div>
        </form>
      </SettingsSection>

      {/* Scoring Rules Display */}
      <SettingsSection
        title="Scoring Configuration"
        description="XP point values for event actions"
        icon={<Sliders size={14} />}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
          {[
            { label: 'PR Merged (Escape Step)', value: '100–200 XP' },
            { label: 'PR Opened (Attempt)', value: '10 XP' },
            { label: 'Code Review Passed', value: '50 XP' },
            { label: 'Issue Cleared', value: '25 XP' },
            { label: 'First Escape Cell Bonus', value: '200 XP' },
            { label: 'Speed Bonus', value: '50 XP' },
          ].map((item) => (
            <div key={item.label} className="p-3 rounded-lg border border-slate-800 bg-slate-900/40 flex justify-between items-center">
              <span className="text-slate-400">{item.label}</span>
              <span className="text-emerald-400 font-bold">{item.value}</span>
            </div>
          ))}
        </div>
      </SettingsSection>
    </div>
  );
}
