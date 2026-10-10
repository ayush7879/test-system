const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const ActivityLog = require('../model/ActivityLog');
const Attachment = require('../model/Attachment');
const Project = require('../model/Project');
const Role = require('../model/Role');
const Submodule = require('../model/Submodule');
const TestCase = require('../model/TestCase');
const TestExecution = require('../model/TestExecution');
const User = require('../model/User');
const fetchUser = require('../middleware/fetchUser');

const router = express.Router();
const testCaseStatuses = ['Not run', 'Pass', 'Fail', 'Blocked'];
const testPriorities = ['Low', 'Medium', 'High', 'Critical'];

function validationErrors(req, res) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return false;
  res.status(400).json({ success: false, errors: errors.array() });
  return true;
}

function validId(value) {
  return mongoose.isValidObjectId(value);
}

async function requireAdmin(req, res, next) {
  const user = req.workspaceUser;
  if (!user || String(user.role || '').toLowerCase() !== 'admin' || user.mustChangePassword) {
    return res.status(403).json({ success: false, message: 'An active Admin account is required' });
  }
  return next();
}

async function requireWorkspaceUser(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.mustChangePassword || user.isActive === false) {
      return res.status(403).json({ success: false, message: 'An active workspace account is required' });
    }
    req.workspaceUser = user;
    return next();
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to verify workspace access' });
  }
}

async function writeActivity({ actor, action, entityType, entityId, project, details = {} }) {
  await ActivityLog.create({ actor, action, entityType, entityId, project, details });
}

async function ownedProject(projectId, ownerId) {
  if (!validId(projectId)) return null;
  return Project.findOne({ _id: projectId, owner: ownerId });
}

async function activeProject(projectId) {
  if (!validId(projectId)) return null;
  return Project.findOne({ _id: projectId, status: 'Active' });
}

function serializeTestCase(testCase) {
  return {
    id: String(testCase._id),
    caseId: testCase.caseId,
    title: testCase.title,
    steps: testCase.steps,
    expectedResult: testCase.expectedResult,
    testData: testCase.testData,
    priority: testCase.priority,
    status: testCase.status,
    createdAt: testCase.createdAt,
    updatedAt: testCase.updatedAt,
  };
}

async function serializeProject(project) {
  const submodules = await Submodule.find({ project: project._id }).sort({ createdAt: 1 }).lean();
  const modules = await Promise.all(submodules.map(async (submodule) => {
    const cases = await TestCase.find({ submodule: submodule._id }).sort({ createdAt: 1 }).lean();
    const summary = {
      pass: submodule.summary?.pass || 0,
      fail: submodule.summary?.fail || 0,
      blocked: submodule.summary?.blocked || 0,
      notRun: submodule.summary?.notRun || 0,
    };
    cases.forEach((testCase) => {
      const key = testCase.status === 'Not run' ? 'notRun' : testCase.status.toLowerCase();
      summary[key] += 1;
    });
    return {
      id: String(submodule._id),
      name: submodule.name,
      description: submodule.description,
      summary,
      testCases: cases.map(serializeTestCase),
    };
  }));

  return {
    id: String(project._id),
    name: project.name,
    code: project.code,
    description: project.description,
    owner: String(project.owner),
    startDate: project.startDate,
    dueDate: project.dueDate,
    status: project.status,
    updatedAt: project.updatedAt.toISOString().slice(0, 10),
    modules,
  };
}

router.use(fetchUser, requireWorkspaceUser);

router.get('/roles', requireAdmin, async (req, res) => {
  try {
    const defaults = [
      { name: 'Admin', description: 'Manage projects, users, and workspace settings', permissions: ['workspace:manage', 'users:manage', 'projects:manage'] },
      { name: 'Tester', description: 'Execute assigned test cases', permissions: ['testcases:read', 'executions:create'] },
      { name: 'QA Lead', description: 'Review test plans and execution results', permissions: ['testcases:read', 'executions:read', 'reports:read'] },
    ];
    for (const role of defaults) {
      try {
        await Role.updateOne({ name: role.name }, { $setOnInsert: role }, { upsert: true });
      } catch (error) {
        if (error.code !== 11000) throw error;
      }
    }
    return res.json({ success: true, roles: await Role.find().sort({ name: 1 }).lean() });
  } catch (error) {
    console.error('Loading roles failed:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to load roles' });
  }
});

