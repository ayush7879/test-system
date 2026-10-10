import ResourcePage from "./ResourcePage";

export default function TestSuitesPage({ projects }) {
  const rows = projects.flatMap((project) => project.modules.map((module) => ({ id: `${project.id}-${module.id}`, suite: module.name, project: project.name, cases: module.testCases?.length || module.summary.pass + module.summary.fail + module.summary.blocked + module.summary.notRun, status: "Ready" })));
  return <ResourcePage title="Test Suites" description="Test suites are represented by project submodules in this workspace." columns={[{ key: "suite", label: "Suite / submodule" }, { key: "project", label: "Project" }, { key: "cases", label: "Test cases" }, { key: "status", label: "Status" }]} rows={rows} emptyText="Create a project and submodule to see test suites here." />;
}
