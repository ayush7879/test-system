import ResourcePage from "./ResourcePage";

export default function AuditLogsPage({ logs = [], loading, error }) {
  const rows = logs.map((entry) => ({
    id: entry._id,
    event: `${entry.action} ${entry.entityType}`,
    actor: entry.actor?.name || entry.actor?.email || "Admin",
    time: new Date(entry.createdAt).toLocaleString(),
    result: entry.details?.email || entry.details?.name || entry.details?.caseId || "Recorded",
  }));
  return <ResourcePage eyebrow="SECURITY" title="Audit Logs" description="Recent workspace activity and account events." columns={[{ key: "event", label: "Event" }, { key: "actor", label: "User" }, { key: "time", label: "Time" }, { key: "result", label: "Details" }]} rows={rows} emptyText={error || (loading ? "Loading activity…" : "No activity has been recorded yet.")} />;
}
