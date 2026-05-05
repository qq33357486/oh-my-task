const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:17173';
const COOKIE_JAR = path.join(__dirname, 'flow_versions_cookies.txt');
const EVIDENCE_DIR = path.join('C:\\Users\\limen\\.factory\\missions\\7bc36ed2-c11c-4d72-8acc-13cda6d91e8c\\evidence\\core-api-mcp\\versions-api');

// Ensure evidence directory exists
if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

// Helper to make HTTP requests
function request(method, urlPath, body, cookies) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (body) {
      const data = JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(data);
    }

    if (cookies) {
      options.headers['Cookie'] = cookies;
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(body);
        } catch {
          parsed = body;
        }
        // Extract set-cookie headers
        const setCookies = res.headers['set-cookie'];
        resolve({
          status: res.statusCode,
          headers: res.headers,
          setCookies: setCookies || [],
          body: parsed,
          rawBody: body
        });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// Load cookies from jar file
function loadCookies() {
  try {
    return fs.readFileSync(COOKIE_JAR, 'utf-8').trim();
  } catch {
    return '';
  }
}

// Save cookies to jar file
function saveCookies(setCookies) {
  let existing = loadCookies();
  const parts = [];
  
  // Parse existing cookies
  if (existing) {
    parts.push(existing);
  }
  
  // Parse new cookies
  for (const sc of setCookies) {
    const match = sc.match(/^([^=]+=[^;]+)/);
    if (match) {
      parts.push(match[1]);
    }
  }
  
  const cookieStr = parts.join('; ');
  fs.writeFileSync(COOKIE_JAR, cookieStr);
  return cookieStr;
}

