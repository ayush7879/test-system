export default function PageHeader({ eyebrow, title, description, action }) {
  return (
    <div className="workspace-page-header">
      <div>
        {eyebrow && <p className="dashboard-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="workspace-page-action">{action}</div>}
    </div>
  );
}
