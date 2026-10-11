import { useEffect, useState } from "react";
import apiRequest from "./apiRequest";
import AuditLogsPage from "./AuditLogsPage";
import DashboardPage from "./DashboardPage";
import DefectsPage from "./DefectsPage";
import OrganizationsPage from "./OrganizationsPage";
import ProjectDetailsPage from "./ProjectDetailsPage";
import ProjectsPage from "./ProjectsPage";
import ReportsPage from "./ReportsPage";
import RolesPage from "./RolesPage";
import SettingsPage from "./SettingsPage";
import Sidebar from "./Sidebar";
import SubmoduleDetailsPage from "./SubmoduleDetailsPage";
import TestCasesPage from "./TestCasesPage";
import TestRunsPage from "./TestRunsPage";
import TestSuitesPage from "./TestSuitesPage";
import UsersPage from "./UsersPage";
import { readLegacyProjectsForMigration } from "./projectData";
import "./adminWorkspace.css";

const workspaceProjectLoads = new Map();

function loadWorkspaceProjects(token, userId) {
  if (workspaceProjectLoads.has(userId)) return workspaceProjectLoads.get(userId);

  const loadPromise = (async () => {
    const result = await apiRequest("/api/workspace/projects", {}, token);
    const savedProjects = readLegacyProjectsForMigration();
    if (savedProjects.length) {
      const existingCodes = new Set((result.projects || []).map((project) => project.code.toLowerCase()));
      for (const project of savedProjects) {
        if (existingCodes.has(project.code.toLowerCase())) continue;
        const modules = project.modules || [];
        const firstModule = modules[0];
        const created = await apiRequest("/api/workspace/projects", {
          method: "POST",
          body: JSON.stringify({
            name: project.name,
            code: project.code,
            description: project.description,
            moduleName: firstModule?.name,
            moduleSummary: firstModule?.testCases?.length ? undefined : firstModule?.summary,
            startDate: project.startDate,
            dueDate: project.dueDate,
          }),
        }, token);

        for (const [index, module] of modules.entries()) {
          let targetModule = index === 0 ? created.project.modules[0] : null;
          if (!targetModule) {
            const added = await apiRequest(`/api/workspace/projects/${created.project.id}/submodules`, {
              method: "POST",
              body: JSON.stringify({
                name: module.name,
                description: module.description,
                summary: module.testCases?.length ? undefined : module.summary,
              }),
            }, token);
            targetModule = added.submodule;
          }
          if (module.testCases?.length) {
            await apiRequest(`/api/workspace/submodules/${targetModule.id}/testcases`, {
              method: "POST",
              body: JSON.stringify({ testCases: module.testCases }),
            }, token);
          }
        }
        existingCodes.add(project.code.toLowerCase());
      }
      localStorage.removeItem("testmanager-projects-v1");
    }
    return apiRequest("/api/workspace/projects", {}, token);
  })().catch((error) => {
    workspaceProjectLoads.delete(userId);
    throw error;
  });

  workspaceProjectLoads.set(userId, loadPromise);
  return loadPromise;
}