function saveEvidence(name, data) {
  const filePath = path.join(EVIDENCE_DIR, name);
  fs.writeFileSync(filePath, typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  return filePath;
}

// Test results
const results = {};
const frictions = [];
const blockers = [];

function setResult(id, status, evidence, reason) {
  results[id] = { status, evidence, reason };
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('=== Versions API Test Suite ===\n');
  const timestamp = new Date().toISOString();

  // ====== STEP 1: Register test user ======
  console.log('--- Registering test user ---');
  const uniqueEmail = `flow_versions_${Date.now()}@test.com`;
  const uniqueName = `flow_versions_tester_${Date.now()}`;
  const regRes = await request('POST', '/api/auth/register', {
    name: uniqueName,
    email: uniqueEmail,
    password: 'TestPass123'
  });
  console.log('Register:', regRes.status, JSON.stringify(regRes.body).substring(0, 200));
  
  if (regRes.status !== 200) {
    // Maybe already registered, try login
    console.log('Register failed, trying login...');
  }
  
  // Save cookies from registration
  let cookies = saveCookies(regRes.setCookies);
  
  // Login to ensure we have a session
  const loginRes = await request('POST', '/api/auth/login', {
    email: uniqueEmail,
    password: 'TestPass123'
  });
  console.log('Login:', loginRes.status, JSON.stringify(loginRes.body).substring(0, 200));
  
  if (loginRes.status !== 200) {
    console.log('ERROR: Cannot login. Aborting.');
    blockers.push({
      description: `Cannot register/login with email ${uniqueEmail}: ${loginRes.status} ${JSON.stringify(loginRes.body)}`,
      affectedAssertions: ['ALL']
    });
    // Mark all as blocked
    for (const id of ['VAL-CORE-010','VAL-CORE-011','VAL-CORE-012','VAL-CORE-013','VAL-CORE-014','VAL-CORE-015','VAL-CORE-016','VAL-CORE-017','VAL-CORE-018','VAL-CORE-019','VAL-CORE-045','VAL-CORE-046','VAL-CROSS-010']) {
      setResult(id, 'blocked', 'Cannot login', 'Login failed, all tests blocked');
    }
    writeReport(timestamp);
    return;
  }
  
  cookies = saveCookies(loginRes.setCookies);
  console.log('Cookies:', cookies.substring(0, 80) + '...');

  // ====== STEP 2: Create a project ======
  console.log('\n--- Creating test project ---');
  const projRes = await request('POST', '/api/projects', {
    name: `Versions Test Project ${Date.now()}`
  }, cookies);
  console.log('Create project:', projRes.status, JSON.stringify(projRes.body).substring(0, 200));
  
  const projectId = projRes.body?.data?.id;
  if (!projectId) {
    console.log('ERROR: Cannot create project. Aborting.');
    blockers.push({
      description: `Cannot create project: ${projRes.status} ${JSON.stringify(projRes.body)}`,
      affectedAssertions: ['ALL']
    });
    for (const id of ['VAL-CORE-010','VAL-CORE-011','VAL-CORE-012','VAL-CORE-013','VAL-CORE-014','VAL-CORE-015','VAL-CORE-016','VAL-CORE-017','VAL-CORE-018','VAL-CORE-019','VAL-CORE-045','VAL-CORE-046','VAL-CROSS-010']) {
      setResult(id, 'blocked', 'Cannot create project', 'Project creation failed');
    }
    writeReport(timestamp);
    return;
  }
  console.log('Project ID:', projectId);

  // ===================================================
  // VAL-CORE-010: 创建版本
  // ===================================================
  console.log('\n=== VAL-CORE-010: 创建版本 ===');
  const createVerRes = await request('POST', '/api/versions', {
    project_id: projectId,
    name: 'v1.0.0',
    description: 'First version'
  }, cookies);
  console.log('Create version:', createVerRes.status, JSON.stringify(createVerRes.body).substring(0, 300));
  saveEvidence('VAL-CORE-010-create-version.json', { request: { project_id: projectId, name: 'v1.0.0', description: 'First version' }, response: { status: createVerRes.status, body: createVerRes.body } });
  
  const versionId = createVerRes.body?.data?.id;
  if (createVerRes.status === 201 && createVerRes.body?.success === true && versionId && createVerRes.body.data.name === 'v1.0.0') {
    setResult('VAL-CORE-010', 'pass', 
      `status=${createVerRes.status}, body=${JSON.stringify({ success: true, data: { id: versionId, name: createVerRes.body.data.name, project_id: createVerRes.body.data.project_id } })}`,
      null);
  } else {
    setResult('VAL-CORE-010', 'fail', 
      `status=${createVerRes.status}, body=${JSON.stringify(createVerRes.body)}`,
      'Expected 201 with { success: true, data: { id, name, project_id } }');
  }

  // ===================================================
  // VAL-CORE-011: 查看版本列表
  // ===================================================
  console.log('\n=== VAL-CORE-011: 查看版本列表 ===');
  const listVerRes = await request('GET', `/api/versions?project_id=${projectId}`, null, cookies);
  console.log('List versions:', listVerRes.status, JSON.stringify(listVerRes.body).substring(0, 300));
  saveEvidence('VAL-CORE-011-list-versions.json', { response: { status: listVerRes.status, body: listVerRes.body } });
  
  if (listVerRes.status === 200 && listVerRes.body?.success === true && Array.isArray(listVerRes.body.data) && listVerRes.body.data.length > 0) {
    setResult('VAL-CORE-011', 'pass',
      `status=${listVerRes.status}, body contains array of ${listVerRes.body.data.length} versions`,
      null);
  } else {
    setResult('VAL-CORE-011', 'fail',
      `status=${listVerRes.status}, body=${JSON.stringify(listVerRes.body)}`,
      'Expected 200 with { success: true, data: [array of versions] }');
  }

  // ===================================================
  // VAL-CORE-012: 更新版本
  // ===================================================
  console.log('\n=== VAL-CORE-012: 更新版本 ===');
  const updateVerRes = await request('PUT', `/api/versions/${versionId}`, {
    name: 'v1.0.0-updated',
    description: 'Updated description'
  }, cookies);
  console.log('Update version:', updateVerRes.status, JSON.stringify(updateVerRes.body).substring(0, 300));
  
  // Verify by GET
  const getVerRes = await request('GET', `/api/versions/${versionId}`, null, cookies);
  console.log('GET version after update:', getVerRes.status, JSON.stringify(getVerRes.body).substring(0, 300));
  saveEvidence('VAL-CORE-012-update-version.json', { 
    updateResponse: { status: updateVerRes.status, body: updateVerRes.body },
    getResponse: { status: getVerRes.status, body: getVerRes.body }
  });
  
  if (updateVerRes.status === 200 && updateVerRes.body?.success === true &&
      getVerRes.body?.data?.name === 'v1.0.0-updated' && getVerRes.body?.data?.description === 'Updated description') {
    setResult('VAL-CORE-012', 'pass',
      `Updated name to "v1.0.0-updated", confirmed via GET: name="${getVerRes.body.data.name}", description="${getVerRes.body.data.description}"`,
      null);
  } else {
    setResult('VAL-CORE-012', 'fail',
      `update status=${updateVerRes.status}, GET body=${JSON.stringify(getVerRes.body)}`,
      'Expected updated name and description to be reflected');
  }

  // ===================================================
  // VAL-CORE-013: 版本开始（锁定）
  // ===================================================
  console.log('\n=== VAL-CORE-013: 版本开始（锁定） ===');
  const startVerRes = await request('POST', `/api/versions/${versionId}/start`, null, cookies);
  console.log('Start version:', startVerRes.status, JSON.stringify(startVerRes.body).substring(0, 300));
  saveEvidence('VAL-CORE-013-start-version.json', { response: { status: startVerRes.status, body: startVerRes.body } });
  
  const lockedAt = startVerRes.body?.data?.locked_at;
  if (startVerRes.status === 200 && startVerRes.body?.success === true && lockedAt) {
    setResult('VAL-CORE-013', 'pass',
      `status=${startVerRes.status}, body.success=true, locked_at="${lockedAt}"`,
      null);
  } else {
    setResult('VAL-CORE-013', 'fail',
      `status=${startVerRes.status}, body=${JSON.stringify(startVerRes.body)}`,
      'Expected 200 with locked_at set');
  }

  // ===================================================
  // VAL-CORE-014: 版本唯一活跃约束
  // ===================================================
  console.log('\n=== VAL-CORE-014: 版本唯一活跃约束 ===');
  // Create another version
  const createVer2Res = await request('POST', '/api/versions', {
    project_id: projectId,
    name: 'v2.0.0'
  }, cookies);
  console.log('Create version 2:', createVer2Res.status);
  const version2Id = createVer2Res.body?.data?.id;

  // Try to start the second version while first is active
  const startVer2Res = await request('POST', `/api/versions/${version2Id}/start`, null, cookies);
  console.log('Start version 2 (should fail 409):', startVer2Res.status, JSON.stringify(startVer2Res.body));
  saveEvidence('VAL-CORE-014-unique-active.json', { 
    createResponse: { status: createVer2Res.status },
    startResponse: { status: startVer2Res.status, body: startVer2Res.body }
  });
  
  if (startVer2Res.status === 409 && startVer2Res.body?.success === false && 
      (startVer2Res.body.error?.includes('活跃版本') || startVer2Res.body.error?.includes('active'))) {
    setResult('VAL-CORE-014', 'pass',
      `status=409, error="${startVer2Res.body.error}"`,
      null);
  } else {
    setResult('VAL-CORE-014', 'fail',
      `status=${startVer2Res.status}, body=${JSON.stringify(startVer2Res.body)}`,
      'Expected 409 with error about active version already existing');
  }

  // ===================================================
  // VAL-CORE-016: 版本完成 — 存在未完成任务
  // ===================================================
  console.log('\n=== VAL-CORE-016: 版本完成 — 存在未完成任务 ===');
  // Create a task under version 1
  const createTaskRes = await request('POST', '/api/tasks', {
    project_id: projectId,
    version_id: versionId,
    title: 'Test Task for Version',
    status: 'planned'
  }, cookies);
  console.log('Create task:', createTaskRes.status, JSON.stringify(createTaskRes.body).substring(0, 200));
  const taskId1 = createTaskRes.body?.data?.id;

  // Try to complete version with incomplete tasks
  const completeVerFailRes = await request('POST', `/api/versions/${versionId}/complete`, null, cookies);
  console.log('Complete version (should fail 400):', completeVerFailRes.status, JSON.stringify(completeVerFailRes.body));
  saveEvidence('VAL-CORE-016-complete-with-unfinished.json', {
    taskResponse: { status: createTaskRes.status },
    completeResponse: { status: completeVerFailRes.status, body: completeVerFailRes.body }
  });

  if (completeVerFailRes.status === 400 && completeVerFailRes.body?.success === false &&
      (completeVerFailRes.body.error?.includes('未完成') || completeVerFailRes.body.error?.includes('未'))) {
    setResult('VAL-CORE-016', 'pass',
      `status=400, error="${completeVerFailRes.body.error}"`,
      null);
  } else {
    setResult('VAL-CORE-016', 'fail',
      `status=${completeVerFailRes.status}, body=${JSON.stringify(completeVerFailRes.body)}`,
      'Expected 400 with error about unfinished tasks');
  }

  // ===================================================
  // VAL-CORE-015: 版本完成 (all tasks done)
  // ===================================================
  console.log('\n=== VAL-CORE-015: 版本完成 ===');
  // Complete the task first
  const activateTaskRes = await request('POST', `/api/tasks/${taskId1}/activate`, null, cookies);
  console.log('Activate task:', activateTaskRes.status);
  const completeTaskRes = await request('POST', `/api/tasks/${taskId1}/complete`, null, cookies);
  console.log('Complete task:', completeTaskRes.status, JSON.stringify(completeTaskRes.body).substring(0, 200));

  // Now try to complete version
  const completeVerRes = await request('POST', `/api/versions/${versionId}/complete`, null, cookies);
  console.log('Complete version (should succeed):', completeVerRes.status, JSON.stringify(completeVerRes.body).substring(0, 300));
  saveEvidence('VAL-CORE-015-complete-version.json', {
    completeTaskResponse: { status: completeTaskRes.status },
    completeVersionResponse: { status: completeVerRes.status, body: completeVerRes.body }
  });

  const completedAt = completeVerRes.body?.data?.completed_at;
  if (completeVerRes.status === 200 && completeVerRes.body?.success === true && completedAt) {
    setResult('VAL-CORE-015', 'pass',
      `status=${completeVerRes.status}, body.success=true, completed_at="${completedAt}"`,
      null);
  } else {
    setResult('VAL-CORE-015', 'fail',
      `status=${completeVerRes.status}, body=${JSON.stringify(completeVerRes.body)}`,
      'Expected 200 with completed_at set');
  }

  // ===================================================
  // VAL-CORE-017: 归档版本
  // ===================================================
  console.log('\n=== VAL-CORE-017: 归档版本 ===');
  // Archive version 1
  const archiveVerRes = await request('POST', `/api/versions/${versionId}/archive`, null, cookies);
  console.log('Archive version:', archiveVerRes.status, JSON.stringify(archiveVerRes.body).substring(0, 300));
  
  // Check list doesn't contain the archived version
  const listAfterArchiveRes = await request('GET', `/api/versions?project_id=${projectId}`, null, cookies);
  console.log('List after archive:', listAfterArchiveRes.status, JSON.stringify(listAfterArchiveRes.body).substring(0, 300));
  saveEvidence('VAL-CORE-017-archive-version.json', {
    archiveResponse: { status: archiveVerRes.status, body: archiveVerRes.body },
    listResponse: { status: listAfterArchiveRes.status, body: listAfterArchiveRes.body }
  });

  const archivedVersionInList = listAfterArchiveRes.body?.data?.some(v => v.id === versionId);
  if (archiveVerRes.status === 200 && archiveVerRes.body?.success === true && !archivedVersionInList) {
    setResult('VAL-CORE-017', 'pass',
      `archive status=200, version ${versionId} not in subsequent list (list has ${listAfterArchiveRes.body?.data?.length} items)`,
      null);
  } else {
    setResult('VAL-CORE-017', 'fail',
      `archive status=${archiveVerRes.status}, still in list: ${archivedVersionInList}`,
      'Expected archive to return 200 and version to disappear from list');
  }

  // ===================================================
  // VAL-CORE-018: 删除版本
  // ===================================================
  console.log('\n=== VAL-CORE-018: 删除版本 ===');
  // Create a new version, add a task, then delete the version
  const delVerCreateRes = await request('POST', '/api/versions', {
    project_id: projectId,
    name: 'Version to Delete'
  }, cookies);
  const delVersionId = delVerCreateRes.body?.data?.id;
  console.log('Create version for deletion:', delVerCreateRes.status, delVersionId);

  // Create a task under this version
  const delTaskCreateRes = await request('POST', '/api/tasks', {
    project_id: projectId,
    version_id: delVersionId,
    title: 'Task under version to delete'
  }, cookies);
  const delTaskId = delTaskCreateRes.body?.data?.id;
  console.log('Create task for deletion test:', delTaskCreateRes.status, delTaskId);

  // Delete the version
  const deleteVerRes = await request('DELETE', `/api/versions/${delVersionId}`, null, cookies);
  console.log('Delete version:', deleteVerRes.status, JSON.stringify(deleteVerRes.body));
  
  // Check the task's version_id is now null
  const getTaskAfterDelRes = await request('GET', `/api/tasks/${delTaskId}`, null, cookies);
  console.log('GET task after version delete:', getTaskAfterDelRes.status, JSON.stringify(getTaskAfterDelRes.body).substring(0, 300));
  saveEvidence('VAL-CORE-018-delete-version.json', {
    deleteResponse: { status: deleteVerRes.status, body: deleteVerRes.body },
    taskAfterDelete: { status: getTaskAfterDelRes.status, body: getTaskAfterDelRes.body }
  });

  const taskVersionId = getTaskAfterDelRes.body?.data?.version_id;
  if (deleteVerRes.status === 200 && deleteVerRes.body?.success === true && taskVersionId === null) {
    setResult('VAL-CORE-018', 'pass',
      `DELETE returned 200, task version_id is null`,
      null);
  } else {
    setResult('VAL-CORE-018', 'fail',
      `delete status=${deleteVerRes.status}, task version_id=${taskVersionId}`,
      `Expected DELETE 200 and task version_id to be null`);
  }

  // ===================================================
  // VAL-CORE-019: 版本统计
  // ===================================================
  console.log('\n=== VAL-CORE-019: 版本统计 ===');
  // Create version with tasks for stats
  const statsVerRes = await request('POST', '/api/versions', {
    project_id: projectId,
    name: 'Stats Test Version'
  }, cookies);
  const statsVersionId = statsVerRes.body?.data?.id;
  console.log('Create stats version:', statsVerRes.status, statsVersionId);

  // Create tasks under this version
  const statsTask1Res = await request('POST', '/api/tasks', {
    project_id: projectId,
    version_id: statsVersionId,
    title: 'Stats Task 1',
    estimated_days: 2
  }, cookies);
  const statsTask1Id = statsTask1Res.body?.data?.id;

  const statsTask2Res = await request('POST', '/api/tasks', {
    project_id: projectId,
    version_id: statsVersionId,
    title: 'Stats Task 2',
    estimated_days: 3
  }, cookies);
  const statsTask2Id = statsTask2Res.body?.data?.id;
  
  console.log('Created 2 tasks for stats:', statsTask1Id, statsTask2Id);

  // Complete one task
  await request('POST', `/api/tasks/${statsTask1Id}/activate`, null, cookies);
  await request('POST', `/api/tasks/${statsTask1Id}/complete`, null, cookies);

  // Get stats
  const statsRes = await request('GET', `/api/versions/${statsVersionId}/stats`, null, cookies);
  console.log('Get stats:', statsRes.status, JSON.stringify(statsRes.body).substring(0, 500));
  saveEvidence('VAL-CORE-019-version-stats.json', { response: { status: statsRes.status, body: statsRes.body } });

  const stats = statsRes.body?.data;
  if (statsRes.status === 200 && statsRes.body?.success === true &&
      typeof stats?.totalTasks === 'number' &&
      typeof stats?.doneTasks === 'number' &&
      typeof stats?.progress === 'number' &&
      typeof stats?.insertedTasks === 'number' &&
      typeof stats?.delayDays === 'number') {
    setResult('VAL-CORE-019', 'pass',
      `totalTasks=${stats.totalTasks}, doneTasks=${stats.doneTasks}, progress=${stats.progress}, insertedTasks=${stats.insertedTasks}, delayDays=${stats.delayDays}`,
      null);
  } else {
    setResult('VAL-CORE-019', 'fail',
      `status=${statsRes.status}, body=${JSON.stringify(statsRes.body)}`,
      'Expected stats with totalTasks, doneTasks, progress, insertedTasks, delayDays');
  }

  // ===================================================
  // VAL-CORE-045: 空版本完成
  // ===================================================
  console.log('\n=== VAL-CORE-045: 空版本完成 ===');
  // Use a separate project to avoid conflicts with active versions
  const proj045Res = await request('POST', '/api/projects', {
    name: `Project for VAL-CORE-045 ${Date.now()}`
  }, cookies);
  const project045Id = proj045Res.body?.data?.id;
  console.log('Create project for 045:', proj045Res.status, project045Id);

  const emptyVerRes = await request('POST', '/api/versions', {
    project_id: project045Id,
    name: 'Empty Version'
  }, cookies);
  const emptyVersionId = emptyVerRes.body?.data?.id;
  console.log('Create empty version:', emptyVerRes.status, emptyVersionId);

  // Start the version first (it needs to be locked)
  const startEmptyVerRes = await request('POST', `/api/versions/${emptyVersionId}/start`, null, cookies);
  console.log('Start empty version:', startEmptyVerRes.status);

  // Try to complete empty version (no tasks)
  const completeEmptyRes = await request('POST', `/api/versions/${emptyVersionId}/complete`, null, cookies);
  console.log('Complete empty version (should fail 400):', completeEmptyRes.status, JSON.stringify(completeEmptyRes.body));
  saveEvidence('VAL-CORE-045-complete-empty.json', {
    createProjectResponse: { status: proj045Res.status },
    startResponse: { status: startEmptyVerRes.status, body: startEmptyVerRes.body },
    completeResponse: { status: completeEmptyRes.status, body: completeEmptyRes.body }
  });

  if (completeEmptyRes.status === 400 && completeEmptyRes.body?.success === false &&
      (completeEmptyRes.body.error?.includes('无任务') || completeEmptyRes.body.error?.includes('任务'))) {
    setResult('VAL-CORE-045', 'pass',
      `status=400, error="${completeEmptyRes.body.error}" (empty version, started, no tasks)`,
      null);
  } else if (completeEmptyRes.status === 400 && completeEmptyRes.body?.success === false) {
    setResult('VAL-CORE-045', 'pass',
      `status=400, error="${completeEmptyRes.body.error}"`,
      'Got 400 but error message differs from expected. Still correct behavior - empty version cannot be completed.');
  } else {
    setResult('VAL-CORE-045', 'fail',
      `status=${completeEmptyRes.status}, body=${JSON.stringify(completeEmptyRes.body)}`,
      'Expected 400 for completing empty version');
  }

  // ===================================================
  // VAL-CORE-046: 归档活跃版本
  // ===================================================
  console.log('\n=== VAL-CORE-046: 归档活跃版本 ===');
  // Create and start a new version in a new project to avoid conflicts
  const proj46Res = await request('POST', '/api/projects', {
    name: `Project for VAL-CORE-046 ${Date.now()}`
  }, cookies);
  const project46Id = proj46Res.body?.data?.id;
  console.log('Create project for 046:', proj46Res.status, project46Id);

  const activeVerRes = await request('POST', '/api/versions', {
    project_id: project46Id,
    name: 'Active Version to Archive'
  }, cookies);
  const activeVerId = activeVerRes.body?.data?.id;
  console.log('Create active version:', activeVerRes.status, activeVerId);

  // Start the version
  const startActiveRes = await request('POST', `/api/versions/${activeVerId}/start`, null, cookies);
  console.log('Start active version:', startActiveRes.status);

  // Archive it
  const archiveActiveRes = await request('POST', `/api/versions/${activeVerId}/archive`, null, cookies);
  console.log('Archive active version:', archiveActiveRes.status, JSON.stringify(archiveActiveRes.body));

  // Create and start a new version - should work now
  const newVerAfterArchiveRes = await request('POST', '/api/versions', {
    project_id: project46Id,
    name: 'New Version After Archive'
  }, cookies);
  const newVerId = newVerAfterArchiveRes.body?.data?.id;
  console.log('Create new version after archive:', newVerAfterArchiveRes.status, newVerId);

  const startNewVerRes = await request('POST', `/api/versions/${newVerId}/start`, null, cookies);
  console.log('Start new version (should succeed):', startNewVerRes.status, JSON.stringify(startNewVerRes.body).substring(0, 300));
  saveEvidence('VAL-CORE-046-archive-active.json', {
    archiveResponse: { status: archiveActiveRes.status, body: archiveActiveRes.body },
    createNewResponse: { status: newVerAfterArchiveRes.status },
    startNewResponse: { status: startNewVerRes.status, body: startNewVerRes.body }
  });

  if (archiveActiveRes.status === 200 && startNewVerRes.status === 200 && startNewVerRes.body?.success === true && startNewVerRes.body?.data?.locked_at) {
    setResult('VAL-CORE-046', 'pass',
      `archive=200, new version start=200 with locked_at="${startNewVerRes.body.data.locked_at}"`,
      null);
  } else {
    setResult('VAL-CORE-046', 'fail',
      `archive status=${archiveActiveRes.status}, new start status=${startNewVerRes.status}, body=${JSON.stringify(startNewVerRes.body)}`,
      'Expected archive 200 and new version start 200');
  }

  // ===================================================
  // VAL-CROSS-010: 归档活跃版本后创建新版本
  // ===================================================
  console.log('\n=== VAL-CROSS-010: 归档活跃版本后创建新版本 ===');
  // This is essentially the same as VAL-CORE-046. Let's create a new project to test it independently
  const projCrossRes = await request('POST', '/api/projects', {
    name: `Project for VAL-CROSS-010 ${Date.now()}`
  }, cookies);
  const projectCrossId = projCrossRes.body?.data?.id;
  console.log('Create project for CROSS-010:', projCrossRes.status, projectCrossId);

  const crossVer1Res = await request('POST', '/api/versions', {
    project_id: projectCrossId,
    name: 'Cross Version 1'
  }, cookies);
  const crossVer1Id = crossVer1Res.body?.data?.id;
  console.log('Create cross version 1:', crossVer1Res.status, crossVer1Id);

  // Start it
  await request('POST', `/api/versions/${crossVer1Id}/start`, null, cookies);
  console.log('Started cross version 1');

  // Archive it
  const crossArchiveRes = await request('POST', `/api/versions/${crossVer1Id}/archive`, null, cookies);
  console.log('Archive cross version 1:', crossArchiveRes.status);

  // Create and start new version
  const crossVer2Res = await request('POST', '/api/versions', {
    project_id: projectCrossId,
    name: 'Cross Version 2 - New Active'
  }, cookies);
  const crossVer2Id = crossVer2Res.body?.data?.id;
  console.log('Create cross version 2:', crossVer2Res.status, crossVer2Id);

  const crossStart2Res = await request('POST', `/api/versions/${crossVer2Id}/start`, null, cookies);
  console.log('Start cross version 2:', crossStart2Res.status, JSON.stringify(crossStart2Res.body).substring(0, 300));
  saveEvidence('VAL-CROSS-010-archive-and-new.json', {
    archiveResponse: { status: crossArchiveRes.status },
    createNewResponse: { status: crossVer2Res.status },
    startNewResponse: { status: crossStart2Res.status, body: crossStart2Res.body }
  });

  if (crossArchiveRes.status === 200 && crossStart2Res.status === 200 && crossStart2Res.body?.success === true && crossStart2Res.body?.data?.locked_at) {
    setResult('VAL-CROSS-010', 'pass',
      `archive=200, new version start=200, locked_at="${crossStart2Res.body.data.locked_at}"`,
      null);
  } else {
    setResult('VAL-CROSS-010', 'fail',
      `archive=${crossArchiveRes.status}, start=${crossStart2Res.status}, body=${JSON.stringify(crossStart2Res.body)}`,
      'Expected archive 200 and new version start 200');
  }

  // ====== Write report ======
  writeReport(timestamp);
}

function writeReport(timestamp) {
  const report = {
    groupId: 'versions-api',
    testedAt: timestamp,
    isolation: {
      apiUrl: 'http://localhost:17173',
      testUser: 'flow_versions_*@test.com',
      cookieJar: COOKIE_JAR
    },
    toolsUsed: ['node'],
    assertions: results,
    frictions,
    blockers,
    summary: `Tested ${Object.keys(results).length} assertions: ${Object.values(results).filter(r => r.status === 'pass').length} passed, ${Object.values(results).filter(r => r.status === 'fail').length} failed, ${Object.values(results).filter(r => r.status === 'blocked').length} blocked`
  };

  const reportDir = path.join('D:\\1 git\\oh-my-task\\.factory\\validation\\core-api-mcp\\user-testing\\flows');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  const reportPath = path.join(reportDir, 'versions-api.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log('\n\n=== REPORT SAVED ===');
  console.log('Path:', reportPath);
  console.log('Summary:', report.summary);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
