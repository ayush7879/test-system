import { formatNumber, percentages } from "./projectData";

const statuses = [
  { key: "pass", label: "Pass", color: "pass" },
  { key: "fail", label: "Fail", color: "fail" },
  { key: "blocked", label: "Blocked", color: "blocked" },
  { key: "notRun", label: "Not run", color: "not-run" },
];

export default function TestSummary({ summary, title = "Test summary", compact = false }) {
  const rates = percentages(summary);
  const total = summary.pass + summary.fail + summary.blocked + summary.notRun;

  return (
    <section className={`summary-panel ${compact ? "summary-compact" : ""}`}>
      <div className="summary-heading">
        <div>
          <h2>{title}</h2>
          <p>{formatNumber(total)} test cases</p>
        </div>
        {!compact && <span className="summary-pass-rate">{rates.pass}% passed</span>}
      </div>
      <div className="summary-bars" role="img" aria-label={statuses.map(({ key, label }) => `${label} ${rates[key]}%`).join(", ")}>
        {statuses.map(({ key, color }) => (
          <span key={key} className={`summary-bar-segment ${color}`} style={{ width: `${rates[key]}%` }} />
        ))}
      </div>
      <div className="summary-rows">
        {statuses.map(({ key, label, color }) => (
          <div className="summary-row" key={key}>
            <span className={`summary-dot ${color}`} />
            <span className="summary-label">{label}</span>
            <strong>{formatNumber(summary[key] || 0)}</strong>
            <span className="summary-percent">{rates[key]}%</span>
          </div>
        ))}
      </div>
    </section>
  );
}
