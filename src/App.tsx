import { useMemo, useState, type ReactNode } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  Check,
  CircleHelp,
  Compass,
  LayoutDashboard,
  ListChecks,
  Moon,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  Zap,
} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Tickets from './pages/Tickets';
import TicketDetail from './pages/TicketDetail';
import NewTicket from './pages/NewTicket';
import Customers from './pages/Customers';
import Analytics from './pages/Analytics';
import { DEFAULT_PREFERENCES, loadPreferences, savePreferences } from './services/preferences';
import { storage } from './services/storage';
import type { UserPreferences } from './types';

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/tickets', label: 'Tickets', icon: ListChecks },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/analytics', label: 'Intelligence', icon: BarChart3 },
];

function AppShell() {
  const location = useLocation();
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [prefs, setPrefs] = useState<UserPreferences>(loadPreferences);
  const active = useMemo(
    () => nav.find((n) => location.pathname === n.to || (n.to !== '/' && location.pathname.startsWith(n.to))),
    [location.pathname],
  );

  const updatePrefs = async (patch: Partial<UserPreferences>) => {
    const next = { ...prefs, ...patch };

    if (patch.desktopNotifications && 'Notification' in window) {
      if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }
      if (Notification.permission === 'denied') {
        return;
      }
    }

    setPrefs(next);
    savePreferences(next);
  };

  const resetWorkspace = () => {
    storage.reset();
    savePreferences(DEFAULT_PREFERENCES);
    setPrefs(DEFAULT_PREFERENCES);
  };

  return (
    <div className={`app-shell ${prefs.compactMode ? 'compact-mode' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo-wrap">
            <img src="/brand-logo-transparent.png" alt="Support Intelligence" className="brand-logo" />
          </div>
          <div>
            <div className="brand-title">Support Intelligence</div>
            <div className="brand-sub">Datastraw CRM</div>
          </div>
        </div>

        <nav className="primary-nav">
          {nav.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} className={`nav-item ${active?.to === to ? 'active' : ''}`}>
              <Icon size={18} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => setHelpOpen(true)}>
            <CircleHelp size={18} />
            <span>Help</span>
          </button>
          <button className="nav-item" onClick={() => setSettingsOpen(true)}>
            <Settings size={18} />
            <span>Settings</span>
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <div className="eyebrow">SUPPORT OPERATIONS</div>
            <h1>{active?.label ?? 'Support'}</h1>
          </div>

          <div className="topbar-actions">
            <button className="guide-btn" onClick={() => setHelpOpen(true)}>
              <Compass size={16} />
              Guide
            </button>
            <Link to="/tickets/new" className="primary-btn">
              <Plus size={18} />
              New Ticket
            </Link>
          </div>
        </header>

        <div className="page">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/tickets" element={<Tickets />} />
            <Route path="/tickets/new" element={<NewTicket />} />
            <Route path="/tickets/:ticketId" element={<TicketDetail />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>

      {helpOpen && (
        <div className="modal-backdrop" onClick={() => setHelpOpen(false)}>
          <div className="modal help-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="eyebrow">QUICK GUIDE</div>
                <div className="modal-title">Work the case, not the software</div>
                <p className="muted">Four simple steps cover most support work.</p>
              </div>
              <button className="icon-btn" onClick={() => setHelpOpen(false)} aria-label="Close guide">
                <X size={16} />
              </button>
            </div>

            <div className="guide-flow">
              <div className="guide-step">
                <div className="guide-number">1</div>
                <div><strong>Find or create</strong><span>Search for a case or add a new customer request.</span></div>
              </div>
              <div className="guide-connector" />
              <div className="guide-step">
                <div className="guide-number">2</div>
                <div><strong>Understand</strong><span>Read the short AI decision brief and customer impact.</span></div>
              </div>
              <div className="guide-connector" />
              <div className="guide-step">
                <div className="guide-number">3</div>
                <div><strong>Act</strong><span>Use the recommended next step or choose another action.</span></div>
              </div>
              <div className="guide-connector" />
              <div className="guide-step">
                <div className="guide-number">4</div>
                <div><strong>Record</strong><span>Add a note so the next person can continue without guessing.</span></div>
              </div>
            </div>

            <div className="human-control guide-trust">
              <ShieldCheck size={16} />
              <span><strong>AI stays advisory.</strong> Recommendations are visible, explainable and reviewable before action.</span>
            </div>

            <button className="primary-btn full-width" onClick={() => setHelpOpen(false)}>
              <Check size={16} />
              Got it
            </button>
          </div>
        </div>
      )}

      {settingsOpen && (
        <SettingsModal
          prefs={prefs}
          updatePrefs={updatePrefs}
          onClose={() => setSettingsOpen(false)}
          onReset={resetWorkspace}
        />
      )}
    </div>
  );
}

function SettingsModal({
  prefs,
  updatePrefs,
  onClose,
  onReset,
}: {
  prefs: UserPreferences;
  updatePrefs: (patch: Partial<UserPreferences>) => void | Promise<void>;
  onClose: () => void;
  onReset: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal settings-modal" onClick={(event) => event.stopPropagation()}>
        <div className="settings-hero">
          <div>
            <div className="eyebrow">WORKSPACE CONTROLS</div>
            <div className="modal-title">Settings</div>
            <p>Choose how much help the workspace gives you. Changes are saved automatically.</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close settings">
            <X size={16} />
          </button>
        </div>

        <div className="settings-status">
          <span><Zap size={14} /> Assistance profile</span>
          <strong>{prefs.autoAnalyze ? 'Active' : 'On demand'}</strong>
        </div>

        <div className="settings-section">
          <div className="settings-section-title">ASSISTANCE</div>
          <SettingRow
            icon={<Sparkles size={17} />}
            title="Automatic AI analysis"
            description="Prepare the case brief as soon as a ticket is created."
            value={prefs.autoAnalyze}
            onChange={() => updatePrefs({ autoAnalyze: !prefs.autoAnalyze })}
          />
          <SettingRow
            icon={<ShieldCheck size={17} />}
            title="Show AI reasoning"
            description="Keep the evidence and logic behind a recommendation visible."
            value={prefs.showAIExplanations}
            onChange={() => updatePrefs({ showAIExplanations: !prefs.showAIExplanations })}
          />
        </div>

        <div className="settings-section">
          <div className="settings-section-title">WORKSPACE</div>
          <SettingRow
            icon={<Moon size={17} />}
            title="Compact workspace"
            description="Tighten spacing when you want more operational information on screen."
            value={prefs.compactMode}
            onChange={() => updatePrefs({ compactMode: !prefs.compactMode })}
          />
          <SettingRow
            icon={<Bell size={17} />}
            title="Desktop notifications"
            description="Allow browser alerts when a high-priority case needs attention."
            value={prefs.desktopNotifications}
            onChange={() => updatePrefs({ desktopNotifications: !prefs.desktopNotifications })}
          />
        </div>

        <div className="settings-footer">
          <button className="text-btn danger" onClick={onReset}>Reset demo data</button>
          <button className="primary-btn" onClick={onClose}>
            <Check size={16} />
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingRow({
  icon,
  title,
  description,
  value,
  onChange,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  value: boolean;
  onChange: () => void | Promise<void>;
}) {
  return (
    <div className={`setting-row ${value ? 'enabled' : ''}`}>
      <div className="setting-icon">{icon}</div>
      <div className="setting-copy">
        <div className="setting-title-line">
          <strong>{title}</strong>
          <span className={`setting-state ${value ? 'on' : ''}`}>{value ? 'ON' : 'OFF'}</span>
        </div>
        <span>{description}</span>
      </div>
      <button className={`toggle ${value ? 'on' : ''}`} onClick={onChange} aria-pressed={value}>
        <span />
      </button>
    </div>
  );
}

export default function App() {
  return <AppShell />;
}