router.get('/projects', async (req, res) => {
  try {
    const isAdmin = String(req.workspaceUser.role || '').toLowerCase() === 'admin';
    const filter = isAdmin ? { owner: req.workspaceUser._id } : { status: 'Active' };
    const projects = await Project.find(filter).sort({ updatedAt: -1 });
    return res.json({ success: true, projects: await Promise.all(projects.map(serializeProject)) });
  } catch (error) {
    console.error('Loading projects failed:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to load projects' });
  }
});

router.post(
  '/projects',
  requireAdmin,
  [
    body('name').trim().isLength({ min: 2 }).withMessage('Project name must be at least 2 characters'),
    body('code').trim().isLength({ min: 2, max: 12 }).withMessage('Project code must be 2 to 12 characters'),
    body('description').optional().isString(),
    body('moduleName').optional().trim().isLength({ min: 1 }).withMessage('Submodule name cannot be blank'),
  ],
  async (req, res) => {
    if (validationErrors(req, res)) return;
    let project;
    try {
      project = await Project.create({
        name: req.body.name.trim(),
        code: req.body.code.trim().toUpperCase(),
        description: (req.body.description || '').trim(),
        owner: req.workspaceUser._id,
        startDate: req.body.startDate || null,
        dueDate: req.body.dueDate || null,
      });
      if (req.body.moduleName?.trim()) {
        await Submodule.create({ project: project._id, name: req.body.moduleName.trim(), summary: req.body.moduleSummary || undefined, createdBy: req.workspaceUser._id });
      }
      await writeActivity({ actor: req.workspaceUser._id, action: 'created', entityType: 'Project', entityId: project._id, project: project._id, details: { name: project.name, code: project.code } });
      return res.status(201).json({ success: true, project: await serializeProject(project) });
    } catch (error) {
      if (project) {
        await Submodule.deleteMany({ project: project._id });
        await Project.deleteOne({ _id: project._id });
      }
      if (error.code === 11000) return res.status(409).json({ success: false, message: 'You already have a project with that code' });
      console.error('Creating project failed:', error.message);
      return res.status(500).json({ success: false, message: 'Unable to create project' });
    }
  },
);

router.patch('/projects/:projectId', requireAdmin, [body('name').optional().trim().isLength({ min: 2 }), body('description').optional().isString(), body('code').optional().trim().isLength({ min: 2, max: 12 })], async (req, res) => {
  if (validationErrors(req, res)) return;
  try {
    const project = await ownedProject(req.params.projectId, req.workspaceUser._id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
    for (const field of ['name', 'description', 'code', 'startDate', 'dueDate', 'status']) {
      if (req.body[field] !== undefined) project[field] = field === 'code' ? req.body[field].trim().toUpperCase() : req.body[field];
    }
    await project.save();
    await writeActivity({ actor: req.workspaceUser._id, action: 'updated', entityType: 'Project', entityId: project._id, project: project._id, details: req.body });
    return res.json({ success: true, project: await serializeProject(project) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'You already have a project with that code' });
    return res.status(500).json({ success: false, message: 'Unable to update project' });
  }
});

router.delete('/projects/:projectId', requireAdmin, async (req, res) => {
  try {
    const project = await ownedProject(req.params.projectId, req.workspaceUser._id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
    const modules = await Submodule.find({ project: project._id }, '_id').lean();
    const moduleIds = modules.map((module) => module._id);
    const cases = await TestCase.find({ project: project._id }, '_id').lean();
    const caseIds = cases.map((testCase) => testCase._id);
    await Attachment.deleteMany({ project: project._id });
    await TestExecution.deleteMany({ project: project._id });
    await TestCase.deleteMany({ project: project._id });
    await Submodule.deleteMany({ _id: { $in: moduleIds } });
    await Project.deleteOne({ _id: project._id });
    await writeActivity({ actor: req.workspaceUser._id, action: 'deleted', entityType: 'Project', entityId: project._id, project: project._id, details: { caseCount: caseIds.length, submoduleCount: moduleIds.length } });
    return res.json({ success: true });
  } catch (error) {
    console.error('Deleting project failed:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to delete project' });
  }
});

router.post('/projects/:projectId/submodules', requireAdmin, [body('name').trim().isLength({ min: 1 }).withMessage('Submodule name is required'), body('description').optional().isString(), body('summary').optional().isObject()], async (req, res) => {
  if (validationErrors(req, res)) return;
  try {
    const project = await ownedProject(req.params.projectId, req.workspaceUser._id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
    const submodule = await Submodule.create({ project: project._id, name: req.body.name.trim(), description: req.body.description || '', summary: req.body.summary, createdBy: req.workspaceUser._id });
    await writeActivity({ actor: req.workspaceUser._id, action: 'created', entityType: 'Submodule', entityId: submodule._id, project: project._id, details: { name: submodule.name } });
    return res.status(201).json({ success: true, submodule: { id: String(submodule._id), name: submodule.name, description: submodule.description, summary: submodule.summary, testCases: [] } });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'That submodule already exists in this project' });
    console.error('Creating submodule failed:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to create submodule' });
  }
});

