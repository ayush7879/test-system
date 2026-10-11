const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
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
const uploadDirectory = path.resolve(__dirname, '..', 'uploads');
fs.mkdirSync(uploadDirectory, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDirectory,
    filename: (req, file, callback) => callback(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const allowed = /^(image\/(png|jpeg|gif|webp)|video\/(mp4|webm)|text\/(plain|csv)|application\/(pdf|json|zip|octet-stream))$/i;
    if (allowed.test(file.mimetype)) return callback(null, true);
    return callback(new Error('Upload a PNG/JPEG image, MP4/WebM video, PDF, CSV, text, or log file'));
  },
});

function validationErrors(req, res) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return false;
  res.status(400).json({ success: false, errors: errors.array() });
  return true;
}

function validId(value) {
  return mongoose.isValidObjectId(value);
}

function isTester(user) {
  return String(user?.role || '').toLowerCase() === 'tester';
}

async function requireTester(req, res, next) {
  if (!isTester(req.workspaceUser)) return res.status(403).json({ success: false, message: 'A Tester account is required' });
  return next();
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
    testType: testCase.testType || 'Functional',
    preconditions: testCase.preconditions || '',
    testType: testCase.testType || 'Functional',
    preconditions: testCase.preconditions || '',
    steps: testCase.steps,
    expectedResult: testCase.expectedResult,
    testData: testCase.testData,
    priority: testCase.priority,
    status: testCase.status,
    assignedTester: testCase.assignedTester ? String(testCase.assignedTester._id || testCase.assignedTester) : null,
    assignedTesterName: testCase.assignedTester?.name || '',
    assignedAt: testCase.assignedAt,
    createdAt: testCase.createdAt,
    updatedAt: testCase.updatedAt,
  };
}

