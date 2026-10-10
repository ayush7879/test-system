import { useState } from "react";
import PageHeader from "./PageHeader";
import { formatNumber, summarizeProject } from "./projectData";

const newProject = { name: "", code: "", description: "", moduleName: "Core module" };

export default function ProjectsPage({ projects, loading, error: projectsError, onCreateProject, onSelectProject }) {
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState(newProject);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    const name = form.name.trim();
    const code = form.code.trim().toUpperCase();
    if (!name || !code || !form.moduleName.trim()) {
      setError("Enter a project name, code, and first submodule.");
      return;
    }
    setError("");
    try {
      await onCreateProject({
        name,
        code,
        description: form.description.trim() || "New test management project.",
        moduleName: form.moduleName.trim(),
      });
      setForm(newProject);
      setIsCreating(false);
    } catch (submitError) {
      setError(submitError.message || "Unable to create project.");
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="WORKSPACE"
        title="Projects"
        description="Browse projects and review test health across each project."
        action={<button type="button" className="dashboard-primary-action" onClick={() => { setIsCreating(!isCreating); setError(""); }}>{isCreating ? "Cancel" : "+ New project"}</button>}
      />
      {isCreating && (
        <form className="dashboard-panel create-project-form" onSubmit={handleSubmit}>
          <h2>Create a project</h2>
          <div className="project-form-grid">
            <div className="input-group"><label htmlFor="project-name">Project name</label><input id="project-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Customer Portal" required /></div>
            <div className="input-group"><label htmlFor="project-code">Project code</label><input id="project-code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="e.g. PORTAL" maxLength={8} required /></div>
            <div className="input-group"><label htmlFor="project-description">Description</label><input id="project-description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="What is this project for?" /></div>
            <div className="input-group"><label htmlFor="first-module">First submodule</label><input id="first-module" value={form.moduleName} onChange={(event) => setForm({ ...form, moduleName: event.target.value })} required /></div>
          </div>
          {error && <p className="form-message error" role="alert">{error}</p>}
          <button type="submit" className="login-button project-create-button">Create project</button>
        </form>
      )}
      {projectsError && <p className="form-message error" role="alert">{projectsError}</p>}
      <div className="project-grid">
        {projectsError ? null : loading ? <div className="dashboard-panel team-empty">Loading projects…</div> : projects.map((project) => {
          const summary = summarizeProject(project);
          return (
            <button className="project-card" type="button" key={project.id} onClick={() => onSelectProject(project)}>
              <div className="project-card-top"><span className="project-code">{project.code}</span><span className="project-open">↗</span></div>
              <h2>{project.name}</h2>
              <p>{project.description}</p>
              <div className="project-card-metrics"><span><strong>{formatNumber(summary.testCases)}</strong> test cases</span><span><strong>{project.modules.length}</strong> submodules</span></div>
              <div className="project-card-footer"><span><i className="summary-dot pass" />{summary.passRate}% pass rate</span><span>Updated {project.updatedAt}</span></div>
            </button>
          );
        })}
        {!projects.length && <div className="dashboard-panel team-empty"><strong>No projects yet</strong><span>Create a project to start organizing test cases.</span></div>}
      </div>
    </div>
  );
}