router.patch('/submodules/:submoduleId', requireAdmin, [body('name').optional().trim().isLength({ min: 1 }), body('description').optional().isString()], async (req, res) => {
  if (validationErrors(req, res)) return;
  try {
    const submodule = validId(req.params.submoduleId) ? await Submodule.findById(req.params.submoduleId) : null;
    if (!submodule || !(await ownedProject(submodule.project, req.workspaceUser._id))) return res.status(404).json({ success: false, message: 'Submodule not found' });
    if (req.body.name !== undefined) submodule.name = req.body.name.trim();
    if (req.body.description !== undefined) submodule.description = req.body.description;
    await submodule.save();
    await writeActivity({ actor: req.workspaceUser._id, action: 'updated', entityType: 'Submodule', entityId: submodule._id, project: submodule.project, details: req.body });
    return res.json({ success: true });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'That submodule already exists in this project' });
    return res.status(500).json({ success: false, message: 'Unable to update submodule' });
  }
});

router.delete('/submodules/:submoduleId', requireAdmin, async (req, res) => {
  try {
    const submodule = validId(req.params.submoduleId) ? await Submodule.findById(req.params.submoduleId) : null;
    if (!submodule || !(await ownedProject(submodule.project, req.workspaceUser._id))) return res.status(404).json({ success: false, message: 'Submodule not found' });
    const cases = await TestCase.find({ submodule: submodule._id }, '_id').lean();
    const caseIds = cases.map((testCase) => testCase._id);
    await Attachment.deleteMany({ submodule: submodule._id });
    await TestExecution.deleteMany({ submodule: submodule._id });
    await TestCase.deleteMany({ submodule: submodule._id });
    await Submodule.deleteOne({ _id: submodule._id });
    await writeActivity({ actor: req.workspaceUser._id, action: 'deleted', entityType: 'Submodule', entityId: submodule._id, project: submodule.project, details: { deletedTestCases: caseIds.length } });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to delete submodule' });
  }
});

