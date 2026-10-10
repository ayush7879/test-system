import ResourcePage from "./ResourcePage";

export default function TestCasesPage({ projects }) {
  const rows = projects.flatMap((project) => project.modules.flatMap((module) => {
    if (module.testCases?.length) {
      return module.testCases.map((testCase) => ({
        id: testCase.id,
        project: project.name,
        module: module.name,
        status: testCase.status,
        count: 1,
      }));
    }
    const summary = module.summary;
    return Object.entries({ Pass: summary.pass, Fail: summary.fail, Blocked: summary.blocked, "Not run": summary.notRun }).map(([status, count]) => ({ id: `${project.id}-${module.id}-${status}`, project: project.name, module: module.name, status, count }));
  }));
  return <ResourcePage title="Test Cases" description="Test case counts grouped by project submodule and current result." columns={[{ key: "project", label: "Project" }, { key: "module", label: "Submodule" }, { key: "status", label: "Result" }, { key: "count", label: "Cases" }]} rows={rows} emptyText="Create a project and submodule to begin tracking test cases." />;
}
