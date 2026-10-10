import PageHeader from "./PageHeader";
import TestSummary from "./TestSummary";
import { formatNumber, summarizeProject } from "./projectData";
import TestCasesPanel from "./TestCasesPanel";

export default function SubmoduleDetailsPage({ project, module, onBack, onAddTestCases, onUpdateTestCase, isSaving }) {
  const summary = summarizeProject({ modules: [module] });

  return (
    <div className="page-stack">
      <button type="button" className="back-link" onClick={onBack}>← Back to {project.name}</button>
      <PageHeader eyebrow={`${project.code} / SUBMODULE`} title={module.name} description={`Test execution results for the ${module.name} submodule.`} />
      <section className="dashboard-stats project-detail-stats">
        <article className="dashboard-stat"><span className="stat-icon stat-total">▤</span><div><p>Test cases</p><strong>{formatNumber(summary.testCases)}</strong></div></article>
        <article className="dashboard-stat"><span className="stat-icon stat-tester">▶</span><div><p>Executions</p><strong>{formatNumber(summary.executions)}</strong></div></article>
        <article className="dashboard-stat"><span className="stat-icon stat-lead">✓</span><div><p>Pass rate</p><strong>{summary.passRate}%</strong></div></article>
      </section>
      <TestSummary summary={summary} title={`${module.name} test summary`} />
      <TestCasesPanel
        module={module}
        isSaving={isSaving}
        onAddTestCases={(testCases) => onAddTestCases(project.id, module.id, testCases)}
        onUpdateTestCase={onUpdateTestCase}
      />
    </div>
  );
}