router.post('/submodules/:submoduleId/testcases', [
  requireAdmin,
  body('testCases').isArray({ min: 1 }).withMessage('Provide at least one test case'),
  body('testCases.*.title').trim().isLength({ min: 1 }).withMessage('Test case title is required'),
  body('testCases.*.priority').optional().isIn(testPriorities),
  body('testCases.*.status').optional().isIn(testCaseStatuses),
], async (req, res) => {
  if (validationErrors(req, res)) return;
  try {
    const submodule = validId(req.params.submoduleId) ? await Submodule.findById(req.params.submoduleId) : null;
    const project = submodule && await ownedProject(submodule.project, req.workspaceUser._id);
    if (!submodule || !project) return res.status(404).json({ success: false, message: 'Submodule not found' });
    const existingCount = await TestCase.countDocuments({ submodule: submodule._id });
    const documents = req.body.testCases.map((testCase, index) => ({
      project: project._id,
      submodule: submodule._id,
      caseId: testCase.caseId || `TC-${String(existingCount + index + 1).padStart(4, '0')}`,
      title: testCase.title.trim(),
      steps: testCase.steps || '',
      expectedResult: testCase.expectedResult || '',
      testData: testCase.testData ?? null,
      priority: testCase.priority || 'Medium',
      status: testCase.status || 'Not run',
      createdBy: req.workspaceUser._id,
    }));
    const created = await TestCase.insertMany(documents, { ordered: true });
    await writeActivity({ actor: req.workspaceUser._id, action: 'created', entityType: 'TestCase', project: project._id, details: { count: created.length, submodule: submodule.name } });
    return res.status(201).json({ success: true, testCases: created.map(serializeTestCase) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'A test case ID is already used in this submodule' });
    console.error('Creating test cases failed:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to create test cases' });
  }
});

