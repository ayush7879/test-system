import { useState } from "react";
import apiRequest from "./apiRequest";

const emptyInvite = { name: "", email: "", role: "Tester" };

export default function InviteTeamPage({ token, onInviteSent, onClose }) {
  const [invite, setInvite] = useState(emptyInvite);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    try {
      await apiRequest("/api/auth/invite", { method: "POST", body: JSON.stringify(invite) }, token);
      setMessage(`Invitation sent to ${invite.email}.`);
      setIsError(false);
      setInvite(emptyInvite);
      onInviteSent();
    } catch (error) {
      setMessage(error.message);
      setIsError(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="invite-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="dashboard-panel invite-panel invite-dialog" id="invite-teammate" role="dialog" aria-modal="true" aria-labelledby="invite-dialog-title">
        <button type="button" className="invite-dialog-close" onClick={onClose} aria-label="Close invitation">×</button>
        <div className="panel-heading"><div className="panel-heading-icon">＋</div><div><h2>Invite a teammate</h2><p>The invitation details will be emailed to them.</p></div></div>
        <form onSubmit={handleSubmit}>
          <div className="input-group"><label htmlFor="invite-name">Full name</label><input id="invite-name" type="text" minLength={3} value={invite.name} onChange={(event) => setInvite({ ...invite, name: event.target.value })} autoComplete="name" placeholder="e.g. Alex Morgan" required /></div>
          <div className="input-group"><label htmlFor="invite-email">Work email (username)</label><input id="invite-email" type="email" value={invite.email} onChange={(event) => setInvite({ ...invite, email: event.target.value })} autoComplete="email" placeholder="alex@company.com" required /></div>
          <div className="input-group"><label htmlFor="invite-role">Team role</label><select id="invite-role" value={invite.role} onChange={(event) => setInvite({ ...invite, role: event.target.value })} required><option value="Tester">Tester</option><option value="QA Lead">QA Lead</option></select></div>
          {message && <p className={`form-message ${isError ? "error" : "success"}`} role="status">{message}</p>}
          <button type="submit" className="login-button invite-submit" disabled={isSubmitting}>{isSubmitting ? "Sending invitation…" : "Send invitation by email"}</button>
        </form>
        <p className="invite-security-note">A unique temporary password is emailed to the teammate. They must change it after signing in.</p>
      </section>
    </div>
  );
}
