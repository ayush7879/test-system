const navigation = [
  { id: "dashboard", label: "Dashboard", icon: "▦" },
  { id: "organizations", label: "Organizations", icon: "▤" },
  { id: "projects", label: "Projects", icon: "▣" },
  { id: "users", label: "Users", icon: "♙" },
  { id: "roles", label: "Roles", icon: "◇" },
  { id: "testSuites", label: "Test Suites", icon: "▧" },
  { id: "testCases", label: "Test Cases", icon: "☷" },
  { id: "testRuns", label: "Test Runs", icon: "▶" },
  { id: "defects", label: "Defects", icon: "⚑" },
  { id: "reports", label: "Reports", icon: "▥" },
  { id: "auditLogs", label: "Audit Logs", icon: "◷" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

export default function Sidebar({ activePage, onNavigate }) {
  return (
    <aside className="dashboard-sidebar" aria-label="Admin navigation">
      <p className="sidebar-label">WORKSPACE</p>
      <nav className="sidebar-navigation">
        {navigation.map((item) => (
          <button
            type="button"
            key={item.id}
            className={`sidebar-link ${activePage === item.id ? "active" : ""}`}
            onClick={() => onNavigate(item.id)}
            aria-current={activePage === item.id ? "page" : undefined}
          >
            <span className="sidebar-link-icon" aria-hidden="true">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
