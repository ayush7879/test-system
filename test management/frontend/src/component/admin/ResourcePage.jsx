import PageHeader from "./PageHeader";

export default function ResourcePage({ eyebrow = "WORKSPACE", title, description, columns = [], rows = [], emptyText = "No records to show yet." }) {
  return (
    <div className="page-stack">
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <section className="dashboard-panel resource-panel">
        <div className="resource-table-wrap">
          <table className="resource-table">
            <thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id || `${title}-${index}`}>
                  {columns.map((column) => <td key={column.key}>{row[column.key] ?? "—"}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <div className="team-empty"><strong>{emptyText}</strong></div>}
        </div>
      </section>
    </div>
  );
}
