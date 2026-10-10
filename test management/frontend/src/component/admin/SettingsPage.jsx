import { useState } from "react";
import PageHeader from "./PageHeader";

export default function SettingsPage({ user }) {
  const [saved, setSaved] = useState(false);
  return (
    <div className="page-stack">
      <PageHeader eyebrow="WORKSPACE" title="Settings" description="Workspace profile and administrator account details." />
      <section className="dashboard-panel settings-panel">
        <h2>Workspace profile</h2>
        <div className="settings-row"><span>Workspace name</span><strong>TestManager</strong></div>
        <div className="settings-row"><span>Signed-in administrator</span><strong>{user.name || user.email}</strong></div>
        <div className="settings-row"><span>Account email</span><strong>{user.email}</strong></div>
        <button type="button" className="dashboard-primary-action" onClick={() => setSaved(true)}>Save settings</button>
        {saved && <p className="settings-note" role="status">Workspace settings are up to date.</p>}
      </section>
    </div>
  );
}
