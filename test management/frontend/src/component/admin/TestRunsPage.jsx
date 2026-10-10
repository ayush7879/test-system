import ResourcePage from "./ResourcePage";
import { summarizeProject, formatNumber } from "./projectData";

export default function TestRunsPage({ projects }) {
  const rows = projects.map((project) => {
    const summary = summarizeProject(project);
    return { id: project.id, project: project.name, executed: `${formatNumber(summary.executions)} / ${formatNumber(summary.testCases)}`, passed: `${summary.passRate}%`, status: summary.fail ? "Review failures" : "On track" };
  });
  return <ResourcePage title="Test Runs" description="Execution progress based on the latest project test summaries." columns={[{ key: "project", label: "Project" }, { key: "executed", label: "Executed / total" }, { key: "passed", label: "Pass rate" }, { key: "status", label: "Run status" }]} rows={rows} emptyText="Project execution summaries will appear here." />;
}
