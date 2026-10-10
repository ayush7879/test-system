import TestSummary from "./TestSummary";
import PageHeader from "./PageHeader";
import { summarizeModules } from "./projectData";

export default function ReportsPage({ projects }) {
  return (
    <div className="page-stack">
      <PageHeader eyebrow="ANALYTICS" title="Reports" description="Test outcome summaries for every project in your workspace." />
      <div className="report-grid">
        {projects.map((project) => <TestSummary key={project.id} summary={summarizeModules(project.modules)} title={project.name} compact />)}
        {!projects.length && <section className="dashboard-panel team-empty"><strong>No reports yet</strong><span>Add projects to generate summaries.</span></section>}
      </div>
    </div>
  );
}
