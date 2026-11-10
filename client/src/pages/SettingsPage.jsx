import { useEffect, useState } from "react";
import { Button } from "../components/ui/button.jsx";
import {
  FiBarChart2, FiCheck, FiCheckSquare, FiChevronDown, FiLogOut, FiMoon,
  FiRotateCcw, FiSave, FiSettings, FiShield, FiSliders, FiSun, FiX
} from "react-icons/fi";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog.jsx";
import AppLayout from "../components/AppLayout.jsx";
import { api } from "../api.js";
import {
  adminMetricsKey, adminMetricValues, defaultVisibleMetrics, metricGroups,
  normalizeVisibleMetrics, readVisibleMetrics
} from "../utils/adminMetricPreferences.js";

const options = [
  { value: "light", label: "Light mode", icon: FiSun },
  { value: "dark", label: "Dark mode", icon: FiMoon }
];


const businessWidgetGroups = [
  { title: "Getting started", widgets: [["setupChecklist", "Business setup checklist"]] },
  { title: "Key metrics", widgets: [
    ["statSales", "This month's sales"], ["statCompleted", "Completed services"],
    ["statAverage", "Average sale"], ["statServices", "Services sold"]
  ] },
  { title: "Analytics", widgets: [
    ["salesOverview", "Sales overview"], ["serviceStatus", "Service status"],
    ["topServices", "Top services"]
  ] },
  { title: "Navigation", widgets: [["workspaceTopbar", "Top navigation bar (search and profile)"]] },
  { title: "Quick access", widgets: [
    ["quickServices", "Services"], ["quickBookings", "Bookings"], ["quickProducts", "Products"],
    ["quickSales", "Sales & analytics"], ["quickMessages", "Messages"],
    ["quickProfile", "Business profile"], ["quickSearch", "Search"]
  ] }
];
const defaultBusinessWidgets = () => Object.fromEntries(
  businessWidgetGroups.flatMap(group => group.widgets.map(([key]) => [key, true]))
);
function readBusinessWidgets(key) {
  const defaults = defaultBusinessWidgets();
  try {
    const saved = JSON.parse(window.localStorage.getItem(key) || "null");
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return defaults;
    for (const widgetKey of Object.keys(defaults)) {
      if (typeof saved[widgetKey] === "boolean") defaults[widgetKey] = saved[widgetKey];
    }
  } catch { /* Preferences remain in memory when browser storage is unavailable. */ }
  return defaults;
}

