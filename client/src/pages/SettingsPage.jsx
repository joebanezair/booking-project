import { Button } from "../components/ui/button.jsx";
import { FiCheck, FiLogOut, FiMoon, FiShield, FiSliders, FiSun } from "react-icons/fi";
import AppLayout from "../components/AppLayout.jsx";

const options = [
  { value: "light", label: "Light mode", text: "Clean and bright", icon: FiSun },
  { value: "dark", label: "Dark mode", text: "Comfortable at night", icon: FiMoon }
];

export default function SettingsPage({ user, onLogout, theme, onThemeChange }) {
  return <AppLayout user={user} onLogout={onLogout}>
    <div className="bookflow-settings-v2">
      <header className="topbar settings-v2-header">
        <div>
          <p className="eyebrow">PREFERENCES</p>
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
              <p>Choose how BookFlow looks on this device.</p>
            </div>
          </div>
          <div className="settings-v2-theme-grid" role="group" aria-label="Color theme">
            {options.map(({ value, label, text, icon: Icon }) =>
              <Button key={value} type="button" variant="plain"
                className={"settings-v2-theme-button" + (theme === value ? " active" : "")}
                aria-pressed={theme === value} onClick={() => onThemeChange(value)}>
                <Icon className="settings-v2-theme-icon" aria-hidden="true"/>
                {theme === value && <FiCheck className="settings-v2-theme-check" aria-hidden="true"/>}
                <strong>{label}</strong>
                <small>{text}</small>
              </Button>
            )}
          </div>
          <p className="settings-v2-autosave"><FiCheck aria-hidden="true"/>Your preference is saved automatically.</p>
        </div>

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
    </div>
  </AppLayout>;
}
