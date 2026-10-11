import { useEffect, useMemo, useState } from "react";
import apiRequest from "./apiRequest";
import TestExecutionPage from "./TestExecutionPage";
import { formatNumber } from "./projectData";

const links = [
  { id: "dashboard", label: "Dashboard", icon: "▦" },
  { id: "tests", label: "My Tests", icon: "☷" },
  { id: "runs", label: "Test Runs", icon: "▶" },
  { id: "cases", label: "Test Cases", icon: "▤" },
  { id: "defects", label: "Defects", icon: "⚑" },
  { id: "evidence", label: "Evidence", icon: "▧" },
  { id: "notifications", label: "Notifications", icon: "◉" },
  { id: "activity", label: "My Activity", icon: "◷" },
];

export default function TesterDashboard({ user, onSignOut }) {
  const [activePage, setActivePage] = useState("dashboard");
  const [testCases, setTestCases] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [activity, setActivity] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const token = localStorage.getItem("token");

  const loadTestCases = async () => {
    const result = await apiRequest("/api/workspace/tester/tests", {}, token);
    setTestCases(result.testCases || []);
    setError("");
    return result.testCases || [];
  };

  useEffect(() => {
    let isCurrent = true;
    Promise.all([
      apiRequest("/api/workspace/tester/tests", {}, token),
      apiRequest("/api/workspace/tester/executions", {}, token),
      apiRequest("/api/workspace/tester/attachments", {}, token),
      apiRequest("/api/workspace/activitylogs", {}, token),
    ]).then(([testResult, executionResult, attachmentResult, activityResult]) => {
      if (!isCurrent) return;
      setTestCases(testResult.testCases || []);
      setExecutions(executionResult.executions || []);
      setAttachments(attachmentResult.attachments || []);
      setActivity(activityResult.activityLogs || []);
    }).catch((loadError) => {
      if (isCurrent) setError(loadError.message);
    });
    return () => { isCurrent = false; };
  }, [token]);

  const stats = useMemo(() => ({
    assigned: testCases.length,
    inProgress: testCases.filter((item) => item.status === "In Progress").length,
    completed: testCases.filter((item) => ["Pass", "Fail", "Blocked"].includes(item.status)).length,
  }), [testCases]);

  const openCase = async (item) => {
    setError("");
    if (item.status !== "Pass" && item.status !== "Fail" && item.status !== "Blocked") {
      setIsSaving(true);
      try {
        await apiRequest(`/api/workspace/testcases/${item.id}/start`, { method: "POST" }, token);
        const refreshed = await loadTestCases();
        setSelectedCase(refreshed.find((testCase) => testCase.id === item.id) || { ...item, status: "In Progress" });
      } catch (openError) {
        setError(openError.message);
      } finally {
        setIsSaving(false);
      }
    } else {
      setSelectedCase(item);
    }
    setActivePage("execution");
  };

  const submitExecution = async ({ result, actualResult, comments, files }) => {
    setIsSaving(true);
    try {
      const attachmentIds = [];
      for (const file of files) {
        const form = new FormData();
        form.append("file", file);
        form.append("projectId", selectedCase.project.id);
        form.append("testCaseId", selectedCase.id);
        const uploadResult = await apiRequest("/api/workspace/attachments/upload", { method: "POST", body: form }, token);
        attachmentIds.push(uploadResult.attachment.id);
      }
      await apiRequest("/api/workspace/testexecutions", {
        method: "POST",
        body: JSON.stringify({ testCaseId: selectedCase.id, result, actualResult, comments, attachmentIds }),
      }, token);
      const refreshed = await loadTestCases();
      const nextExecutions = await apiRequest("/api/workspace/tester/executions", {}, token);
      setExecutions(nextExecutions.executions || []);
      setSelectedCase(null);
      setActivePage("tests");
      return refreshed;
    } finally {
      setIsSaving(false);
    }
  };

  const downloadEvidence = async (attachment) => {
    setError("");
    try {
      const response = await fetch(`/api/workspace/attachments/${attachment._id}/file`, { headers: { "auth-token": token } });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || "Unable to download evidence.");
      }
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = attachment.originalName;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch (downloadError) {
      setError(downloadError.message);
    }
  };

  const titleCase = (value) => value.charAt(0).toUpperCase() + value.slice(1);
  const casesTable = (items, allowRun = true) => (
    <div className="tester-table-wrap">
      <table className="tester-table">
        <thead><tr><th>ID</th><th>Test case</th><th>Project</th><th>Priority</th><th>Status</th><th /></tr></thead>
        <tbody>{items.map((item) => (
          <tr key={item.id}>
            <td className="tester-case-id">{item.caseId}</td>
            <td><strong>{item.title}</strong><small>{item.submodule?.name}</small></td>
            <td>{item.project?.name}</td>
            <td><span className={`tester-priority ${item.priority?.toLowerCase()}`}>{item.priority}</span></td>
            <td><span className={`tester-status ${String(item.status).toLowerCase().replace(/\s+/g, "-")}`}>{item.status}</span></td>
            <td>{allowRun && <button type="button" className="tester-row-action" onClick={() => openCase(item)}>{item.status === "In Progress" ? "Continue" : ["Pass", "Fail", "Blocked"].includes(item.status) ? "View" : "Start"}</button>}</td>
          </tr>
        ))}</tbody>
      </table>
      {!items.length && <div className="tester-empty"><strong>No test cases here</strong><span>Cases assigned to you will appear in My Tests.</span></div>}
    </div>
  );

  let content;
  if (activePage === "execution" && selectedCase) {
    content = <TestExecutionPage testCase={selectedCase} isSaving={isSaving} onCancel={() => { setSelectedCase(null); setActivePage("tests"); }} onSubmit={submitExecution} />;
  } else if (activePage === "dashboard") {
    content = (
      <div className="tester-page-stack">
        <div className="tester-page-heading"><div><p className="tester-eyebrow">TESTER WORKSPACE</p><h1>Hello, {user.name?.split(" ")[0] || "Tester"}</h1><p>Here are the tests assigned to you.</p></div><span className="tester-date-label">My work</span></div>
        <section className="tester-stats">
          <article><span className="tester-stat-icon assigned-icon">☷</span><div><p>Assigned</p><strong>{formatNumber(stats.assigned)}</strong></div></article>
          <article><span className="tester-stat-icon progress-icon">▶</span><div><p>In Progress</p><strong>{formatNumber(stats.inProgress)}</strong></div></article>
          <article><span className="tester-stat-icon completed-icon">✓</span><div><p>Completed</p><strong>{formatNumber(stats.completed)}</strong></div></article>
        </section>
        <section className="tester-panel"><div className="tester-panel-heading"><div><h2>My Tests</h2><p>Assigned test cases ready to run.</p></div><button type="button" className="inline-link" onClick={() => setActivePage("tests")}>View all</button></div>{error ? <p className="form-message error">{error}</p> : casesTable(testCases.slice(0, 6))}</section>
      </div>
    );
  } else if (activePage === "tests" || activePage === "cases") {
    content = <div className="tester-page-stack"><div className="tester-page-heading"><div><p className="tester-eyebrow">TEST WORKSPACE</p><h1>{activePage === "tests" ? "My Tests" : "Test Cases"}</h1><p>Assigned cases across your projects.</p></div></div><section className="tester-panel">{casesTable(testCases)}</section></div>;
  } else if (activePage === "runs") {
    content = <div className="tester-page-stack"><div className="tester-page-heading"><div><p className="tester-eyebrow">EXECUTION HISTORY</p><h1>Test Runs</h1><p>Your latest submitted test results.</p></div></div><section className="tester-panel"><div className="tester-history-list">{executions.map((execution) => <article className="tester-history-row" key={execution._id}><div><strong>{execution.testCase?.caseId} · {execution.testCase?.title}</strong><small>{execution.project?.name} · {new Date(execution.executedAt).toLocaleString()}</small></div><span className={`tester-status ${execution.result.toLowerCase()}`}>{execution.result}</span></article>)}{!executions.length && <div className="tester-empty"><strong>No runs yet</strong><span>Start an assigned test case to see it here.</span></div>}</div></section></div>;
  } else if (activePage === "defects") {
    const failed = testCases.filter((item) => item.status === "Fail" || item.status === "Blocked");
    content = <div className="tester-page-stack"><div className="tester-page-heading"><div><p className="tester-eyebrow">FOLLOW-UP</p><h1>Defects</h1><p>Failed or blocked cases assigned to you.</p></div></div><section className="tester-panel">{casesTable(failed, false)}</section></div>;
  } else if (activePage === "evidence") {
    content = <div className="tester-page-stack"><div className="tester-page-heading"><div><p className="tester-eyebrow">ATTACHMENTS</p><h1>Evidence</h1><p>Files you uploaded during test execution.</p></div></div><section className="tester-panel"><div className="tester-history-list">{attachments.map((attachment) => <article className="tester-history-row" key={attachment._id}><div><strong>{attachment.originalName}</strong><small>{attachment.project?.name} · {attachment.testCase?.caseId} · {new Date(attachment.createdAt).toLocaleString()}</small></div><button type="button" className="tester-row-action" onClick={() => downloadEvidence(attachment)}>Download</button></article>)}{!attachments.length && <div className="tester-empty"><strong>No evidence uploaded</strong><span>Screenshots, videos, PDFs, and logs appear here after an execution.</span></div>}</div></section></div>;
  } else if (activePage === "activity") {
    content = <div className="tester-page-stack"><div className="tester-page-heading"><div><p className="tester-eyebrow">WORKSPACE HISTORY</p><h1>My Activity</h1><p>Your recent test actions.</p></div></div><section className="tester-panel"><div className="tester-history-list">{activity.map((entry) => <article className="tester-history-row" key={entry._id}><div><strong>{titleCase(entry.action)} {entry.entityType}</strong><small>{new Date(entry.createdAt).toLocaleString()}</small></div></article>)}{!activity.length && <div className="tester-empty"><strong>No recent activity</strong></div>}</div></section></div>;
  } else {
    content = <div className="tester-page-stack"><div className="tester-page-heading"><div><p className="tester-eyebrow">WORKSPACE</p><h1>Notifications</h1><p>Assignment and execution updates.</p></div></div><section className="tester-panel"><div className="tester-empty"><strong>You’re all caught up</strong><span>New assigned tests will appear in My Tests.</span></div></section></div>;
  }

  return (
    <main className="tester-dashboard">
      <header className="tester-header"><a className="tester-brand" href="/" onClick={(event) => { event.preventDefault(); setActivePage("dashboard"); }}><span className="brand-icon">T</span>TestManager</a><div className="tester-account"><div className="tester-avatar">{(user.name || user.email).charAt(0).toUpperCase()}</div><div><strong>{user.name}</strong><small>Tester</small></div><button type="button" className="signout-button" onClick={onSignOut}>Sign out</button></div></header>
      <div className="tester-shell"><aside className="tester-sidebar"><p className="tester-nav-label">MY WORKSPACE</p>{links.map((link) => <button type="button" key={link.id} className={`tester-nav-link ${activePage === link.id ? "active" : ""}`} onClick={() => { setSelectedCase(null); setActivePage(link.id); }}><span>{link.icon}</span>{link.label}</button>)}</aside><section className="tester-content">{error && activePage !== "dashboard" && <p className="form-message error">{error}</p>}{content}</section></div>
    </main>
  );
}