router.patch('/testcases/:testCaseId', [
  requireAdmin,
  body('title').optional().trim().isLength({ min: 1 }).withMessage('Test case title cannot be blank'),
  body('priority').optional().isIn(testPriorities),
  body('status').optional().isIn(testCaseStatuses),
  body('steps').optional().isString(),
  body('expectedResult').optional().isString(),
], async (req, res) => {
  if (validationErrors(req, res)) return;
  try {
    const testCase = validId(req.params.testCaseId) ? await TestCase.findById(req.params.testCaseId) : null;
    if (!testCase || !(await ownedProject(testCase.project, req.workspaceUser._id))) return res.status(404).json({ success: false, message: 'Test case not found' });
    const before = {};
    for (const field of ['title', 'steps', 'expectedResult', 'testData', 'priority', 'status']) {
      if (req.body[field] !== undefined) {
        before[field] = testCase[field];
        testCase[field] = req.body[field];
      }
    }
    testCase.updatedBy = req.workspaceUser._id;
    await testCase.save();
    await writeActivity({ actor: req.workspaceUser._id, action: 'updated', entityType: 'TestCase', entityId: testCase._id, project: testCase.project, details: { before, after: req.body } });
    return res.json({ success: true, testCase: serializeTestCase(testCase) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to update test case' });
  }
});

router.delete('/testcases/:testCaseId', requireAdmin, async (req, res) => {
  try {
    const testCase = validId(req.params.testCaseId) ? await TestCase.findById(req.params.testCaseId) : null;
    if (!testCase || !(await ownedProject(testCase.project, req.workspaceUser._id))) return res.status(404).json({ success: false, message: 'Test case not found' });
    await Attachment.deleteMany({ testCase: testCase._id });
    await TestExecution.deleteMany({ testCase: testCase._id });
    await TestCase.deleteOne({ _id: testCase._id });
    await writeActivity({ actor: req.workspaceUser._id, action: 'deleted', entityType: 'TestCase', entityId: testCase._id, project: testCase.project, details: { caseId: testCase.caseId, title: testCase.title } });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to delete test case' });
  }
});

router.post('/testexecutions', [
  body('testCaseId').isMongoId(),
  body('result').isIn(['Pass', 'Fail', 'Blocked']),
  body('actualResult').optional().isString(),
  body('comments').optional().isString(),
], async (req, res) => {
  if (validationErrors(req, res)) return;
  try {
    const testCase = await TestCase.findById(req.body.testCaseId);
    const project = testCase && await activeProject(testCase.project);
    if (!testCase || !project) return res.status(404).json({ success: false, message: 'Test case not found' });
    const execution = await TestExecution.create({
      project: testCase.project,
      submodule: testCase.submodule,
      testCase: testCase._id,
      result: req.body.result,
      actualResult: req.body.actualResult || '',
      comments: req.body.comments || '',
      tester: req.workspaceUser._id,
      durationSeconds: req.body.durationSeconds,
    });
    testCase.status = execution.result;
    testCase.updatedBy = req.workspaceUser._id;
    await testCase.save();
    await writeActivity({ actor: req.workspaceUser._id, action: 'executed', entityType: 'TestExecution', entityId: execution._id, project: testCase.project, details: { caseId: testCase.caseId, result: execution.result } });
    return res.status(201).json({ success: true, execution });
  } catch (error) {
    console.error('Creating execution failed:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to save test execution' });
  }
});

router.get('/projects/:projectId/testexecutions', async (req, res) => {
  try {
    const project = await activeProject(req.params.projectId);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
    const executions = await TestExecution.find({ project: project._id }).populate('testCase', 'caseId title').populate('tester', 'name email').sort({ executedAt: -1 }).lean();
    return res.json({ success: true, executions });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to load test executions' });
  }
});

router.post('/attachments', [
  body('projectId').isMongoId(),
  body('originalName').trim().isLength({ min: 1 }),
  body('storageKey').trim().isLength({ min: 1 }),
  body('mimeType').optional().isString(),
  body('sizeBytes').optional().isInt({ min: 0 }),
  body('submoduleId').optional({ values: 'falsy' }).isMongoId(),
  body('testCaseId').optional({ values: 'falsy' }).isMongoId(),
  body('executionId').optional({ values: 'falsy' }).isMongoId(),
], async (req, res) => {
  if (validationErrors(req, res)) return;
  try {
    const project = await activeProject(req.body.projectId);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
    if (req.body.submoduleId && !(await Submodule.exists({ _id: req.body.submoduleId, project: project._id }))) {
      return res.status(404).json({ success: false, message: 'Submodule not found in this project' });
    }
    if (req.body.testCaseId) {
      const testCase = await TestCase.findOne({ _id: req.body.testCaseId, project: project._id });
      if (!testCase) return res.status(404).json({ success: false, message: 'Test case not found in this project' });
    }
    if (req.body.executionId) {
      const execution = await TestExecution.findOne({ _id: req.body.executionId, project: project._id });
      if (!execution) return res.status(404).json({ success: false, message: 'Execution not found in this project' });
    }
    const attachment = await Attachment.create({
      project: project._id,
      submodule: req.body.submoduleId || null,
      testCase: req.body.testCaseId || null,
      execution: req.body.executionId || null,
      originalName: req.body.originalName,
      storageKey: req.body.storageKey,
      mimeType: req.body.mimeType,
      sizeBytes: req.body.sizeBytes,
      uploadedBy: req.workspaceUser._id,
    });
    await writeActivity({ actor: req.workspaceUser._id, action: 'attached', entityType: 'Attachment', entityId: attachment._id, project: project._id, details: { originalName: attachment.originalName } });
    return res.status(201).json({ success: true, attachment });
  } catch (error) {
    console.error('Creating attachment metadata failed:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to save attachment metadata' });
  }
});

router.get('/projects/:projectId/attachments', async (req, res) => {
  try {
    const project = await activeProject(req.params.projectId);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
    const attachments = await Attachment.find({ project: project._id }).populate('uploadedBy', 'name email').sort({ createdAt: -1 }).lean();
    return res.json({ success: true, attachments });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to load attachments' });
  }
});

router.get('/activitylogs', async (req, res) => {
  try {
    const isAdmin = String(req.workspaceUser.role || '').toLowerCase() === 'admin';
    if (req.query.projectId && !isAdmin) return res.status(403).json({ success: false, message: 'Admin access is required for project activity' });
    const project = req.query.projectId ? await ownedProject(req.query.projectId, req.workspaceUser._id) : null;
    if (req.query.projectId && !project) return res.status(404).json({ success: false, message: 'Project not found' });
    const filter = project ? { project: project._id } : { actor: req.workspaceUser._id };
    const logs = await ActivityLog.find(filter).populate('actor', 'name email').sort({ createdAt: -1 }).limit(200).lean();
    return res.json({ success: true, activityLogs: logs });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to load activity logs' });
  }
});

module.exports = router;