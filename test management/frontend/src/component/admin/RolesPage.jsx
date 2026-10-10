import ResourcePage from "./ResourcePage";

export default function RolesPage({ roles = [], loading, error }) {
  const rows = roles.map((role) => ({
    id: role._id,
    name: role.name,
    access: role.description,
    assignment: role.name === "Admin" ? "Account registration" : "Admin invitation",
  }));
  return <ResourcePage title="Roles" description="Roles available to members of the TestManager workspace." columns={[{ key: "name", label: "Role" }, { key: "access", label: "Access" }, { key: "assignment", label: "Assignment" }]} rows={rows} emptyText={error || (loading ? "Loading roles…" : "No roles configured.")} />;
}