export default function SettingsPage({ user, onLogout, theme, onThemeChange }) {
  const isAdmin = user?.role === "admin";
  const visibilityKey = isAdmin ? adminMetricsKey(user) : "";
  const businessWidgetKey = `bookflow:business-dashboard:v1:${user?._id || user?.id || user?.email}`;
  const [visibleMetrics, setVisibleMetrics] = useState(() =>
    isAdmin ? readVisibleMetrics(visibilityKey) : defaultVisibleMetrics());
  const [draftMetrics, setDraftMetrics] = useState(() =>
    isAdmin ? readVisibleMetrics(visibilityKey) : defaultVisibleMetrics());
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState("Main statistics");
  const [preferencesLoading, setPreferencesLoading] = useState(isAdmin);
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [preferencesError, setPreferencesError] = useState("");
  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [visibleBusinessWidgets, setVisibleBusinessWidgets] = useState(() => readBusinessWidgets(businessWidgetKey));
  const [draftBusinessWidgets, setDraftBusinessWidgets] = useState(() => readBusinessWidgets(businessWidgetKey));
  const [businessCustomizeOpen, setBusinessCustomizeOpen] = useState(false);
  const [businessPreferencesLoading, setBusinessPreferencesLoading] = useState(!isAdmin);
  const [businessPreferencesSaving, setBusinessPreferencesSaving] = useState(false);
  const [businessPreferencesError, setBusinessPreferencesError] = useState("");
  const [expandedBusinessGroups, setExpandedBusinessGroups] = useState({ "Key metrics": true, Navigation: true });

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    const originalToken = window.localStorage.getItem("booking_token");
    const local = readVisibleMetrics(visibilityKey);
    setVisibleMetrics(local);
    setDraftMetrics(local);
    setCustomizeOpen(false);
    setPreferencesError("");
    setPreferencesLoading(true);

    async function loadPreferences() {
      try {
        const remote = await api.profile.getDashboardPreferences();
        if (!active || originalToken !== window.localStorage.getItem("booking_token")) return;
        if (remote?.adminMetrics && typeof remote.adminMetrics === "object" && !Array.isArray(remote.adminMetrics)) {
          const stored = normalizeVisibleMetrics(remote.adminMetrics);
          setVisibleMetrics(stored);
          setDraftMetrics(stored);
          try { window.localStorage.setItem(visibilityKey, JSON.stringify(stored)); }
          catch { /* The database remains the source of truth. */ }
        } else {
          // Import older browser-only settings for accounts not yet migrated.
          let hasLocal = false;
          try { hasLocal = window.localStorage.getItem(visibilityKey) !== null; }
          catch { /* The account can still save preferences. */ }
          if (hasLocal) await api.profile.saveDashboardPreferences("adminMetrics", local);
        }
      } catch {
        // Continue with locally saved selections if the server is unavailable.
      } finally {
        if (active) setPreferencesLoading(false);
      }
    }
    loadPreferences();
    return () => { active = false; };
  }, [isAdmin, visibilityKey]);


  useEffect(() => {
    if (isAdmin) return;
    let active = true;
    const originalToken = window.localStorage.getItem("booking_token");
    const local = readBusinessWidgets(businessWidgetKey);
    setVisibleBusinessWidgets(local);
    setDraftBusinessWidgets(local);
    setBusinessCustomizeOpen(false);
    setBusinessPreferencesError("");
    setBusinessPreferencesLoading(true);

    async function loadPreferences() {
      try {
        const remote = await api.profile.getDashboardPreferences();
        if (!active || originalToken !== window.localStorage.getItem("booking_token")) return;
        if (remote?.businessWidgets && typeof remote.businessWidgets === "object" && !Array.isArray(remote.businessWidgets)) {
          const defaults = defaultBusinessWidgets();
          const stored = Object.fromEntries(Object.keys(defaults).map(key =>
            [key, typeof remote.businessWidgets[key] === "boolean" ? remote.businessWidgets[key] : defaults[key]]
          ));
          setVisibleBusinessWidgets(stored);
          setDraftBusinessWidgets(stored);
          try { window.localStorage.setItem(businessWidgetKey, JSON.stringify(stored)); }
          catch { /* The database remains the source of truth. */ }
        } else {
          let hasLocal = false;
          try { hasLocal = window.localStorage.getItem(businessWidgetKey) !== null; }
          catch { /* The account can still save preferences. */ }
          if (hasLocal) await api.profile.saveDashboardPreferences("businessWidgets", local);
        }
      } catch {
        // Keep locally saved preferences available while offline.
      } finally {
        if (active) setBusinessPreferencesLoading(false);
      }
    }
    loadPreferences();
    return () => { active = false; };
  }, [isAdmin, businessWidgetKey]);

  function openBusinessCustomize() {
    setDraftBusinessWidgets({ ...visibleBusinessWidgets });
    setExpandedBusinessGroups({ "Key metrics": true, Navigation: true });
    setBusinessPreferencesError("");
    setBusinessCustomizeOpen(true);
  }

  async function saveBusinessCustomize() {
    if (businessPreferencesLoading || businessPreferencesSaving) return;
    setBusinessPreferencesSaving(true);
    setBusinessPreferencesError("");
    try {
      const { preferences } = await api.profile.saveDashboardPreferences("businessWidgets", draftBusinessWidgets);
      setVisibleBusinessWidgets({ ...preferences });
      setDraftBusinessWidgets({ ...preferences });
      try { window.localStorage.setItem(businessWidgetKey, JSON.stringify(preferences)); }
      catch { /* Saved to the account even if browser storage is unavailable. */ }
      window.dispatchEvent(new CustomEvent("bookflow:business-dashboard-preferences-updated", { detail: preferences }));
      setBusinessCustomizeOpen(false);
    } catch (error) {
      setBusinessPreferencesError(error.message || "Unable to save dashboard preferences.");
    } finally {
      setBusinessPreferencesSaving(false);
    }
  }

  function openMetricsDialog() {
    setDraftMetrics({ ...visibleMetrics });
    setExpandedGroup("Main statistics");
    setPreferencesError("");
    setCustomizeOpen(true);
    setOverviewLoading(true);
    api.admin.overview()
      .then(result => setOverview(result))
      .catch(() => setOverview(null))
      .finally(() => setOverviewLoading(false));
  }

  async function saveMetrics() {
    if (preferencesLoading || preferencesSaving) return;
    setPreferencesSaving(true);
    setPreferencesError("");
    try {
      const { preferences } = await api.profile.saveDashboardPreferences("adminMetrics", draftMetrics);
      const saved = normalizeVisibleMetrics(preferences);
      setVisibleMetrics(saved);
      setDraftMetrics(saved);
      try { window.localStorage.setItem(visibilityKey, JSON.stringify(saved)); }
      catch { /* Account settings are already saved remotely. */ }
      setCustomizeOpen(false);
    } catch (error) {
      setPreferencesError(error.message || "Unable to save platform statistics preferences.");
    } finally {
      setPreferencesSaving(false);
    }
  }

  const shownCount = Object.values(visibleMetrics).filter(Boolean).length;
  const totalCount = metricGroups.reduce((count, group) => count + group.metrics.length, 0);
  const metricValues = adminMetricValues(overview);

  return <AppLayout user={user} onLogout={onLogout}>
    <div className="bookflow-settings-v2">
      <header className="topbar settings-v2-header">
        <div>
          <p className="eyebrow">Preferences</p>
          <h1>Settings</h1>
          <p className="muted">Manage your preferences and account.</p>
        </div>
      </header>

      <section className="panel settings-v2-panel" aria-label="Appearance and account settings">
        <div className="settings-v2-section">
          <div className="settings-v2-section-title">
            <span className="settings-v2-heading-icon"><FiSliders aria-hidden="true"/></span>
            <div>
              <h2>Appearance</h2>
              <p>Choose how BookFlow looks for your account. Your preference follows you across devices.</p>
            </div>
          </div>
          <div className="settings-v2-theme-grid" role="group" aria-label="Color theme">
            {options.map(({ value, label, icon: Icon }) =>
              <Button key={value} type="button" variant="plain"
                className={"settings-v2-theme-button" + (theme === value ? " active" : "")}
                aria-pressed={theme === value} onClick={() => onThemeChange(value)}>
                <Icon className="settings-v2-theme-icon" aria-hidden="true"/>
                <span>{label}</span>
                {theme === value && <FiCheck className="settings-v2-theme-check" aria-hidden="true"/>}
              </Button>
            )}
          </div>
          <p className="settings-v2-autosave"><FiCheck aria-hidden="true"/>Your preference is saved automatically.</p>
        </div>

        {isAdmin && <>
          <div className="settings-v2-divider" aria-hidden="true"/>
          <section className="settings-v2-account settings-v2-statistics" aria-labelledby="settings-stats-title">
            <div className="settings-v2-section-title">
              <span className="settings-v2-heading-icon"><FiBarChart2 aria-hidden="true"/></span>
              <div>
                <h2 id="settings-stats-title">Platform statistics</h2>
                <p>Choose which statistics appear on your administrator Dashboard.</p>
                <small className="settings-v2-stats-count">
                  {preferencesLoading ? "Loading saved preferences…" : `${shownCount} of ${totalCount} visible`}
                </small>
              </div>
            </div>
            <Button type="button" size="sm" variant="outline" className="settings-v2-customize"
              disabled={preferencesLoading || preferencesSaving}
              onClick={openMetricsDialog} aria-haspopup="dialog">
              <FiSettings aria-hidden="true"/> Customize
            </Button>
          </section>
        </>}


        {!isAdmin && <>
          <div className="settings-v2-divider" aria-hidden="true"/>
          <section className="settings-v2-account settings-v2-business-widgets" aria-labelledby="settings-business-widgets-title">
            <div className="settings-v2-section-title">
              <span className="settings-v2-heading-icon"><FiSettings aria-hidden="true"/></span>
              <div>
                <h2 id="settings-business-widgets-title">Business dashboard</h2>
                <p>Choose which widgets, analytics, and quick links appear on your business dashboard.</p>
                <small className="settings-v2-stats-count">
                  {businessPreferencesLoading ? "Loading saved preferences…" : `${Object.values(visibleBusinessWidgets).filter(Boolean).length} of ${businessWidgetGroups.reduce((count, group) => count + group.widgets.length, 0)} visible`}
                </small>
              </div>
            </div>
            <Button type="button" size="sm" variant="outline" className="settings-v2-customize"
              disabled={businessPreferencesLoading || businessPreferencesSaving}
              onClick={openBusinessCustomize} aria-haspopup="dialog">
              <FiSettings aria-hidden="true"/> Customize
            </Button>
          </section>
        </>}

        <div className="settings-v2-divider" aria-hidden="true"/>
        <div className="settings-v2-account">
          <div className="settings-v2-section-title">
            <span className="settings-v2-heading-icon"><FiShield aria-hidden="true"/></span>
            <div>
              <h2>Account session</h2>
              <p>Sign out of this device.</p>
            </div>
          </div>
          <Button variant="outline" type="button" className="settings-v2-signout"
            onClick={onLogout}><FiLogOut aria-hidden="true"/><span>Sign out</span></Button>
        </div>
      </section>

      {isAdmin && <Dialog open={customizeOpen}
        onOpenChange={open => { if (!preferencesSaving) setCustomizeOpen(open); }}
        className="admin-stats-dialog" title="Customize platform statistics">
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Customize statistics</DialogTitle>
            <DialogDescription>Select which statistics appear on your Dashboard. Unchecking hides a number; it never deletes data.</DialogDescription>
          </DialogHeader>
          <div className="admin-stats-checklist">
            {metricGroups.map(group => {
              const groupId = `admin-stats-${group.title.toLowerCase().replaceAll(" ", "-")}`;
              const expanded = expandedGroup === group.title;
              const checkedCount = group.metrics.filter(([key]) => draftMetrics[key] !== false).length;
              return <section key={group.title} className="admin-stats-table-section" aria-label={group.title}>
                <button type="button" className="admin-stats-group-trigger"
                  aria-expanded={expanded} aria-controls={groupId}
                  onClick={() => setExpandedGroup(current => current === group.title ? null : group.title)}>
                  <span className="admin-stats-group-heading">{group.title}</span>
                  <span className="admin-stats-group-count">{checkedCount}/{group.metrics.length} shown</span>
                  <FiChevronDown aria-hidden="true" className={expanded ? "is-expanded" : ""}/>
                </button>
                <div id={groupId} className="admin-stats-table-wrap" hidden={!expanded}>
                  <table className="admin-stats-table">
                    <thead className="admin-stats-sr-only">
                      <tr><th scope="col">Show statistic</th><th scope="col">Current value</th></tr>
                    </thead>
                    <tbody>
                      {group.metrics.map(([key, label]) => <tr key={key}>
                        <th scope="row" className="admin-stats-row-name">
                          <label htmlFor={`admin-stat-show-${key}`} className="admin-stats-metric-option">
                            <input type="checkbox" id={`admin-stat-show-${key}`}
                              aria-label={`Show ${label}`}
                              checked={draftMetrics[key] !== false}
                              disabled={preferencesLoading || preferencesSaving}
                              onChange={event => setDraftMetrics(current => ({ ...current, [key]: event.target.checked }))}/>
                            <span>{label}</span>
                          </label>
                        </th>
                        <td className="admin-stats-metric-value" title={String(metricValues[key] ?? "—")}>
                          {overviewLoading ? "Loading…" : metricValues[key] ?? "—"}
                        </td>
                      </tr>)}
                    </tbody>
                  </table>
                </div>
              </section>;
            })}
          </div>
          {preferencesError && <p role="alert">{preferencesError}</p>}
          <DialogFooter className="admin-stats-checklist-footer">
            <div className="admin-stats-checklist-helpers">
              <Button type="button" variant="ghost" size="sm"
                disabled={preferencesLoading || preferencesSaving}
                onClick={() => setDraftMetrics(defaultVisibleMetrics())}>
                <FiCheckSquare aria-hidden="true"/> Select all
              </Button>
              <Button type="button" variant="ghost" size="sm"
                disabled={preferencesLoading || preferencesSaving}
                onClick={() => setDraftMetrics({ ...visibleMetrics })}>
                <FiRotateCcw aria-hidden="true"/> Reset changes
              </Button>
            </div>
            <div className="admin-stats-checklist-actions">
              <Button type="button" variant="outline" size="sm"
                disabled={preferencesSaving}
                onClick={() => setCustomizeOpen(false)}>
                <FiX aria-hidden="true"/> Cancel
              </Button>
              <Button type="button" size="sm" disabled={preferencesLoading || preferencesSaving}
                onClick={saveMetrics}>
                <FiSave aria-hidden="true"/> Save changes
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>}

      {!isAdmin && <Dialog open={businessCustomizeOpen}
        onOpenChange={open => { if (!businessPreferencesSaving) setBusinessCustomizeOpen(open); }}
        className="business-dashboard-dialog" title="Customize business dashboard">
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Customize dashboard</DialogTitle>
            <DialogDescription>Show only what matters to you. Hidden items can be restored anytime.</DialogDescription>
          </DialogHeader>
          <div className="business-dashboard-widget-summary" aria-live="polite">
            <span><strong>{Object.values(draftBusinessWidgets).filter(Boolean).length}</strong> of {businessWidgetGroups.reduce((count, group) => count + group.widgets.length, 0)} widgets selected</span>
            <span>{businessPreferencesLoading ? "Loading saved settings…" : "Changes apply when saved"}</span>
          </div>
          <div className="business-dashboard-widget-list">
            {businessWidgetGroups.map(group => {
              const id = `business-widget-${group.title.toLowerCase().replaceAll(" ", "-")}`;
              const expanded = Boolean(expandedBusinessGroups[group.title]);
              const shown = group.widgets.filter(([key]) => draftBusinessWidgets[key] !== false).length;
              return <section className="business-dashboard-widget-group" key={group.title}>
                <button className="business-dashboard-widget-trigger" type="button"
                  aria-controls={id} aria-expanded={expanded}
                  onClick={() => setExpandedBusinessGroups(current => ({
                    ...current, [group.title]: !current[group.title]
                  }))}>
                  <span>{group.title}</span>
                  <span className="business-dashboard-widget-count">{shown} / {group.widgets.length}</span>
                  <FiChevronDown className={expanded ? "is-expanded" : ""} aria-hidden="true" />
                </button>
                <div id={id} className="business-dashboard-widget-rows" hidden={!expanded}>
                  {group.widgets.map(([key, label]) => <label className="business-dashboard-widget-row" key={key}>
                    <span className="business-dashboard-widget-name">
                      <input type="checkbox" checked={draftBusinessWidgets[key] !== false}
                        disabled={businessPreferencesLoading || businessPreferencesSaving}
                        onChange={event => setDraftBusinessWidgets(current => ({ ...current, [key]: event.target.checked }))}
                        aria-label={`Show ${label}`}/>
                      <span>{label}</span>
                    </span>
                    <span className="business-dashboard-widget-value">Dashboard widget</span>
                  </label>)}
                </div>
              </section>;
            })}
          </div>
          {businessPreferencesError && <p role="alert">{businessPreferencesError}</p>}
          <DialogFooter className="business-dashboard-widget-footer">
            <div className="business-dashboard-widget-helpers">
              <Button type="button" variant="ghost" size="sm"
                disabled={businessPreferencesLoading || businessPreferencesSaving}
                onClick={() => setDraftBusinessWidgets(defaultBusinessWidgets())}>
                <FiCheckSquare aria-hidden="true"/> Select all
              </Button>
              <Button type="button" variant="ghost" size="sm"
                disabled={businessPreferencesLoading || businessPreferencesSaving}
                onClick={() => setDraftBusinessWidgets({ ...visibleBusinessWidgets })}>
                <FiRotateCcw aria-hidden="true"/> Undo changes
              </Button>
            </div>
            <div className="business-dashboard-widget-actions">
              <Button type="button" variant="outline" size="sm" disabled={businessPreferencesSaving}
                onClick={() => setBusinessCustomizeOpen(false)}><FiX aria-hidden="true"/> Cancel</Button>
              <Button type="button" size="sm" disabled={businessPreferencesLoading || businessPreferencesSaving}
                onClick={saveBusinessCustomize}><FiSave aria-hidden="true"/> Save changes</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>}

    </div>
  </AppLayout>;
}
