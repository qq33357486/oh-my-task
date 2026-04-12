/**
 * Test script for tasks CRUD assertions:
 * VAL-CORE-020, VAL-CORE-021, VAL-CORE-022, VAL-CORE-023, VAL-CORE-024,
 * VAL-CORE-025, VAL-CORE-030, VAL-CORE-032, VAL-CORE-036, VAL-CORE-037, VAL-CORE-039
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';
const COOKIE_FILE = 'D:\\1 git\\oh-my-task\\flow_tasks_crud_cookies.txt';

const fs = require('fs');

let cookies = '';

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    if (cookies) {
      options.headers['Cookie'] = cookies;
    }
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        // Capture set-cookie
        const setCookie = res.headers['set-cookie'];
        if (setCookie) {
          // Parse cookies from set-cookie headers
          const newCookies = setCookie.map(c => c.split(';')[0]).join('; ');
          if (cookies) {
            // Merge cookies
            const existing = parseCookies(cookies);
            const incoming = parseCookies(newCookies);
            Object.assign(existing, incoming);
            cookies = Object.entries(existing).map(([k, v]) => `${k}=${v}`).join('; ');
          } else {
            cookies = newCookies;
          }
          // Save to file
          fs.writeFileSync(COOKIE_FILE, cookies, 'utf-8');
        }
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({ status: res.statusCode, body: parsed, headers: res.headers });
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function parseCookies(str) {
  const obj = {};
  str.split('; ').forEach(pair => {
    const [k, v] = pair.split('=');
    if (k) obj[k] = v;
  });
  return obj;
}

function loadCookies() {
  if (fs.existsSync(COOKIE_FILE)) {
    cookies = fs.readFileSync(COOKIE_FILE, 'utf-8').trim();
  }
}

function clearCookies() {
  cookies = '';
  if (fs.existsSync(COOKIE_FILE)) {
    fs.unlinkSync(COOKIE_FILE);
  }
}

// Assertion tracking
const results = {};
function record(id, status, evidence, reason = null) {
  results[id] = { status, evidence, reason };
  const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⚠️';
  console.log(`${icon} ${id}: ${status}${reason ? ' — ' + reason : ''}`);
}

async function main() {
  console.log('=== Tasks CRUD Flow Tests ===\n');

  // ========== SETUP: Register user, create project and version ==========
  console.log('--- Setup ---');
  clearCookies();

  // Register user
  const uniqueEmail = `flow_tasks_crud_${Date.now()}@test.com`;
  const email2 = `flow_tasks_crud_2_${Date.now()}@test.com`;
  let regRes = await request('POST', '/api/auth/register', {
    name: 'tasks_crud_user',
    email: uniqueEmail,
    password: 'TestPass123',
  });
  console.log(`Register user1: ${regRes.status} — ${JSON.stringify(regRes.body)}`);

  // Login
  let loginRes = await request('POST', '/api/auth/login', {
    email: uniqueEmail,
    password: 'TestPass123',
  });
  console.log(`Login user1: ${loginRes.status}`);

  // Create project
  let projRes = await request('POST', '/api/projects', { name: 'Tasks CRUD Test Project' });
  console.log(`Create project: ${projRes.status} — ${JSON.stringify(projRes.body)}`);
  const projectId = projRes.body?.data?.id;

  // Create version
  let verRes = await request('POST', '/api/versions', { name: 'V1', project_id: projectId });
  console.log(`Create version: ${verRes.status} — ${JSON.stringify(verRes.body)}`);
  const versionId = verRes.body?.data?.id;

  // Start the version (so tasks auto-link)
  let startVerRes = await request('POST', `/api/versions/${versionId}/start`);
  console.log(`Start version: ${startVerRes.status} — ${JSON.stringify(startVerRes.body)}`);

  // ========== VAL-CORE-020: 创建任务 ==========
  console.log('\n--- VAL-CORE-020: 创建任务 ---');
  try {
    const res = await request('POST', '/api/tasks', {
      project_id: projectId,
      title: 'Test Task 020',
    });
    console.log(`Response: ${res.status} — ${JSON.stringify(res.body)}`);
    const task = res.body?.data;
    if (
      res.status === 201 &&
      res.body?.success === true &&
      task?.id &&
      task?.title === 'Test Task 020' &&
      task?.status === 'planned' &&
      task?.version_id === versionId
    ) {
      record('VAL-CORE-020', 'pass', {
        statusCode: res.status,
        body: res.body,
      });
    } else {
      record('VAL-CORE-020', 'fail', {
        statusCode: res.status,
        body: res.body,
      }, `Expected status 201, success true, id, title "Test Task 020", status "planned", version_id linked. Got: status=${res.status}`);
    }
    // Save task id for later tests
    var task020Id = task?.id;
  } catch (e) {
    record('VAL-CORE-020', 'fail', {}, e.message);
  }

  // ========== VAL-CORE-021: 创建子任务（指定 parent_id）==========
  console.log('\n--- VAL-CORE-021: 创建子任务 ---');
  try {
    // Create child task (level 2)
    const res = await request('POST', '/api/tasks', {
      project_id: projectId,
      title: 'Child Task L2',
      parent_id: task020Id,
    });
    console.log(`Response: ${res.status} — ${JSON.stringify(res.body)}`);
    const task = res.body?.data;
    if (
      res.status === 201 &&
      res.body?.success === true &&
      task?.parent_id === task020Id
    ) {
      record('VAL-CORE-021', 'pass', {
        statusCode: res.status,
        body: res.body,
      });
    } else {
      record('VAL-CORE-021', 'fail', {
        statusCode: res.status,
        body: res.body,
      }, `parent_id mismatch. Expected ${task020Id}, got ${task?.parent_id}`);
    }
    var childL2Id = task?.id;

    // Create grandchild (level 3)
    const res2 = await request('POST', '/api/tasks', {
      project_id: projectId,
      title: 'Grandchild Task L3',
      parent_id: childL2Id,
    });
    var childL3Id = res2.body?.data?.id;
    console.log(`Grandchild L3: ${res2.status}`);
  } catch (e) {
    record('VAL-CORE-021', 'fail', {}, e.message);
  }

  // ========== VAL-CORE-022: 超过3级层级限制 ==========
  console.log('\n--- VAL-CORE-022: 超过3级层级限制 ---');
  try {
    const res = await request('POST', '/api/tasks', {
      project_id: projectId,
      title: 'Great-grandchild L4 (should fail)',
      parent_id: childL3Id,
    });
    console.log(`Response: ${res.status} — ${JSON.stringify(res.body)}`);
    if (
      res.status === 400 &&
      res.body?.success === false &&
      res.body?.error?.includes('层级')
    ) {
      record('VAL-CORE-022', 'pass', {
        statusCode: res.status,
        body: res.body,
      });
    } else {
      record('VAL-CORE-022', 'fail', {
        statusCode: res.status,
        body: res.body,
      }, `Expected 400 with "层级" error. Got status=${res.status}`);
    }
  } catch (e) {
    record('VAL-CORE-022', 'fail', {}, e.message);
  }

  // ========== VAL-CORE-023: 查看任务列表 ==========
  console.log('\n--- VAL-CORE-023: 查看任务列表 ---');
  try {
    // Create extra tasks for filtering test
    await request('POST', '/api/tasks', { project_id: projectId, title: 'Extra Task A' });
    
    // List all tasks for the project
    const res = await request('GET', `/api/tasks?project_id=${projectId}`);
    console.log(`List all: ${res.status}, count=${res.body?.data?.length}`);
    
    // Filter by parent_id=null (root tasks)
    const resRoot = await request('GET', `/api/tasks?project_id=${projectId}&parent_id=null`);
    console.log(`Root tasks: ${resRoot.status}, count=${resRoot.body?.data?.length}`);
    
    // Filter by parent_id=task020Id
    const resChildren = await request('GET', `/api/tasks?project_id=${projectId}&parent_id=${task020Id}`);
    console.log(`Children of task020: ${resChildren.status}, count=${resChildren.body?.data?.length}`);

    // Filter by status
    const resPlanned = await request('GET', `/api/tasks?project_id=${projectId}&status=planned`);
    console.log(`Planned tasks: ${resPlanned.status}, count=${resPlanned.body?.data?.length}`);

    if (
      res.status === 200 &&
      res.body?.success === true &&
      Array.isArray(res.body?.data) &&
      res.body.data.length > 0 &&
      // Root filter works
      resRoot.body?.data?.length >= 2 &&
      // Children filter works
      resChildren.body?.data?.length >= 1
    ) {
      record('VAL-CORE-023', 'pass', {
        listAll: { status: res.status, count: res.body?.data?.length },
        rootFilter: { count: resRoot.body?.data?.length },
        childrenFilter: { count: resChildren.body?.data?.length },
        statusFilter: { count: resPlanned.body?.data?.length },
      });
    } else {
      record('VAL-CORE-023', 'fail', {
        listAll: { status: res.status, body: res.body },
        rootFilter: { status: resRoot.status, body: resRoot.body },
        childrenFilter: { status: resChildren.status, body: resChildren.body },
      }, 'Task list or filtering did not work as expected');
    }
  } catch (e) {
    record('VAL-CORE-023', 'fail', {}, e.message);
  }

  // ========== VAL-CORE-024: 查看任务详情（含子任务树）==========
  console.log('\n--- VAL-CORE-024: 查看任务详情 ---');
  try {
    const res = await request('GET', `/api/tasks/${task020Id}`);
    console.log(`Response: ${res.status} — ${JSON.stringify(res.body)?.substring(0, 300)}`);
    const task = res.body?.data;
    if (
      res.status === 200 &&
      res.body?.success === true &&
      task?.id === task020Id &&
      task?.title === 'Test Task 020' &&
      Array.isArray(task?.children) &&
      task.children.length >= 1
    ) {
      record('VAL-CORE-024', 'pass', {
        statusCode: res.status,
        taskId: task.id,
        childrenCount: task.children.length,
        hasNestedChildren: task.children.some(c => Array.isArray(c.children) && c.children.length > 0),
      });
    } else {
      record('VAL-CORE-024', 'fail', {
        statusCode: res.status,
        body: res.body,
      }, `Expected task with children array. Got: children=${JSON.stringify(task?.children)?.substring(0, 200)}`);
    }
  } catch (e) {
    record('VAL-CORE-024', 'fail', {}, e.message);
  }

  // ========== VAL-CORE-025: 更新任务 ==========
  console.log('\n--- VAL-CORE-025: 更新任务 ---');
  try {
    // Create a new task to update
    const createRes = await request('POST', '/api/tasks', {
      project_id: projectId,
      title: 'Task To Update',
    });
    const updateTaskId = createRes.body?.data?.id;
    console.log(`Created task for update: ${updateTaskId}`);

    // Update it
    const updateRes = await request('PUT', `/api/tasks/${updateTaskId}`, {
      title: 'Updated Title',
      description: 'Updated description',
      estimated_days: 5,
    });
    console.log(`Update: ${updateRes.status} — ${JSON.stringify(updateRes.body)}`);

    // GET to confirm
    const getRes = await request('GET', `/api/tasks/${updateTaskId}`);
    const task = getRes.body?.data;
    console.log(`After update: title=${task?.title}, desc=${task?.description}, est_days=${task?.estimated_days}`);

    if (
      updateRes.status === 200 &&
      updateRes.body?.success === true &&
      task?.title === 'Updated Title' &&
      task?.description === 'Updated description' &&
      task?.estimated_days === 5
    ) {
      record('VAL-CORE-025', 'pass', {
        updateStatus: updateRes.status,
        confirmedTitle: task.title,
        confirmedDesc: task.description,
        confirmedEstDays: task.estimated_days,
      });
    } else {
      record('VAL-CORE-025', 'fail', {
        updateStatus: updateRes.status,
        updateBody: updateRes.body,
        getStatus: getRes.status,
        getBody: getRes.body,
      }, 'Update did not persist correctly');
    }
  } catch (e) {
    record('VAL-CORE-025', 'fail', {}, e.message);
  }

  // ========== VAL-CORE-030: 删除任务（级联软删除）==========
  console.log('\n--- VAL-CORE-030: 删除任务（级联软删除）---');
  try {
    // Create parent + child for deletion test
    const parentRes = await request('POST', '/api/tasks', {
      project_id: projectId,
      title: 'Parent To Delete',
    });
    const delParentId = parentRes.body?.data?.id;

    const childRes = await request('POST', '/api/tasks', {
      project_id: projectId,
      title: 'Child To Delete',
      parent_id: delParentId,
    });
    const delChildId = childRes.body?.data?.id;

    console.log(`Parent: ${delParentId}, Child: ${delChildId}`);

    // Delete parent (should cascade to child)
    const deleteRes = await request('DELETE', `/api/tasks/${delParentId}`);
    console.log(`Delete: ${deleteRes.status} — ${JSON.stringify(deleteRes.body)}`);

    // Try to GET parent
    const getParentRes = await request('GET', `/api/tasks/${delParentId}`);
    console.log(`GET parent after delete: ${getParentRes.status}`);

    // Try to GET child
    const getChildRes = await request('GET', `/api/tasks/${delChildId}`);
    console.log(`GET child after delete: ${getChildRes.status}`);

    if (
      deleteRes.status === 200 &&
      deleteRes.body?.success === true &&
      getParentRes.status === 404 &&
      getChildRes.status === 404
    ) {
      record('VAL-CORE-030', 'pass', {
        deleteStatus: deleteRes.status,
        parentAfterDelete: getParentRes.status,
        childAfterDelete: getChildRes.status,
      });
    } else {
      record('VAL-CORE-030', 'fail', {
        deleteStatus: deleteRes.status,
        deleteBody: deleteRes.body,
        parentAfterDelete: getParentRes.status,
        childAfterDelete: getChildRes.status,
      }, 'Cascade soft delete did not work as expected');
    }
  } catch (e) {
    record('VAL-CORE-030', 'fail', {}, e.message);
  }

  // ========== VAL-CORE-032: 任务排序 ==========
  console.log('\n--- VAL-CORE-032: 任务排序 ---');
  try {
    // Create 3 tasks for reorder test
    const t1 = await request('POST', '/api/tasks', { project_id: projectId, title: 'Reorder A' });
    const t2 = await request('POST', '/api/tasks', { project_id: projectId, title: 'Reorder B' });
    const t3 = await request('POST', '/api/tasks', { project_id: projectId, title: 'Reorder C' });
    const t1Id = t1.body?.data?.id;
    const t2Id = t2.body?.data?.id;
    const t3Id = t3.body?.data?.id;
    console.log(`Created reorder tasks: ${t1Id}, ${t2Id}, ${t3Id}`);

    // Reorder: reverse order
    const reorderRes = await request('PUT', '/api/tasks/reorder', {
      task_ids: [t3Id, t2Id, t1Id],
    });
    console.log(`Reorder: ${reorderRes.status} — ${JSON.stringify(reorderRes.body)}`);

    // GET tasks and check sort_order
    const listRes = await request('GET', `/api/tasks?project_id=${projectId}&parent_id=null`);
    const tasks = listRes.body?.data || [];
    
    // Find our reorder tasks
    const rt1 = tasks.find(t => t.id === t1Id);
    const rt2 = tasks.find(t => t.id === t2Id);
    const rt3 = tasks.find(t => t.id === t3Id);

    console.log(`sort_orders: t3=${rt3?.sort_order}, t2=${rt2?.sort_order}, t1=${rt1?.sort_order}`);

    // t3 should have lower sort_order than t2, t2 lower than t1
    if (
      reorderRes.status === 200 &&
      reorderRes.body?.success === true &&
      rt3?.sort_order < rt2?.sort_order &&
      rt2?.sort_order < rt1?.sort_order
    ) {
      record('VAL-CORE-032', 'pass', {
        reorderStatus: reorderRes.status,
        t3_sort: rt3?.sort_order,
        t2_sort: rt2?.sort_order,
        t1_sort: rt1?.sort_order,
      });
    } else {
      record('VAL-CORE-032', 'fail', {
        reorderStatus: reorderRes.status,
        reorderBody: reorderRes.body,
        sortOrders: { t1: rt1?.sort_order, t2: rt2?.sort_order, t3: rt3?.sort_order },
      }, 'Reorder did not update sort_order as expected');
    }
  } catch (e) {
    record('VAL-CORE-032', 'fail', {}, e.message);
  }

  // ========== VAL-CORE-036: 任务标题验证 ==========
  console.log('\n--- VAL-CORE-036: 任务标题验证 ---');
  try {
    // Test empty string title
    const res1 = await request('POST', '/api/tasks', {
      project_id: projectId,
      title: '',
    });
    console.log(`Empty title: ${res1.status} — ${JSON.stringify(res1.body)}`);

    if (
      res1.status === 400 &&
      res1.body?.success === false
    ) {
      record('VAL-CORE-036', 'pass', {
        statusCode: res1.status,
        body: res1.body,
      });
    } else {
      record('VAL-CORE-036', 'fail', {
        statusCode: res1.status,
        body: res1.body,
      }, `Expected 400 with success false. Got status=${res1.status}`);
    }
  } catch (e) {
    record('VAL-CORE-036', 'fail', {}, e.message);
  }

  // ========== VAL-CORE-037: parent_id 指向不存在的任务 ==========
  console.log('\n--- VAL-CORE-037: parent_id 指向不存在的任务 ---');
  try {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request('POST', '/api/tasks', {
      project_id: projectId,
      title: 'Orphan Task',
      parent_id: fakeId,
    });
    console.log(`Nonexistent parent: ${res.status} — ${JSON.stringify(res.body)}`);

    if (
      res.status === 400 &&
      res.body?.success === false
    ) {
      record('VAL-CORE-037', 'pass', {
        statusCode: res.status,
        body: res.body,
      });
    } else {
      record('VAL-CORE-037', 'fail', {
        statusCode: res.status,
        body: res.body,
      }, `Expected 400 with success false. Got status=${res.status}`);
    }
  } catch (e) {
    record('VAL-CORE-037', 'fail', {}, e.message);
  }

  // ========== VAL-CORE-039: 任务所有权隔离 ==========
  console.log('\n--- VAL-CORE-039: 任务所有权隔离 ---');
  try {
    // Register a second user
    const reg2Res = await request('POST', '/api/auth/register', {
      name: 'tasks_crud_user2',
      email: email2,
      password: 'TestPass123',
    });
    console.log(`Register user2: ${reg2Res.status}`);

    // Logout user1
    await request('POST', '/api/auth/logout');
    clearCookies();

    // Login as user2
    const login2Res = await request('POST', '/api/auth/login', {
      email: email2,
      password: 'TestPass123',
    });
    console.log(`Login user2: ${login2Res.status}`);

    // Try to GET task020Id (belongs to user1)
    const getRes = await request('GET', `/api/tasks/${task020Id}`);
    console.log(`User2 GET user1 task: ${getRes.status} — ${JSON.stringify(getRes.body)}`);

    // Try to PUT (update) task020Id
    const putRes = await request('PUT', `/api/tasks/${task020Id}`, { title: 'Hacked Title' });
    console.log(`User2 PUT user1 task: ${putRes.status}`);

    // Try to DELETE task020Id
    const delRes = await request('DELETE', `/api/tasks/${task020Id}`);
    console.log(`User2 DELETE user1 task: ${delRes.status}`);

    if (
      getRes.status === 404 &&
      putRes.status === 404 &&
      delRes.status === 404
    ) {
      record('VAL-CORE-039', 'pass', {
        getStatus: getRes.status,
        putStatus: putRes.status,
        deleteStatus: delRes.status,
      });
    } else {
      record('VAL-CORE-039', 'fail', {
        getStatus: getRes.status,
        getBody: getRes.body,
        putStatus: putRes.status,
        putBody: putRes.body,
        deleteStatus: delRes.status,
        deleteBody: delRes.body,
      }, 'Isolation breach: user2 was able to access user1 tasks');
    }
  } catch (e) {
    record('VAL-CORE-039', 'fail', {}, e.message);
  }

  // ========== WRITE REPORT ==========
  const report = {
    groupId: 'tasks-crud',
    testedAt: new Date().toISOString(),
    isolation: {
      apiUrl: BASE_URL,
      testUserEmail: uniqueEmail,
      cookieFile: COOKIE_FILE,
    },
    toolsUsed: ['node'],
    assertions: Object.entries(results).map(([id, r]) => ({
      id,
      title: getAssertionTitle(id),
      status: r.status,
      evidence: r.evidence,
      issues: r.reason || null,
    })),
    frictions: [],
    blockers: [],
    summary: `Tested ${Object.keys(results).length} assertions: ${Object.values(results).filter(r => r.status === 'pass').length} passed, ${Object.values(results).filter(r => r.status === 'fail').length} failed`,
  };

  console.log('\n=== SUMMARY ===');
  console.log(report.summary);
  console.log('\nFull report:');
  console.log(JSON.stringify(report, null, 2));
}

function getAssertionTitle(id) {
  const titles = {
    'VAL-CORE-020': '创建任务',
    'VAL-CORE-021': '创建子任务（指定 parent_id）',
    'VAL-CORE-022': '超过3级层级限制',
    'VAL-CORE-023': '查看任务列表',
    'VAL-CORE-024': '查看任务详情（含子任务树）',
    'VAL-CORE-025': '更新任务',
    'VAL-CORE-030': '删除任务（级联软删除）',
    'VAL-CORE-032': '任务排序',
    'VAL-CORE-036': '任务标题验证',
    'VAL-CORE-037': 'parent_id 指向不存在的任务',
    'VAL-CORE-039': '任务所有权隔离',
  };
  return titles[id] || id;
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
