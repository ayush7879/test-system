const STORAGE_KEY = "testmanager-projects-v1";

export function readLegacyProjectsForMigration() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function summarizeModules(modules = []) {
  return modules.reduce((total, module) => ({
    pass: total.pass + (module.summary?.pass || 0),
    fail: total.fail + (module.summary?.fail || 0),
    blocked: total.blocked + (module.summary?.blocked || 0),
    notRun: total.notRun + (module.summary?.notRun || 0),
  }), { pass: 0, fail: 0, blocked: 0, notRun: 0 });
}

export function summarizeProject(project) {
  const summary = summarizeModules(project.modules);
  const testCases = summary.pass + summary.fail + summary.blocked + summary.notRun;
  return {
    ...summary,
    testCases,
    executions: summary.pass + summary.fail,
    passRate: testCases ? Math.round((summary.pass / testCases) * 100) : 0,
  };
}

export function percentages(summary) {
  const total = summary.pass + summary.fail + summary.blocked + summary.notRun;
  if (!total) return { pass: 0, fail: 0, blocked: 0, notRun: 0 };
  return {
    pass: Math.round((summary.pass / total) * 100),
    fail: Math.round((summary.fail / total) * 100),
    blocked: Math.round((summary.blocked / total) * 100),
    notRun: Math.round((summary.notRun / total) * 100),
  };
}

export function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}
