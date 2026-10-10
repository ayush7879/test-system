import { useState } from "react";
import PageHeader from "./PageHeader";
import InviteTeamPage from "./InviteTeamPage";

export default function UsersPage({ users, loading, error, token, onInviteSent }) {
  const [showInvite, setShowInvite] = useState(false);
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="ACCESS MANAGEMENT"
        title="Users"
        description="Team accounts, roles, and invitation status. The signed-in Admin is not included."
        action={<button type="button" className="dashboard-primary-action" onClick={() => setShowInvite(true)}><span>＋</span> Invite Team</button>}
      />
      <section className="dashboard-panel team-panel">
        <div className="team-panel-heading"><div><h2>Team members</h2><p>Users with access to this workspace</p></div><span className="team-count">{loading ? "…" : users.length}</span></div>
        {error ? <p className="form-message error">{error}</p> : loading ? <p className="team-empty">Loading users…</p> : users.length ? (
          <div className="team-list">{users.map((member) => (
            <article className="team-member" key={member.id}>
              <div className="member-avatar">{(member.name || member.email).charAt(0).toUpperCase()}</div>
              <div className="member-info"><strong>{member.name}</strong><span>{member.email}</span></div>
              <div className="member-meta"><span className="member-role">{member.role}</span><span className={`member-status ${member.status === "Active" ? "active" : "pending"}`}>{member.status}</span></div>
            </article>
          ))}</div>
        ) : <div className="team-empty"><strong>No teammates yet</strong><span>Use Invite Team to add a Tester or QA Lead.</span></div>}
      </section>
      {showInvite && <InviteTeamPage token={token} onClose={() => setShowInvite(false)} onInviteSent={onInviteSent} />}
    </div>
  );
}