export default function AdminDashboard({ user, onSignOut }) {
  const userId = user.id;
  const [activePage, setActivePage] = useState("dashboard");
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState("");
  const [team, setTeam] = useState(null);
  const [teamError, setTeamError] = useState("");
  const [roles, setRoles] = useState(null);
  const [rolesError, setRolesError] = useState("");
  const [activityLogs, setActivityLogs] = useState(null);
  const [activityError, setActivityError] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [selectedModuleId, setSelectedModuleId] = useState(null);
  const [isLoadingProjectChange, setIsLoadingProjectChange] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    apiRequest("/api/auth/team", {}, localStorage.getItem("token"))
      .then((result) => {
        if (isCurrent) {
          setTeam(result.users || []);
          setTeamError("");
        }
      })
      .catch((error) => {
        if (isCurrent) {
          setTeam([]);
          setTeamError(error.message);
        }
      });
    return () => { isCurrent = false; };
  }, []);

  useEffect(() => {
    let isCurrent = true;
    Promise.all([
      apiRequest("/api/workspace/roles", {}, localStorage.getItem("token")),
      apiRequest("/api/workspace/activitylogs", {}, localStorage.getItem("token")),
    ]).then(([roleResult, activityResult]) => {
      if (!isCurrent) return;
      setRoles(roleResult.roles || []);
      setActivityLogs(activityResult.activityLogs || []);
      setRolesError("");
      setActivityError("");
    }).catch((error) => {
      if (isCurrent) {
        setRolesError(error.message);
        setActivityError(error.message);
        setRoles([]);
        setActivityLogs([]);
      }
    });
    return () => { isCurrent = false; };
  }, []);

  const reloadProjects = async () => {
    const result = await apiRequest("/api/workspace/projects", {}, localStorage.getItem("token"));
    setProjects(result.projects || []);
    setProjectsError("");
    return result.projects || [];
  };

  useEffect(() => {
    let isCurrent = true;
    loadWorkspaceProjects(localStorage.getItem("token"), userId)
      .then((workspace) => {
        if (isCurrent) {
          setProjects(workspace.projects || []);
          setProjectsError("");
        }
      })
      .catch((error) => {
        if (isCurrent) setProjectsError(error.message);
      })
      .finally(() => { if (isCurrent) setProjectsLoading(false); });
    return () => { isCurrent = false; };
  }, [userId]);

  const createProject = async (project) => {
    const result = await apiRequest("/api/workspace/projects", {
      method: "POST",
      body: JSON.stringify({ name: project.name, code: project.code, description: project.description, moduleName: project.moduleName, startDate: project.startDate, dueDate: project.dueDate }),
    }, localStorage.getItem("token"));
    setProjects((current) => [result.project, ...current]);
  };

  const createModule = async (projectId, module) => {
    setIsLoadingProjectChange(true);
    try {
    await apiRequest(`/api/workspace/projects/${projectId}/submodules`, {
      method: "POST",
      body: JSON.stringify({ name: module.name, description: module.description }),
    }, localStorage.getItem("token"));
    await reloadProjects();
    } finally {
      setIsLoadingProjectChange(false);
    }
  };

  const addTestCases = async (projectId, moduleId, testCases) => {
    setIsLoadingProjectChange(true);
    try {
    await apiRequest(`/api/workspace/submodules/${moduleId}/testcases`, {
      method: "POST",
      body: JSON.stringify({ testCases }),
    }, localStorage.getItem("token"));
    await reloadProjects();
    } finally {
      setIsLoadingProjectChange(false);
    }
  };

  const updateTestCase = async (testCaseId, changes) => {
    setIsLoadingProjectChange(true);
    try {
    await apiRequest(`/api/workspace/testcases/${testCaseId}`, {
      method: "PATCH",
      body: JSON.stringify(changes),
    }, localStorage.getItem("token"));
    await reloadProjects();
    } finally {
      setIsLoadingProjectChange(false);
    }
  };
  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const selectedModule = selectedProject?.modules.find((module) => module.id === selectedModuleId);

  const navigate = (page) => {
    setActivePage(page);
    setSelectedProjectId(null);
    setSelectedModuleId(null);
  };

  const selectProject = (project) => {
    setActivePage("projects");
    setSelectedProjectId(project.id);
    setSelectedModuleId(null);
  };

  const selectModule = (module) => setSelectedModuleId(module.id);

  let pageContent;
  if (selectedProject && selectedModule) {
    pageContent = <SubmoduleDetailsPage project={selectedProject} module={selectedModule} onBack={() => setSelectedModuleId(null)} onAddTestCases={addTestCases} onUpdateTestCase={updateTestCase} onAssignmentSaved={reloadProjects} isSaving={isLoadingProjectChange} />;
  } else if (selectedProject) {
    pageContent = <ProjectDetailsPage project={selectedProject} onBack={() => setSelectedProjectId(null)} onSelectModule={selectModule} onCreateModule={createModule} isSaving={isLoadingProjectChange} />;
  } else {
    switch (activePage) {
      case "dashboard":
        pageContent = <DashboardPage projects={projects} onOpenProjects={() => navigate("projects")} onSelectProject={selectProject} />;
        break;
      case "organizations": pageContent = <OrganizationsPage />; break;
      case "projects": pageContent = <ProjectsPage projects={projects} loading={projectsLoading} error={projectsError} onCreateProject={createProject} onSelectProject={selectProject} />; break;
      case "users": pageContent = <UsersPage users={team || []} loading={team === null} error={teamError} token={localStorage.getItem("token")} onInviteSent={() => apiRequest("/api/auth/team", {}, localStorage.getItem("token")).then((result) => { setTeam(result.users || []); setTeamError(""); }).catch((error) => setTeamError(error.message))} />; break;
      case "roles": pageContent = <RolesPage roles={roles || []} loading={roles === null} error={rolesError} />; break;
      case "testSuites": pageContent = <TestSuitesPage projects={projects} />; break;
      case "testCases": pageContent = <TestCasesPage projects={projects} />; break;
      case "testRuns": pageContent = <TestRunsPage projects={projects} />; break;
      case "defects": pageContent = <DefectsPage projects={projects} />; break;
      case "reports": pageContent = <ReportsPage projects={projects} />; break;
      case "auditLogs": pageContent = <AuditLogsPage logs={activityLogs || []} loading={activityLogs === null} error={activityError} />; break;
      case "settings": pageContent = <SettingsPage user={user} />; break;
      default: pageContent = <DashboardPage projects={projects} onOpenProjects={() => navigate("projects")} onSelectProject={selectProject} />;
    }
  }

  return (
    <main className="admin-dashboard">
      <header className="dashboard-header">
        <a className="dashboard-brand" href="/" aria-label="TestManager dashboard" onClick={(event) => { event.preventDefault(); navigate("dashboard"); }}>
          <span className="brand-icon">T</span><span>TestManager</span>
        </a>
        <div className="dashboard-account">
          <div className="admin-avatar">{(user.name || user.email || "A").charAt(0).toUpperCase()}</div>
          <div className="dashboard-account-copy"><strong>{user.name || "Administrator"}</strong><span>Administrator</span></div>
          <button type="button" className="signout-button" onClick={onSignOut}>Sign out</button>
        </div>
      </header>
      <div className="dashboard-shell">
        <Sidebar activePage={activePage} onNavigate={navigate} />
        <main className="dashboard-content">{pageContent}</main>
      </div>
    </main>
  );
}
