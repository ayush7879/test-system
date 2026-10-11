import { useState } from "react";

const results = ["Pass", "Fail", "Blocked"];

export default function TestExecutionPage({ testCase, isSaving, onCancel, onSubmit }) {
  const [actualResult, setActualResult] = useState("");
  const [comments, setComments] = useState("");
  const [result, setResult] = useState("Pass");
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      await onSubmit({ result, actualResult, comments, files });
    } catch (submitError) {
      setError(submitError.message || "Unable to submit this execution.");
    }
  };

  return (
    <div className="tester-page-stack">
      <button type="button" className="tester-back-link" onClick={onCancel}>← Back to My Tests</button>
      <form className="execution-card" onSubmit={handleSubmit}>
        <div className="execution-title-row">
          <div><p className="tester-eyebrow">TEST EXECUTION</p><h1>{testCase.caseId} — {testCase.title}</h1></div>
          <span className={`tester-priority ${testCase.priority?.toLowerCase()}`}>{testCase.priority} priority</span>
        </div>
        <div className="execution-context">
          <span><small>Project</small><strong>{testCase.project?.name}</strong></span>
          <span><small>Module</small><strong>{testCase.submodule?.name}</strong></span>
          <span><small>Type</small><strong>{testCase.testType || "Functional"}</strong></span>
        </div>
        <section className="execution-detail"><h2>Preconditions</h2><p>{testCase.preconditions || "No preconditions specified."}</p></section>
        {testCase.testData && <section className="execution-detail"><h2>Test data</h2><pre>{typeof testCase.testData === "string" ? testCase.testData : JSON.stringify(testCase.testData, null, 2)}</pre></section>}
        <section className="execution-detail"><h2>Expected result</h2><p>{testCase.expectedResult || "No expected result specified."}</p></section>
        <section className="execution-detail"><h2>Test steps</h2><ol className="execution-steps">{String(testCase.steps || "No steps specified.").split(/\r?\n/).filter(Boolean).map((step, index) => <li key={`${index}-${step}`}>{step}</li>)}</ol></section>
        {testCase.latestExecution?.actualResult && <section className="execution-detail previous-result"><h2>Previous actual result</h2><p>{testCase.latestExecution.actualResult}</p></section>}
        <div className="input-group execution-input"><label htmlFor="actual-result">Actual result</label><textarea id="actual-result" rows="3" value={actualResult} onChange={(event) => setActualResult(event.target.value)} placeholder="Describe what happened while running the test" /></div>
        <fieldset className="execution-result-options"><legend>Result</legend>{results.map((value) => <label key={value} className={`result-choice ${value.toLowerCase()} ${result === value ? "selected" : ""}`}><input type="radio" name="execution-result" value={value} checked={result === value} onChange={() => setResult(value)} />{value}</label>)}</fieldset>
        <div className="input-group execution-input"><label htmlFor="evidence-files">Evidence</label><input id="evidence-files" type="file" multiple accept="image/*,video/mp4,video/webm,.pdf,.txt,.csv,.log,.zip" onChange={(event) => setFiles(Array.from(event.target.files || []))} /><small>Screenshots, videos, PDFs, CSV or log files. 25 MB per file maximum.</small></div>
        {files.length > 0 && <ul className="evidence-file-list">{files.map((file) => <li key={`${file.name}-${file.lastModified}`}>{file.name}</li>)}</ul>}
        <div className="input-group execution-input"><label htmlFor="execution-comments">Comments</label><textarea id="execution-comments" rows="3" value={comments} onChange={(event) => setComments(event.target.value)} placeholder="Optional notes for the team" /></div>
        {error && <p className="form-message error" role="alert">{error}</p>}
        <div className="execution-footer"><button type="button" className="tester-secondary-button" onClick={onCancel}>Cancel</button><button type="submit" className="dashboard-primary-action" disabled={isSaving}>{isSaving ? "Submitting…" : "Submit execution"}</button></div>
      </form>
    </div>
  );
}
