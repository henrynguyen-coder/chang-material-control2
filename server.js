import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertMigrationsApplied } from './src/database/migrations/runner.js';
import { AuthController } from './src/controllers/AuthController.js';
import { RestaurantController } from './src/controllers/RestaurantController.js';
import { AssessmentController } from './src/controllers/AssessmentController.js';
import { MasterDataController } from './src/controllers/MasterDataController.js';
import { ShiftConfigController } from './src/controllers/ShiftConfigController.js';
import { NotificationController } from './src/controllers/NotificationController.js';
import { AuditLogController } from './src/controllers/AuditLogController.js';
import { SettingsController } from './src/controllers/SettingsController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = process.env.PORT || 3000;

// Startup verifies schema readiness but never seeds or migrates business data.
assertMigrationsApplied();

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'text/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function parseRequestBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const searchParams = parsedUrl.searchParams;

  console.log(`[${req.method}] ${pathname}`);

  // API Routing
  if (pathname.startsWith('/api/')) {
    const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await parseRequestBody(req) : {};

    // Auth Routes
    if (pathname === '/api/auth/login' && req.method === 'POST') {
      return AuthController.login(req, body, res);
    }
    if (pathname === '/api/auth/logout' && req.method === 'POST') {
      return AuthController.logout(req, res);
    }
    if (pathname === '/api/auth/me' && req.method === 'GET') {
      return AuthController.me(req, res);
    }
    if (pathname === '/api/audit-events' && req.method === 'POST') {
      return AuditLogController.recordChecklistEvent(req, body, res);
    }
    if (pathname === '/api/settings' && req.method === 'GET') {
      return SettingsController.getAll(req, res);
    }
    if (pathname === '/api/settings' && req.method === 'PUT') {
      return SettingsController.update(req, body, res);
    }

    if (pathname === '/api/notifications' && req.method === 'GET') {
      return NotificationController.getAll(req, searchParams, res);
    }
    if (pathname === '/api/notifications/read-all' && req.method === 'PATCH') {
      return NotificationController.markAllRead(req, res);
    }
    const notificationReadMatch = pathname.match(/^\/api\/notifications\/([^/]+)\/read$/);
    if (notificationReadMatch && req.method === 'PATCH') {
      return NotificationController.markRead(req, notificationReadMatch[1], res);
    }

    // Restaurant Routes (Phase 2 Master Data & RBAC)
    if (pathname === '/api/restaurants' && req.method === 'GET') {
      return RestaurantController.getAll(req, searchParams, res);
    }
    if (pathname === '/api/restaurants' && req.method === 'POST') {
      return RestaurantController.create(req, body, res);
    }
    if (pathname.match(/^\/api\/restaurants\/([^\/]+)$/) && req.method === 'GET') {
      const id = pathname.split('/')[3];
      return RestaurantController.getById(req, id, res);
    }
    if (pathname.match(/^\/api\/restaurants\/([^\/]+)$/) && req.method === 'PUT') {
      const id = pathname.split('/')[3];
      return RestaurantController.update(req, id, body, res);
    }
    if (pathname.match(/^\/api\/restaurants\/([^\/]+)\/status$/) && req.method === 'PATCH') {
      const id = pathname.split('/')[3];
      return RestaurantController.toggleStatus(req, id, body, res);
    }

    // Shift Deadline Engine Routes (Phase 6)
    if (pathname === '/api/shifts' && req.method === 'GET') {
      return ShiftConfigController.getAll(req, res);
    }
    if (pathname.match(/^\/api\/shifts\/([^\/]+)$/) && req.method === 'PUT') {
      const code = pathname.split('/')[3];
      return ShiftConfigController.update(req, code, body, res);
    }

    // Assessment Routes (Phase 4 & 5 Shift Control & Checklist Engine)
    if (pathname === '/api/assessments' && req.method === 'GET') {
      return AssessmentController.getAll(req, searchParams, res);
    }
    if (pathname === '/api/material-issues' && req.method === 'GET') {
      return AssessmentController.getMaterialIssues(req, searchParams, res);
    }
    if (pathname === '/api/assessments' && req.method === 'POST') {
      return AssessmentController.create(req, body, res);
    }
    if (pathname.match(/^\/api\/assessments\/([^\/]+)$/) && req.method === 'GET') {
      const id = pathname.split('/')[3];
      return AssessmentController.getById(req, id, res);
    }

    // Master Data Routes
    if (pathname === '/api/materials' && req.method === 'GET') {
      return MasterDataController.getMaterials(req, res, searchParams);
    }
    if (pathname === '/api/materials' && req.method === 'POST') {
      return MasterDataController.createMaterial(req, body, res);
    }
    const materialUpdateMatch = pathname.match(/^\/api\/materials\/([^/]+)$/);
    if (materialUpdateMatch && req.method === 'PUT') {
      return MasterDataController.updateMaterial(req, materialUpdateMatch[1], body, res);
    }
    const materialStatusMatch = pathname.match(/^\/api\/materials\/([^/]+)\/status$/);
    if (materialStatusMatch && req.method === 'PATCH') {
      return MasterDataController.setMaterialStatus(req, materialStatusMatch[1], body, res);
    }
    if (pathname === '/api/checklists' && req.method === 'GET') {
      return MasterDataController.getChecklists(req, res);
    }
    const checklistReorderMatch = pathname.match(/^\/api\/checklists\/([^/]+)\/items\/reorder$/);
    if (checklistReorderMatch && req.method === 'PUT') {
      return MasterDataController.reorderChecklistItems(req, checklistReorderMatch[1], body, res);
    }
    const checklistItemsMatch = pathname.match(/^\/api\/checklists\/([^/]+)\/items$/);
    if (checklistItemsMatch && req.method === 'GET') {
      return MasterDataController.getChecklistItems(req, checklistItemsMatch[1], searchParams, res);
    }
    if (checklistItemsMatch && req.method === 'POST') {
      return MasterDataController.addChecklistItem(req, checklistItemsMatch[1], body, res);
    }
    const checklistAssignmentsMatch = pathname.match(/^\/api\/checklists\/([^/]+)\/assignments$/);
    if (checklistAssignmentsMatch && req.method === 'GET') {
      return MasterDataController.getChecklistAssignments(req, checklistAssignmentsMatch[1], searchParams, res);
    }
    const checklistItemStatusMatch = pathname.match(/^\/api\/checklist-items\/([^/]+)\/status$/);
    if (checklistItemStatusMatch && req.method === 'PATCH') {
      return MasterDataController.setChecklistItemStatus(req, checklistItemStatusMatch[1], body, res);
    }
    const checklistItemUpdateMatch = pathname.match(/^\/api\/checklist-items\/([^/]+)$/);
    if (checklistItemUpdateMatch && req.method === 'PUT') {
      return MasterDataController.updateChecklistItem(req, checklistItemUpdateMatch[1], body, res);
    }
    if (pathname === '/api/roles' && req.method === 'GET') {
      return MasterDataController.getRoles(req, res);
    }
    if (pathname === '/api/users' && req.method === 'GET') {
      return MasterDataController.getUsers(req, res);
    }
    if (pathname === '/api/users' && req.method === 'POST') {
      return MasterDataController.createUser(req, body, res);
    }
    const userUpdateMatch = pathname.match(/^\/api\/users\/([^/]+)$/);
    if (userUpdateMatch && req.method === 'PUT') {
      return MasterDataController.updateUser(req, userUpdateMatch[1], body, res);
    }
    if (pathname === '/api/audit-logs' && req.method === 'GET') {
      return MasterDataController.getAuditLogs(req, res);
    }

    // Not Found API
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint API không tồn tại' }));
    return;
  }

  // Static File Serving
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(PUBLIC_DIR, 'index.html');
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500);
      res.end('Server Error');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(` CHANG MATERIAL CONTROL SYSTEM RUNNING AT:`);
  console.log(` http://localhost:${PORT}`);
  console.log(`===================================================`);
});