async function serializeProject(project, requestingUser) {
  const submodules = await Submodule.find({ project: project._id }).sort({ createdAt: 1 }).lean();
  const modules = await Promise.all(submodules.map(async (submodule) => {
    const caseFilter = String(requestingUser?.role || '').toLowerCase() === 'admin'
      ? { submodule: submodule._id }
      : { submodule: submodule._id, assignedTester: requestingUser?._id };
    const cases = await TestCase.find(caseFilter).populate('assignedTester', 'name').sort({ createdAt: 1 }).lean();
    const summary = {
      pass: submodule.summary?.pass || 0,
      fail: submodule.summary?.fail || 0,
      blocked: submodule.summary?.blocked || 0,
      notRun: submodule.summary?.notRun || 0,
    };
    cases.forEach((testCase) => {
      const key = ['Not run', 'In Progress'].includes(testCase.status) ? 'notRun' : testCase.status.toLowerCase();
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
    const assignedProjects = isAdmin ? null : await TestCase.distinct('project', { assignedTester: req.workspaceUser._id });
    const filter = isAdmin ? { owner: req.workspaceUser._id } : { _id: { $in: assignedProjects }, status: 'Active' };
    const projects = await Project.find(filter).sort({ updatedAt: -1 });
    return res.json({ success: true, projects: await Promise.all(projects.map((project) => serializeProject(project, req.workspaceUser))) });
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
      testType: testCase.testType || 'Functional',
      preconditions: testCase.preconditions || '',
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
  body('testType').optional().isString(),
  body('preconditions').optional().isString(),
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
    for (const field of ['title', 'testType', 'preconditions', 'steps', 'expectedResult', 'testData', 'priority', 'status']) {
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

router.get('/projects/:projectId/testers', requireAdmin, async (req, res) => {
  try {
    const project = await ownedProject(req.params.projectId, req.workspaceUser._id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
    const testers = await User.find({ role: /^tester$/i, mustChangePassword: false, isActive: { $ne: false } }, 'name email role')
      .sort({ name: 1 })
      .lean();
    return res.json({ success: true, testers: testers.map((tester) => ({ id: String(tester._id), name: tester.name, email: tester.email, role: tester.role })) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to load testers' });
  }
});

router.post('/submodules/:submoduleId/assignments', requireAdmin, [
  body('testCaseIds').isArray({ min: 1 }).withMessage('Select at least one test case'),
  body('testCaseIds.*').isMongoId(),
  body('testerIds').isArray({ min: 1 }).withMessage('Select at least one Tester'),
  body('testerIds.*').isMongoId(),
], async (req, res) => {
  if (validationErrors(req, res)) return;
  try {
    const submodule = validId(req.params.submoduleId) ? await Submodule.findById(req.params.submoduleId) : null;
    const project = submodule && await ownedProject(submodule.project, req.workspaceUser._id);
    if (!submodule || !project) return res.status(404).json({ success: false, message: 'Submodule not found' });

    const testCaseIds = [...new Set(req.body.testCaseIds.map(String))];
    const testerIds = [...new Set(req.body.testerIds.map(String))];
    const foundCases = await TestCase.find({ _id: { $in: testCaseIds }, project: project._id, submodule: submodule._id });
    if (foundCases.length !== testCaseIds.length) return res.status(400).json({ success: false, message: 'Some selected test cases do not belong to this submodule' });
    const casesById = new Map(foundCases.map((testCase) => [String(testCase._id), testCase]));
    const cases = testCaseIds.map((id) => casesById.get(id));

    const testers = await User.find({ _id: { $in: testerIds }, role: /^tester$/i, mustChangePassword: false, isActive: { $ne: false } }, '_id name email').lean();
    if (testers.length !== testerIds.length) return res.status(400).json({ success: false, message: 'Choose active Tester accounts only' });
    testers.sort((left, right) => testerIds.indexOf(String(left._id)) - testerIds.indexOf(String(right._id)));
    const testerMap = new Map(testers.map((tester) => [String(tester._id), tester]));
    const groups = testers.map((tester) => ({ testerId: String(tester._id), testerName: tester.name, testerEmail: tester.email, testCaseIds: [] }));
    const baseSize = Math.floor(cases.length / testers.length);
    const remainder = cases.length % testers.length;
    let caseIndex = 0;

    for (let testerIndex = 0; testerIndex < testers.length; testerIndex += 1) {
      const groupSize = baseSize + (testerIndex < remainder ? 1 : 0);
      const group = groups[testerIndex];
      for (let offset = 0; offset < groupSize; offset += 1) {
        const testCase = cases[caseIndex++];
        testCase.assignedTester = testerMap.get(group.testerId)._id;
        testCase.assignedAt = new Date();
        testCase.assignedBy = req.workspaceUser._id;
        testCase.status = 'Not run';
        testCase.updatedBy = req.workspaceUser._id;
        group.testCaseIds.push(String(testCase._id));
        await testCase.save();
      }
    }

    await writeActivity({ actor: req.workspaceUser._id, action: 'assigned', entityType: 'TestCase', project: project._id, details: { submodule: submodule.name, groups: groups.map(({ testerId, testCaseIds: assignedIds }) => ({ testerId, count: assignedIds.length, testCaseIds: assignedIds })) } });
    return res.json({ success: true, assignments: groups });
  } catch (error) {
    console.error('Assigning test cases failed:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to assign test cases' });
  }
});

router.get('/tester/dashboard', requireTester, async (req, res) => {
  try {
    const cases = await TestCase.find({ assignedTester: req.workspaceUser._id }).lean();
    const assigned = cases.length;
    const inProgress = cases.filter((testCase) => testCase.status === 'In Progress').length;
    const completed = cases.filter((testCase) => ['Pass', 'Fail', 'Blocked'].includes(testCase.status)).length;
    return res.json({ success: true, tester: { id: String(req.workspaceUser._id), name: req.workspaceUser.name, email: req.workspaceUser.email }, stats: { assigned, inProgress, completed }, cases: cases.map((testCase) => String(testCase._id)) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to load Tester dashboard' });
  }
});

router.get('/tester/tests', requireTester, async (req, res) => {
  try {
    const cases = await TestCase.find({ assignedTester: req.workspaceUser._id })
      .populate('project', 'name code')
      .populate('submodule', 'name')
      .sort({ assignedAt: -1, createdAt: 1 });
    const caseIds = cases.map((testCase) => testCase._id);
    const executions = await TestExecution.find({ testCase: { $in: caseIds } }).sort({ executedAt: -1 }).lean();
    const latestExecution = new Map();
    executions.forEach((execution) => {
      const key = String(execution.testCase);
      if (!latestExecution.has(key)) latestExecution.set(key, execution);
    });
    return res.json({ success: true, testCases: cases.map((testCase) => ({
      ...serializeTestCase(testCase),
      project: testCase.project ? { id: String(testCase.project._id), name: testCase.project.name, code: testCase.project.code } : null,
      submodule: testCase.submodule ? { id: String(testCase.submodule._id), name: testCase.submodule.name } : null,
      latestExecution: latestExecution.get(String(testCase._id)) || null,
    })) });
  } catch (error) {
    console.error('Loading assigned test cases failed:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to load assigned test cases' });
  }
});

router.get('/tester/executions', requireTester, async (req, res) => {
  try {
    const executions = await TestExecution.find({ tester: req.workspaceUser._id })
      .populate('project', 'name code')
      .populate('testCase', 'caseId title')
      .sort({ executedAt: -1 })
      .limit(200)
      .lean();
    return res.json({ success: true, executions });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to load your test runs' });
  }
});

router.get('/tester/attachments', requireTester, async (req, res) => {
  try {
    const attachments = await Attachment.find({ uploadedBy: req.workspaceUser._id })
      .populate('project', 'name code')
      .populate('testCase', 'caseId title')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    return res.json({ success: true, attachments });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to load your evidence files' });
  }
});

router.post('/testcases/:testCaseId/start', requireTester, async (req, res) => {
  try {
    const testCase = validId(req.params.testCaseId) ? await TestCase.findOne({ _id: req.params.testCaseId, assignedTester: req.workspaceUser._id }) : null;
    if (!testCase) return res.status(404).json({ success: false, message: 'This test case is not assigned to your account' });
    testCase.status = 'In Progress';
    testCase.updatedBy = req.workspaceUser._id;
    await testCase.save();
    await writeActivity({ actor: req.workspaceUser._id, action: 'started', entityType: 'TestCase', entityId: testCase._id, project: testCase.project, details: { caseId: testCase.caseId } });
    return res.json({ success: true, testCase: serializeTestCase(testCase) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to start test case' });
  }
});

router.post('/testexecutions', requireTester, [
  body('testCaseId').isMongoId(),
  body('result').isIn(['Pass', 'Fail', 'Blocked']),
  body('actualResult').optional().isString(),
  body('comments').optional().isString(),
  body('durationSeconds').optional().isInt({ min: 0 }),
  body('attachmentIds').optional().isArray(),
], async (req, res) => {
  if (validationErrors(req, res)) return;
  try {
    const testCase = await TestCase.findById(req.body.testCaseId);
    const project = testCase && await activeProject(testCase.project);
    if (!testCase || !project || String(testCase.assignedTester) !== String(req.workspaceUser._id)) {
      return res.status(404).json({ success: false, message: 'This test case is not assigned to your account' });
    }
    const attachmentIds = [...new Set((req.body.attachmentIds || []).map(String))];
    if (attachmentIds.length && await Attachment.countDocuments({ _id: { $in: attachmentIds }, testCase: testCase._id }) !== attachmentIds.length) {
      return res.status(400).json({ success: false, message: 'One or more evidence files do not belong to this test case' });
    }
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
    if (attachmentIds.length) await Attachment.updateMany({ _id: { $in: attachmentIds } }, { $set: { execution: execution._id } });
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
    const isAdmin = String(req.workspaceUser.role || '').toLowerCase() === 'admin';
    const assignedCases = isAdmin ? null : await TestCase.find({ project: project._id, assignedTester: req.workspaceUser._id }, '_id').lean();
    const executionFilter = isAdmin ? { project: project._id } : { project: project._id, tester: req.workspaceUser._id, testCase: { $in: assignedCases.map((item) => item._id) } };
    const executions = await TestExecution.find(executionFilter).populate('testCase', 'caseId title').populate('tester', 'name email').sort({ executedAt: -1 }).lean();
    return res.json({ success: true, executions });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to load test executions' });
  }
});

router.post('/attachments/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'Select an evidence file to upload' });
  try {
    const project = await activeProject(req.body.projectId);
    const testCase = validId(req.body.testCaseId) ? await TestCase.findOne({ _id: req.body.testCaseId, project: project?._id }) : null;
    if (!project || !testCase) {
      await fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(404).json({ success: false, message: 'Active project or test case not found' });
    }
    const isAdmin = String(req.workspaceUser.role || '').toLowerCase() === 'admin';
    if (!isAdmin && String(testCase.assignedTester) !== String(req.workspaceUser._id)) {
      await fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(403).json({ success: false, message: 'This test case is not assigned to your account' });
    }
    const attachment = await Attachment.create({
      project: project._id,
      submodule: testCase.submodule,
      testCase: testCase._id,
      originalName: req.file.originalname,
      storageKey: path.basename(req.file.filename),
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      uploadedBy: req.workspaceUser._id,
    });
    await writeActivity({ actor: req.workspaceUser._id, action: 'uploaded-evidence', entityType: 'Attachment', entityId: attachment._id, project: project._id, details: { originalName: attachment.originalName, testCaseId: String(testCase._id) } });
    return res.status(201).json({ success: true, attachment: { id: String(attachment._id), originalName: attachment.originalName, mimeType: attachment.mimeType, sizeBytes: attachment.sizeBytes } });
  } catch (error) {
    await fs.promises.unlink(req.file.path).catch(() => {});
    console.error('Evidence upload failed:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to save evidence file' });
  }
});

router.get('/attachments/:attachmentId/file', async (req, res) => {
  try {
    const attachment = validId(req.params.attachmentId) ? await Attachment.findById(req.params.attachmentId) : null;
    if (!attachment) return res.status(404).json({ success: false, message: 'Evidence file not found' });
    const isAdmin = String(req.workspaceUser.role || '').toLowerCase() === 'admin';
    const isUploader = String(attachment.uploadedBy) === String(req.workspaceUser._id);
    const testCase = attachment.testCase ? await TestCase.findById(attachment.testCase) : null;
    const isAssignedTester = testCase && String(testCase.assignedTester) === String(req.workspaceUser._id);
    if (!isAdmin && !isUploader && !isAssignedTester) return res.status(403).json({ success: false, message: 'You do not have access to this evidence file' });
    const filePath = path.join(uploadDirectory, path.basename(attachment.storageKey));
    if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: 'Evidence file is no longer available on this server' });
    return res.download(filePath, attachment.originalName);
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to retrieve evidence file' });
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
    const isAdmin = String(req.workspaceUser.role || '').toLowerCase() === 'admin';
    const filter = isAdmin ? { project: project._id } : { project: project._id, uploadedBy: req.workspaceUser._id };
    const attachments = await Attachment.find(filter).populate('uploadedBy', 'name email').sort({ createdAt: -1 }).lean();
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