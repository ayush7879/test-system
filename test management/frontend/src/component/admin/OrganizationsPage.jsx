import ResourcePage from "./ResourcePage";

export default function OrganizationsPage() {
  return <ResourcePage title="Organizations" description="Organizations configured in this workspace." columns={[{ key: "name", label: "Organization" }, { key: "members", label: "Members" }, { key: "projects", label: "Projects" }, { key: "status", label: "Status" }]} rows={[{ id: "org-main", name: "Default organization", members: "Managed in Users", projects: "Managed in Projects", status: "Active" }]} />;
}
