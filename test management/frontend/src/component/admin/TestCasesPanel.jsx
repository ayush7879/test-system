import { useRef, useState } from "react";
import { formatNumber } from "./projectData";

const statuses = ["Not run", "Pass", "Fail", "Blocked"];
const emptyCase = { title: "", testType: "Functional", preconditions: "", steps: "", expectedResult: "", testData: "", priority: "Medium" };

function normalizeHeader(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"' && inQuotes && text[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      inQuotes = !inQuotes;
    } else if (character === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => String(value).trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  row.push(cell);
  if (row.some((value) => String(value).trim())) rows.push(row);
  return rows;
}

function parseSheetRows(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map(normalizeHeader);
  const titleIndex = headers.findIndex((header) => ["title", "testcase", "testcasename", "name", "summary"].includes(header));
  if (titleIndex < 0) {
    throw new Error("The Excel sheet needs a column named Title, Test Case, or Name.");
  }

  const findIndex = (...names) => headers.findIndex((header) => names.includes(header));
  const typeIndex = findIndex("type", "testtype", "category");
  const preconditionsIndex = findIndex("preconditions", "prerequisites", "setup");
  const stepsIndex = findIndex("steps", "teststeps", "procedure", "action");
  const expectedIndex = findIndex("expectedresult", "expected", "result");
  const testDataIndex = findIndex("testdata", "data", "inputdata");
  const priorityIndex = findIndex("priority", "severity");
  const statusIndex = findIndex("status", "resultstatus");

  return rows.slice(1).map((row, index) => {
    const title = String(row[titleIndex] || "").trim();
    if (!title) return null;
    const rawStatus = String(statusIndex < 0 ? "Not run" : row[statusIndex] || "Not run").trim().toLowerCase();
    const status = statuses.find((candidate) => candidate.toLowerCase() === rawStatus) || "Not run";
    const priority = String(priorityIndex < 0 ? "Medium" : row[priorityIndex] || "Medium").trim();
    return {
      id: `case-${crypto.randomUUID()}`,
      caseId: `TC-${Date.now().toString().slice(-6)}-${index + 1}`,
      title,
      testType: typeIndex < 0 ? "Functional" : String(row[typeIndex] || "Functional").trim(),
      preconditions: preconditionsIndex < 0 ? "" : String(row[preconditionsIndex] || "").trim(),
      steps: stepsIndex < 0 ? "" : String(row[stepsIndex] || "").trim(),
      expectedResult: expectedIndex < 0 ? "" : String(row[expectedIndex] || "").trim(),
      testData: testDataIndex < 0 ? "" : String(row[testDataIndex] || "").trim(),
      priority: ["low", "medium", "high", "critical"].includes(priority.toLowerCase()) ? priority[0].toUpperCase() + priority.slice(1).toLowerCase() : "Medium",
      status,
      createdAt: new Date().toISOString(),
    };
  }).filter(Boolean);
}

