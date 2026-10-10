import ResourcePage from "./ResourcePage";

export default function DefectsPage({ projects }) {
  const rows = projects.flatMap((project) => project.modules.filter((module) => module.summary.fail > 0).map((module) => ({ id: `${project.id}-${module.id}`, project: project.name, module: module.name, failures: module.summary.fail, priority: module.summary.fail > 10 ? "High" : "Normal", status: "Open" })));
  return <ResourcePage title="Defects" description="Failure counts that need review, grouped by project submodule." columns={[{ key: "project", label: "Project" }, { key: "module", label: "Submodule" }, { key: "failures", label: "Failures" }, { key: "priority", label: "Priority" }, { key: "status", label: "Status" }]} rows={rows} emptyText="No test failures are currently recorded." />;
}
