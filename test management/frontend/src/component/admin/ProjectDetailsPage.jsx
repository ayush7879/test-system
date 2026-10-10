import PageHeader from "./PageHeader";
import TestSummary from "./TestSummary";
import { useState } from "react";
import { formatNumber, summarizeProject } from "./projectData";

export default function ProjectDetailsPage({ project, onBack, onSelectModule, onCreateModule, isSaving }) {
  const [isCreatingModule, setIsCreatingModule] = useState(false);
  const [moduleName, setModuleName] = useState("");
  const [moduleError, setModuleError] = useState("");
  const summary = summarizeProject(project);
  const cards = [
    { label: "Test cases", value: summary.testCases, icon: "▤", tone: "blue" },
    { label: "Executions", value: summary.executions, icon: "▶", tone: "green" },
    { label: "Submodules", value: project.modules.length, icon: "▦", tone: "violet" },
  ];

  const handleCreateModule = async (event) => {
    event.preventDefault();
    const name = moduleName.trim();
    if (!name) {
      setModuleError("Enter a name for the submodule.");
      return;
    }
    if (project.modules.some((module) => module.name.toLowerCase() === name.toLowerCase())) {
      setModuleError("A submodule with that name already exists in this project.");
      return;
    }
    setModuleError("");
    try {
      await onCreateModule(project.id, { name });
      setModuleName("");
      setIsCreatingModule(false);
    } catch (error) {
      setModuleError(error.message || "Unable to create submodule.");
    }
  };

  return (
    <div className="page-stack">
      <button type="button" className="back-link" onClick={onBack}>← Back to projects</button>
      <PageHeader eyebrow={`PROJECT / ${project.code}`} title={project.name} description={project.description} />
      <section className="dashboard-stats project-detail-stats">
        {cards.map((card) => (
          <article className="dashboard-stat" key={card.label}>
            <span className={`stat-icon stat-${card.tone}`}>{card.icon}</span>
            <div><p>{card.label}</p><strong>{formatNumber(card.value)}</strong></div>
          </article>
        ))}
      </section>
      <div className="project-detail-grid">
        <TestSummary summary={summary} title="Project test summary" />
        <section className="dashboard-panel modules-panel">
          <div className="team-panel-heading">
            <div><h2>Submodules</h2><p>Select a submodule to manage cases and results.</p></div>
            <button type="button" className="dashboard-primary-action module-create-toggle" onClick={() => { setIsCreatingModule(!isCreatingModule); setModuleError(""); }}>{isCreatingModule ? "Cancel" : "+ Create submodule"}</button>
          </div>
          {isCreatingModule && (
            <form className="create-module-form" onSubmit={handleCreateModule}>
              <div className="input-group"><label htmlFor="module-name">Submodule name</label><input id="module-name" value={moduleName} onChange={(event) => setModuleName(event.target.value)} placeholder="e.g. Authentication" autoFocus required /></div>
              {moduleError && <p className="form-message error" role="alert">{moduleError}</p>}
              <button type="submit" className="login-button" disabled={isSaving}>{isSaving ? "Creating…" : "Create submodule"}</button>
            </form>
          )}
          <span className="team-count modules-count">{project.modules.length}</span>
          <div className="module-list">
            {project.modules.map((module) => {
              const moduleSummary = summarizeProject({ modules: [module] });
              return (
                <button className="module-card" type="button" key={module.id} onClick={() => onSelectModule(module)}>
                  <span className="module-icon">▦</span>
                  <span className="module-card-copy"><strong>{module.name}</strong><small>{formatNumber(moduleSummary.testCases)} test cases · {moduleSummary.passRate}% pass</small></span>
                  <span className="module-arrow">→</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
