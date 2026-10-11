import { useEffect, useState } from "react";
import apiRequest from "./apiRequest";

export default function AssignmentPanel({ project, module, token, onAssigned }) {
  const [isOpen, setIsOpen] = useState(false);
  const [testers, setTesters] = useState([]);
  const [selectedCases, setSelectedCases] = useState([]);
  const [selectedTesters, setSelectedTesters] = useState([]);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const cases = module.testCases || [];

  useEffect(() => {
    if (!isOpen) return;
    let isCurrent = true;
    apiRequest(`/api/workspace/projects/${project.id}/testers`, {}, token)
      .then((result) => { if (isCurrent) setTesters(result.testers || []); })
      .catch((error) => { if (isCurrent) { setTesters([]); setMessage(error.message); setIsError(true); } });
    return () => { isCurrent = false; };
  }, [isOpen, project.id, token]);

  const toggle = (values, setValues, id) => setValues(values.includes(id) ? values.filter((value) => value !== id) : [...values, id]);

  const saveAssignments = async (event) => {
    event.preventDefault();
    if (!selectedCases.length || !selectedTesters.length) {
      setIsError(true);
      setMessage("Select at least one test case and one Tester.");
      return;
    }
    setIsLoading(true);
    setMessage("");
    try {
      const result = await apiRequest(`/api/workspace/submodules/${module.id}/assignments`, {
        method: "POST",
        body: JSON.stringify({ testCaseIds: selectedCases, testerIds: selectedTesters }),
      }, token);
      const distribution = result.assignments.map((assignment) => `${assignment.testerName}: ${assignment.testCaseIds.length}`).join(" · ");
      setIsError(false);
      setMessage(`Assignments saved. ${distribution}`);
      setSelectedCases([]);
      setSelectedTesters([]);
      await onAssigned();
    } catch (error) {
      setIsError(true);
      setMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="assignment-panel dashboard-panel">
      <div className="team-panel-heading">
        <div><h2>Tester assignments</h2><p>Assign selected cases evenly across testers. Reassignment returns a case to Not run.</p></div>
        <button type="button" className="dashboard-primary-action" onClick={() => { setIsOpen(!isOpen); setMessage(""); }}>{isOpen ? "Close" : "Assign test cases"}</button>
      </div>
      {message && <p className={`form-message ${isError ? "error" : "success"}`} role="status">{message}</p>}
      {isOpen && (
        <form className="assignment-form" onSubmit={saveAssignments}>
          <fieldset className="assignment-fieldset">
            <legend>Select test cases <span>{selectedCases.length} selected</span></legend>
            {cases.length ? cases.map((testCase) => (
              <label className="assignment-option" key={testCase.id}>
                <input type="checkbox" checked={selectedCases.includes(testCase.id)} onChange={() => toggle(selectedCases, setSelectedCases, testCase.id)} />
                <span><strong>{testCase.caseId}</strong> {testCase.title}</span>
                <small className={`case-status ${String(testCase.status).toLowerCase().replace(/\s+/g, "-")}`}>{testCase.status}</small>
              </label>
            )) : <p className="assignment-empty">Add test cases before assigning them.</p>}
          </fieldset>
          <fieldset className="assignment-fieldset">
            <legend>Assign to testers <span>{selectedTesters.length} selected</span></legend>
            {testers.length ? testers.map((tester) => (
              <label className="assignment-option" key={tester.id}>
                <input type="checkbox" checked={selectedTesters.includes(tester.id)} onChange={() => toggle(selectedTesters, setSelectedTesters, tester.id)} />
                <span><strong>{tester.name}</strong><small>{tester.email}</small></span>
                <span className="member-role">Tester</span>
              </label>
            )) : <p className="assignment-empty">{isError ? "Unable to load testers." : "No active Tester accounts are available."}</p>}
          </fieldset>
          <div className="assignment-form-footer">
            <p>Cases are split into contiguous, even-sized groups. Any remainder goes to the first selected testers.</p>
            <button type="submit" className="dashboard-primary-action" disabled={isLoading || !cases.length || !testers.length}>{isLoading ? "Saving assignments…" : "Save assignments"}</button>
          </div>
        </form>
      )}
      {!isOpen && cases.length > 0 && (
        <div className="assignment-current-list">
          {cases.filter((testCase) => testCase.assignedTester).map((testCase) => (
            <div className="assignment-current-row" key={testCase.id}>
              <span><strong>{testCase.caseId}</strong> {testCase.title}</span>
              <span>{testCase.assignedTesterName || testers.find((tester) => tester.id === testCase.assignedTester)?.name || "Assigned"}</span>
            </div>
          ))}
          {!cases.some((testCase) => testCase.assignedTester) && <p className="assignment-empty">No test cases assigned yet.</p>}
        </div>
      )}
    </section>
  );
}