export default function TestCasesPanel({ module, onAddTestCases, onUpdateTestCase, isSaving }) {
  const [entryMode, setEntryMode] = useState("manual");
  const [testCase, setTestCase] = useState(emptyCase);
  const [editingCaseId, setEditingCaseId] = useState(null);
  const [editForm, setEditForm] = useState(emptyCase);
  const [feedback, setFeedback] = useState("");
  const [isError, setIsError] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInput = useRef(null);
  const testCases = module.testCases || [];

  const addTestCase = async (event) => {
    event.preventDefault();
    const title = testCase.title.trim();
    if (!title) {
      setIsError(true);
      setFeedback("Enter a test case title.");
      return;
    }
    setIsUploading(true);
    try {
      await onAddTestCases([{
        ...testCase,
        title,
        status: "Not run",
      }]);
      setTestCase(emptyCase);
      setIsError(false);
      setFeedback("Test case added.");
    } catch (error) {
      setIsError(true);
      setFeedback(error.message || "Unable to add test case.");
    } finally {
      setIsUploading(false);
    }
  };

  const startEditing = (item) => {
    setEditingCaseId(item.id);
    setEditForm({ title: item.title, testType: item.testType || "Functional", preconditions: item.preconditions || "", steps: item.steps || "", expectedResult: item.expectedResult || "", testData: item.testData || "", priority: item.priority || "Medium", status: item.status || "Not run" });
    setFeedback("");
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    setIsUploading(true);
    try {
      await onUpdateTestCase(editingCaseId, editForm);
      setEditingCaseId(null);
      setIsError(false);
      setFeedback("Test case updated.");
    } catch (error) {
      setIsError(true);
      setFeedback(error.message || "Unable to update test case.");
    } finally {
      setIsUploading(false);
    }
  };

  const importWorkbook = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setFeedback("");
    try {
      let rows;
      if (file.name.toLowerCase().endsWith(".csv")) {
        rows = parseCsv(await file.text());
      } else if (file.name.toLowerCase().endsWith(".xlsx")) {
        const { readSheet } = await import("read-excel-file/browser");
        rows = await readSheet(file);
      } else {
        throw new Error("Upload an .xlsx or .csv file. Legacy .xls files are not supported.");
      }
      const imported = parseSheetRows(rows);
      if (!imported.length) throw new Error("No test cases were found. Check that rows contain a title.");
      await onAddTestCases(imported);
      setIsError(false);
      setFeedback(`${formatNumber(imported.length)} test case${imported.length === 1 ? "" : "s"} imported.`);
    } catch (error) {
      setIsError(true);
      setFeedback(error.message || "Unable to read this workbook.");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  return (
    <section className="dashboard-panel test-cases-panel">
      <div className="team-panel-heading test-cases-heading">
        <div><h2>Test cases</h2><p>Add cases manually or import a spreadsheet.</p></div>
        <span className="team-count">{formatNumber(testCases.length)}</span>
      </div>
      <div className="case-entry-tabs" role="tablist" aria-label="Test case entry method">
        <button type="button" role="tab" aria-selected={entryMode === "manual"} className={entryMode === "manual" ? "active" : ""} onClick={() => setEntryMode("manual")}>Add manually</button>
        <button type="button" role="tab" aria-selected={entryMode === "excel"} className={entryMode === "excel" ? "active" : ""} onClick={() => setEntryMode("excel")}>Upload Excel</button>
      </div>

      {entryMode === "manual" ? (
        <form className="manual-case-form" onSubmit={addTestCase}>
          <div className="input-group"><label htmlFor="case-title">Test case title</label><input id="case-title" value={testCase.title} onChange={(event) => setTestCase({ ...testCase, title: event.target.value })} placeholder="e.g. User can complete checkout" required /></div>
          <div className="input-group"><label htmlFor="case-type">Test type</label><select id="case-type" value={testCase.testType} onChange={(event) => setTestCase({ ...testCase, testType: event.target.value })}><option>Functional</option><option>Regression</option><option>Smoke</option><option>Integration</option><option>Performance</option><option>Security</option><option>Usability</option></select></div>
          <div className="input-group"><label htmlFor="case-preconditions">Preconditions</label><textarea id="case-preconditions" rows="2" value={testCase.preconditions} onChange={(event) => setTestCase({ ...testCase, preconditions: event.target.value })} placeholder="Required state before running" /></div>
          <div className="input-group"><label htmlFor="case-steps">Test steps</label><textarea id="case-steps" rows="3" value={testCase.steps} onChange={(event) => setTestCase({ ...testCase, steps: event.target.value })} placeholder="One step per line" /></div>
          <div className="input-group"><label htmlFor="case-expected">Expected result</label><textarea id="case-expected" rows="2" value={testCase.expectedResult} onChange={(event) => setTestCase({ ...testCase, expectedResult: event.target.value })} placeholder="What should happen?" /></div>
          <div className="input-group"><label htmlFor="case-test-data">Test data</label><textarea id="case-test-data" rows="2" value={testCase.testData} onChange={(event) => setTestCase({ ...testCase, testData: event.target.value })} placeholder="Optional input data" /></div>
          <div className="input-group"><label htmlFor="case-priority">Priority</label><select id="case-priority" value={testCase.priority} onChange={(event) => setTestCase({ ...testCase, priority: event.target.value })}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></div>
          <button type="submit" className="login-button case-submit" disabled={isSaving || isUploading}>{isSaving || isUploading ? "Saving…" : "Add test case"}</button>
        </form>
      ) : (
        <div className="excel-upload-panel">
          <div className="excel-upload-icon">⇧</div>
          <h3>Import test cases from Excel</h3>
          <p>Upload .xlsx or .csv. Include a <strong>Title</strong> column; optional columns: Type, Preconditions, Steps, Expected Result, Test Data, Priority, Status.</p>
          <input ref={fileInput} className="visually-hidden-file" type="file" accept=".xlsx,.csv" onChange={importWorkbook} />
          <button type="button" className="dashboard-primary-action" onClick={() => fileInput.current?.click()} disabled={isSaving || isUploading}>{isSaving || isUploading ? "Importing…" : "Choose spreadsheet"}</button>
          <button type="button" className="inline-link template-download" onClick={() => {
            const csv = [
              ["Title", "Type", "Preconditions", "Steps", "Expected Result", "Test Data", "Priority", "Status"],
              ["User can sign in", "Functional", "A valid user account exists", "Open sign in page; enter valid credentials", "User is taken to the dashboard", "qa@example.com", "High", "Not run"],
            ].map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\r\n");
            const downloadUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
            const link = document.createElement("a");
            link.href = downloadUrl;
            link.download = "test-cases-template.csv";
            link.click();
            URL.revokeObjectURL(downloadUrl);
          }}>Download Excel / CSV template</button>
        </div>
      )}

      {feedback && <p className={`form-message ${isError ? "error" : "success"}`} role="status">{feedback}</p>}
      <div className="test-case-list">
        <div className="case-list-heading"><strong>Cases in this submodule</strong><span>{formatNumber(testCases.length)} total</span></div>
        {testCases.length ? testCases.map((item) => (
          <article className="test-case-row" key={item.id}>
            {editingCaseId === item.id ? (
              <form className="edit-case-form" onSubmit={saveEdit}>
                <div className="input-group"><label htmlFor={`edit-title-${item.id}`}>Test case title</label><input id={`edit-title-${item.id}`} value={editForm.title} onChange={(event) => setEditForm({ ...editForm, title: event.target.value })} required /></div>
                <div className="input-group"><label htmlFor={`edit-type-${item.id}`}>Test type</label><select id={`edit-type-${item.id}`} value={editForm.testType || "Functional"} onChange={(event) => setEditForm({ ...editForm, testType: event.target.value })}><option>Functional</option><option>Regression</option><option>Smoke</option><option>Integration</option><option>Performance</option><option>Security</option><option>Usability</option></select></div>
                <div className="input-group"><label htmlFor={`edit-preconditions-${item.id}`}>Preconditions</label><textarea id={`edit-preconditions-${item.id}`} rows="2" value={editForm.preconditions || ""} onChange={(event) => setEditForm({ ...editForm, preconditions: event.target.value })} /></div>
                <div className="input-group"><label htmlFor={`edit-steps-${item.id}`}>Test steps</label><textarea id={`edit-steps-${item.id}`} rows="2" value={editForm.steps} onChange={(event) => setEditForm({ ...editForm, steps: event.target.value })} /></div>
                <div className="input-group"><label htmlFor={`edit-expected-${item.id}`}>Expected result</label><textarea id={`edit-expected-${item.id}`} rows="2" value={editForm.expectedResult} onChange={(event) => setEditForm({ ...editForm, expectedResult: event.target.value })} /></div>
                <div className="input-group"><label htmlFor={`edit-data-${item.id}`}>Test data</label><textarea id={`edit-data-${item.id}`} rows="2" value={editForm.testData || ""} onChange={(event) => setEditForm({ ...editForm, testData: event.target.value })} /></div>
                <div className="input-group"><label htmlFor={`edit-priority-${item.id}`}>Priority</label><select id={`edit-priority-${item.id}`} value={editForm.priority} onChange={(event) => setEditForm({ ...editForm, priority: event.target.value })}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></div>
                <div className="input-group"><label htmlFor={`edit-status-${item.id}`}>Status</label><select id={`edit-status-${item.id}`} value={editForm.status} onChange={(event) => setEditForm({ ...editForm, status: event.target.value })}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></div>
                <div className="edit-case-actions"><button type="submit" className="dashboard-primary-action" disabled={isSaving || isUploading}>{isUploading ? "Saving…" : "Save changes"}</button><button type="button" className="inline-link" onClick={() => setEditingCaseId(null)}>Cancel</button></div>
              </form>
            ) : (
              <>
                <span className="case-reference">{item.caseId}</span>
                <div className="case-details"><strong>{item.title}</strong>{item.steps && <span>{item.steps}</span>}</div>
                <span className={`case-priority ${String(item.priority || "Medium").toLowerCase()}`}>{item.priority || "Medium"}</span>
                <span className={`case-status ${String(item.status || "Not run").toLowerCase().replace(/\s+/g, "-")}`}>{item.status || "Not run"}</span>
                <button type="button" className="case-edit-button" onClick={() => startEditing(item)} aria-label={`Edit ${item.caseId}`} title="Edit test case">Edit</button>
              </>
            )}
          </article>
        )) : <div className="team-empty case-empty"><strong>No test cases in this submodule</strong><span>Add one manually or import a spreadsheet above.</span></div>}
      </div>
    </section>
  );
}
