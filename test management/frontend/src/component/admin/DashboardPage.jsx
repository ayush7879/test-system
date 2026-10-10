import PageHeader from "./PageHeader";
import TestSummary from "./TestSummary";
import { formatNumber, summarizeProject, summarizeModules } from "./projectData";

export default function DashboardPage({ projects, onOpenProjects, onSelectProject }) {
  const summaries = projects.map(summarizeProject);
  const totals = summaries.reduce((result, item) => ({
    testCases: result.testCases + item.testCases,
    executions: result.executions + item.executions,
  }), { testCases: 0, executions: 0 });
  const statusSummary = summarizeModules(projects.flatMap((project) => project.modules));

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="ADMIN WORKSPACE"
        title="Dashboard"
        description="A quick view of project progress and test execution health."
        action={<button type="button" className="dashboard-primary-action" onClick={onOpenProjects}>Browse projects <span>→</span></button>}
      />
      <section className="dashboard-stats" aria-label="Workspace overview">
        <article className="dashboard-stat"><span className="stat-icon stat-total">▦</span><div><p>Projects</p><strong>{projects.length}</strong></div></article>
        <article className="dashboard-stat"><span className="stat-icon stat-tester">▤</span><div><p>Test cases</p><strong>{formatNumber(totals.testCases)}</strong></div></article>
        <article className="dashboard-stat"><span className="stat-icon stat-lead">▶</span><div><p>Executions</p><strong>{formatNumber(totals.executions)}</strong></div></article>
      </section>
      <div className="dashboard-columns dashboard-overview-columns">
        <TestSummary summary={statusSummary} title="Test summary · all projects" />
        <section className="dashboard-panel dashboard-project-list">
          <div className="team-panel-heading"><div><h2>Projects</h2><p>Choose a project to view its submodules.</p></div><button type="button" className="inline-link" onClick={onOpenProjects}>View all</button></div>
          {projects.length ? projects.slice(0, 5).map((project) => {
            const summary = summarizeProject(project);
            return (
              <button className="overview-project-row" key={project.id} type="button" onClick={() => onSelectProject(project)}>
                <span className="project-code small-code">{project.code}</span>
                <span className="overview-project-copy"><strong>{project.name}</strong><small>{project.modules.length} submodules · {formatNumber(summary.testCases)} test cases</small></span>
                <span className="overview-project-pass">{summary.passRate}% <small>pass</small></span>
                <span className="module-arrow">→</span>
              </button>
            );
          }) : <div className="team-empty"><strong>No projects yet</strong><span>Use Projects to add your first project.</span></div>}
        </section>
      </div>
    </div>
  );
}
