import assert from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const testDatabaseDirectory = mkdtempSync(path.join(tmpdir(), 'chang-material-control-test-'));
process.env.CHANG_MATERIAL_DB_PATH = path.join(testDatabaseDirectory, 'test.sqlite');

const [
  { db, queryOne, queryAll, executeSql },
  { runSeed },
  { RestaurantModel },
  { MaterialModel },
  { ChecklistModel },
  { UserModel },
  { AssessmentModel },
  { ShiftConfigModel },
  { NotificationModel },
  { verifyPassword },
  { AuditLogModel },
  { AuthController },
  { SettingsModel }
] = await Promise.all([
  import('../src/database/db.js'),
  import('../src/database/seed.js'),
  import('../src/models/RestaurantModel.js'),
  import('../src/models/MaterialModel.js'),
  import('../src/models/ChecklistModel.js'),
  import('../src/models/UserModel.js'),
  import('../src/models/AssessmentModel.js'),
  import('../src/models/ShiftConfigModel.js'),
  import('../src/models/NotificationModel.js'),
  import('../src/utils/crypto.js'),
  import('../src/models/AuditLogModel.js'),
  import('../src/controllers/AuthController.js'),
  import('../src/models/SettingsModel.js')
]);

console.log('====================================================');
console.log(' RUNNING CHANG MATERIAL CONTROL AUTOMATED TEST SUITE');
console.log('====================================================\n');

try {
  // TEST 1: Database Seed & 15 Exact Restaurants Check
  console.log('TEST 1: Verifying Seed Data & 15 Exact Restaurants with Updated Short Codes...');
  assert.strictEqual(runSeed(), true, 'Seed should bootstrap an empty isolated test database');
  assert.strictEqual(queryOne('SELECT MAX(version) as version FROM schema_migrations').version, 1);
  const migrationColumns = {
    checklistItems: queryAll('PRAGMA table_info(checklist_items)').map(column => column.name),
    assessmentDetails: queryAll('PRAGMA table_info(assessment_details)').map(column => column.name)
  };
  assert.strictEqual(migrationColumns.checklistItems.includes('is_active'), true);
  assert.strictEqual(migrationColumns.assessmentDetails.includes('material_name_snapshot'), true);
  assert.strictEqual(migrationColumns.assessmentDetails.includes('material_code_snapshot'), true);
  const auditColumns = queryAll('PRAGMA table_info(audit_logs)');
  assert.strictEqual(auditColumns.some(column => column.name === 'restaurant_id'), true, 'Audit log must store restaurant context');

  const restaurants = RestaurantModel.getAll();
  assert.strictEqual(restaurants.length >= 15, true, 'Must have at least 15 restaurants');

  const expectedOutlets = [
    { code: 'CT-NDC', name: 'CT - Nguyễn Đức Cảnh' },
    { code: 'CT-PXL', name: 'CT - Phan Xích Long' },
    { code: 'CT-CT', name: 'CT - Cao Thắng' },
    { code: 'CT-VHM', name: 'CT - Vạn Hạnh Mall' },
    { code: 'CT-VVN', name: 'CT - Võ Văn Ngân' },
    { code: 'CT-HHT', name: 'CT - Hoàng Hoa Thám' },
    { code: 'CT-CK', name: 'CT - Central Kitchen' },
    { code: 'CT-DS7', name: 'CT - DS7' },
    { code: 'CT-NTD', name: 'CT - Nguyễn Thị Định' },
    { code: 'CT-CVI', name: 'CT - Cảnh Viên' },
    { code: 'CT-LGV', name: 'CT - Lotte Gò Vấp' },
    { code: 'CT-PVD', name: 'CT - Sense Phạm Văn Đồng' },
    { code: 'CT-LVS', name: 'CT - Lê Văn Sỹ' },
    { code: 'CT-XL', name: 'CT - Xuân La' },
    { code: 'CT-LDH', name: 'CT - Lê Đại Hành' }
  ];

  for (const item of expectedOutlets) {
    const found = restaurants.find(r => r.restaurant_name === item.name);
    assert.notStrictEqual(found, undefined, `Restaurant "${item.name}" must exist in DB`);
    assert.strictEqual(found.restaurant_code, item.code, `Restaurant "${item.name}" must have short code "${item.code}"`);
  }
  console.log('✓ PASS: All 15 exact restaurants and short codes verified!\n');

  console.log('TEST 1A: Verifying seed is bootstrap-only and does not overwrite existing business data...');
  const bootstrapMaterial = MaterialModel.getAll({ includeInactive: true })[0];
  const originalBootstrapName = bootstrapMaterial.material_name;
  MaterialModel.update(bootstrapMaterial.id, { material_name: 'TEST-KEEP-EXISTING-MATERIAL' });
  assert.strictEqual(runSeed(), false, 'Seed must skip a database that already contains business rows');
  assert.strictEqual(MaterialModel.getById(bootstrapMaterial.id).material_name, 'TEST-KEEP-EXISTING-MATERIAL');
  MaterialModel.update(bootstrapMaterial.id, { material_name: originalBootstrapName });
  console.log('✓ PASS: Explicit seed skips existing business data without overwriting it.\n');

  // TEST 2: Password Hashing Verification
  console.log('TEST 2: Verifying Password Hashing Security...');
  const adminUser = UserModel.getByUsername('admin');
  assert.notStrictEqual(adminUser, null, 'Admin user must exist');
  assert.strictEqual(adminUser.password_hash.includes(':'), true, 'Password must be hashed with salt (salt:hash format)');
  assert.notStrictEqual(adminUser.password_hash, 'Admin@123', 'Password MUST NOT be stored in plain text');
  assert.strictEqual(verifyPassword('Admin@123', adminUser.password_hash), true, 'Password verification must succeed');
  assert.strictEqual(verifyPassword('WrongPass', adminUser.password_hash), false, 'Wrong password must fail');
  console.log('✓ PASS: Salted PBKDF2 Password Hashing verified!\n');

  const loginResponse = {
    writeHead(statusCode) { this.statusCode = statusCode; },
    end(body) { this.body = body; }
  };
  AuthController.login({ headers: {} }, { username: 'admin', password: 'Admin@123' }, loginResponse);
  assert.strictEqual(loginResponse.statusCode, 200);
  const sessionToken = JSON.parse(loginResponse.body).token;
  const logoutResponse = {
    writeHead(statusCode) { this.statusCode = statusCode; },
    end(body) { this.body = body; }
  };
  AuthController.logout({ headers: { authorization: `Bearer ${sessionToken}` } }, logoutResponse);
  const authActions = AuditLogModel.getAll({ limit: 100 }).filter(log => log.user_id === adminUser.id);
  assert.strictEqual(authActions.some(log => log.action === 'LOGIN'), true);
  assert.strictEqual(authActions.some(log => log.action === 'LOGOUT'), true);
  console.log('✓ PASS: LOGIN/LOGOUT audit actions and restaurant migration verified!\n');

  // TEST 3: Duplicate Restaurant Code Validation
  console.log('TEST 3: Testing Duplicate Restaurant Code Prevention...');
  let duplicateErrorCaught = false;
  try {
    RestaurantModel.create({
      restaurant_code: 'CT-NDC',
      restaurant_name: 'Trùng Lặp Nguyễn Đức Cảnh'
    });
  } catch (err) {
    duplicateErrorCaught = true;
    assert.strictEqual(err.message.includes('đã tồn tại'), true, 'Error message must specify code already exists');
  }
  assert.strictEqual(duplicateErrorCaught, true, 'Duplicate code creation MUST be rejected');
  console.log('✓ PASS: Duplicate restaurant code rejection verified!\n');

  // TEST 4: Restaurant CRUD
  console.log('TEST 4: Testing Restaurant Master Data CRUD...');
  executeSql("DELETE FROM restaurants WHERE restaurant_code LIKE 'CT-TEST%'");

  const testCode = `CT-TEST${Date.now().toString().slice(-4)}`;
  const newRest = RestaurantModel.create({
    restaurant_code: testCode,
    restaurant_name: 'CT - Test Branch Temporary',
    status: 'ACTIVE'
  });
  assert.strictEqual(newRest.restaurant_code, testCode);
  assert.strictEqual(newRest.status, 'ACTIVE');

  const updatedRest = RestaurantModel.update(newRest.id, {
    restaurant_name: 'CT - Test Branch Updated'
  });
  assert.strictEqual(updatedRest.restaurant_name, 'CT - Test Branch Updated');

  const toggledRest = RestaurantModel.toggleStatus(newRest.id, 'INACTIVE');
  assert.strictEqual(toggledRest.status, 'INACTIVE');
  console.log('✓ PASS: Restaurant CRUD operations verified!\n');

  // TEST 5: Backend Data Isolation Security for RESTAURANT Role
  console.log('TEST 5: Testing Backend Restaurant Data Isolation (Phase 3 Security)...');
  const rest01User = UserModel.getByUsername('restaurant_01');
  assert.notStrictEqual(rest01User, null);
  assert.strictEqual(rest01User.role_code, 'RESTAURANT');
  const acUser = UserModel.create({
    username: `phase11.audit.${Date.now()}`,
    password: 'Phase11Test@123',
    full_name: 'Phase 11 Audit Test',
    role_code: 'AC_LD',
    assigned_restaurant_ids: [rest01User.restaurant_id]
  });
  const rest02Id = queryOne("SELECT id FROM restaurants WHERE restaurant_code = 'CT-PXL'").id;
  const filteredAssessments = AssessmentModel.getAll({
    user: rest01User,
    restaurant_id: rest02Id
  });

  for (const asm of filteredAssessments) {
    assert.strictEqual(asm.restaurant_id, rest01User.restaurant_id, 'Restaurant user MUST NOT receive data from other restaurants');
  }
  const temporaryAc = UserModel.create({
    username: `phase11.ac.${Date.now()}`,
    password: 'Phase11Test@123',
    full_name: 'Phase 11 Assignment Test',
    role_code: 'AC_LD',
    assigned_restaurant_ids: [rest01User.restaurant_id]
  });
  assert.deepStrictEqual(temporaryAc.assigned_restaurant_ids, [rest01User.restaurant_id]);
  assert.strictEqual(AssessmentModel.getAll({ user: temporaryAc, restaurant_id: rest02Id }).length, 0);
  const movedAc = UserModel.update(temporaryAc.id, { assigned_restaurant_ids: [rest02Id] });
  assert.deepStrictEqual(movedAc.assigned_restaurant_ids, [rest02Id]);
  let emptyAssignmentRejected = false;
  try {
    UserModel.update(temporaryAc.id, { assigned_restaurant_ids: [] });
  } catch (error) {
    emptyAssignmentRejected = true;
  }
  assert.strictEqual(emptyAssignmentRejected, true, 'AC/L&D users must have at least one assigned restaurant');
  executeSql('DELETE FROM users WHERE id = ?', [temporaryAc.id]);
  console.log('✓ PASS: Backend level restaurant data isolation verified!\n');

  console.log('TEST 5B: Testing checklist membership lifecycle and no implicit Material assignment...');
  const originalMemberships = ChecklistModel.getAssignments('chk-morn-01');
  const originalMembershipIds = originalMemberships.map(item => item.id);
  const membershipMaterial = MaterialModel.create({
    material_code: `MAT-MEMBERSHIP-${Date.now()}`,
    material_name: 'Membership Lifecycle Test Material',
    department: 'FOH',
    category: 'Test',
    unit: 'Unit',
    is_mandatory: 0,
    photo_required: 0
  });
  assert.strictEqual(ChecklistModel.getAssignments('chk-morn-01').some(item => item.material_id === membershipMaterial.id), false);
  const membership = ChecklistModel.addItem('chk-morn-01', {
    material_id: membershipMaterial.id,
    display_order: originalMemberships.length + 1,
    requirement_text: 'Initial requirement',
    is_mandatory: 0
  });
  assert.strictEqual(ChecklistModel.getItems('chk-morn-01').some(item => item.id === membership.id), true);
  ChecklistModel.updateItem(membership.id, { display_order: 2, requirement_text: 'Updated requirement', is_mandatory: 1 });
  assert.strictEqual(ChecklistModel.getAssignments('chk-morn-01').find(item => item.id === membership.id).requirement_text, 'Updated requirement');
  ChecklistModel.setItemActive(membership.id, 0);
  assert.strictEqual(ChecklistModel.getAssignments('chk-morn-01').find(item => item.id === membership.id).is_active, 0);
  assert.strictEqual(ChecklistModel.getItems('chk-morn-01').some(item => item.id === membership.id), false);
  ChecklistModel.setItemActive(membership.id, 1);
  const assignmentsToReorder = ChecklistModel.getAssignments('chk-morn-01').map((item, index) => ({ id: item.id, display_order: index + 1 }));
  ChecklistModel.reorderItems('chk-morn-01', assignmentsToReorder);
  const preservedIds = ChecklistModel.getAssignments('chk-morn-01').map(item => item.id);
  assert.strictEqual(originalMembershipIds.every(id => preservedIds.includes(id)), true, 'Existing ChecklistItem rows must be preserved');
  console.log('✓ PASS: Membership add/edit/deactivate/reactivate/reorder and explicit Material assignment verified.\n');

  console.log('TEST 5A: Testing Admin Material Lifecycle and System Settings...');
  const testMaterial = MaterialModel.create({
    material_code: `MAT-TEST-${Date.now()}`,
    material_name: 'Phase 11 Temporary Material',
    department: 'FOH',
    category: 'Test Category',
    unit: 'Unit',
    is_mandatory: 1,
    photo_required: 0
  });
  assert.strictEqual(testMaterial.is_mandatory, 1);
  assert.strictEqual(MaterialModel.update(testMaterial.id, { photo_required: 1 }).photo_required, 1);
  assert.strictEqual(MaterialModel.setActive(testMaterial.id, 0).is_active, 0);
  assert.strictEqual(MaterialModel.getAll().some(material => material.id === testMaterial.id), false);
  assert.strictEqual(MaterialModel.getAll({ includeInactive: true }).some(material => material.id === testMaterial.id), true);
  executeSql('DELETE FROM materials WHERE id = ?', [testMaterial.id]);

  const originalSettings = SettingsModel.getMap();
  const updatedSettings = SettingsModel.update({ REPORT_DEFAULT_PERIOD: 'WEEKLY' }, adminUser.id);
  assert.strictEqual(updatedSettings.find(setting => setting.key === 'REPORT_DEFAULT_PERIOD').value, 'WEEKLY');
  SettingsModel.update({ REPORT_DEFAULT_PERIOD: originalSettings.REPORT_DEFAULT_PERIOD }, adminUser.id);
  console.log('✓ PASS: Material lifecycle and settings validation verified!\n');

  // TEST 6: Phase 5 - Material Checklist Engine Business Rules
  console.log('TEST 6: Testing Phase 5 Material Checklist Engine (FOH/BOH, Color/Smell/Taste/Quality, Auto Allowed To Serve)...');
  
  const chkItems = queryAll("SELECT ci.*, m.department, m.is_mandatory, m.photo_required FROM checklist_items ci JOIN materials m ON ci.material_id = m.id WHERE ci.checklist_id = 'chk-morn-01'");
  assert.strictEqual(chkItems.length >= 7, true, 'Checklist must contain FOH & BOH items');
  const materialToDeactivate = chkItems[0].material_id;
  MaterialModel.setActive(materialToDeactivate, 0);
  assert.strictEqual(ChecklistModel.getItems('chk-morn-01').some(item => item.material_id === materialToDeactivate), false);
  MaterialModel.setActive(materialToDeactivate, 1);

  // Subtest 6A: Submitting with all PASS -> Allowed To Serve = YES
  const passItems = chkItems.map(item => ({
    checklist_item_id: item.id,
    color_result: 'PASS',
    smell_result: 'PASS',
    taste_result: 'PASS',
    quality_result: 'PASS',
    remark: '',
    photo_url: item.photo_required ? 'sample_photo.jpg' : ''
  }));

  const asmPass = AssessmentModel.create({
    user: rest01User,
    restaurant_id: rest01User.restaurant_id,
    checklist_id: 'chk-morn-01',
    shift_type: 'MORNING',
    shift_date: new Date().toISOString().split('T')[0],
    items: passItems
  });

  assert.strictEqual(asmPass.overall_allowed_to_serve, 'YES', 'All PASS must yield Allowed To Serve = YES');
  assert.strictEqual(asmPass.score, 100, 'Score must be 100%');
  const snapshottedItem = asmPass.details[0];
  const materialBeforeRename = MaterialModel.getById(snapshottedItem.material_id);
  MaterialModel.update(snapshottedItem.material_id, { material_name: 'Temporary renamed material' });
  const historicalAssessment = AssessmentModel.getById(asmPass.id, rest01User);
  assert.strictEqual(
    historicalAssessment.details.find(item => item.material_id === snapshottedItem.material_id).material_name,
    materialBeforeRename.material_name,
    'Historical assessment material name must remain the submit-time snapshot'
  );
  assert.strictEqual(
    historicalAssessment.details.find(item => item.material_id === snapshottedItem.material_id).material_code,
    materialBeforeRename.material_code,
    'Historical assessment material code must remain the submit-time snapshot'
  );
  MaterialModel.update(snapshottedItem.material_id, { material_name: materialBeforeRename.material_name });
  const passHistory = AssessmentModel.getAll({ user: rest01User, shift_date: asmPass.shift_date })
    .find(assessment => assessment.id === asmPass.id);
  assert.strictEqual(passHistory.total_count, chkItems.length);
  assert.strictEqual(passHistory.pass_count, chkItems.length);
  assert.strictEqual(passHistory.fail_count, 0);
  assert.strictEqual(passHistory.foh_total_count + passHistory.boh_total_count, passHistory.total_count);
  const completedNotification = NotificationModel.getForUser(acUser.id, { limit: 100 })
    .find(notification => notification.data?.assessment_id === asmPass.id && notification.type === 'CHECKLIST_COMPLETED');
  assert.notStrictEqual(completedNotification, undefined, 'Checklist submission must notify AC/L&D');
  assert.strictEqual(completedNotification.status, 'UNREAD');
  assert.strictEqual(completedNotification.data.pass_count, chkItems.length);
  assert.strictEqual(completedNotification.data.fail_count, 0);
  const submitAudit = AuditLogModel.getAll({ limit: 100 })
    .find(log => log.entity_id === asmPass.id && log.action === 'CHECKLIST SUBMIT');
  assert.strictEqual(submitAudit.restaurant_id, rest01User.restaurant_id);
  console.log('  ✓ Subtest 6A PASS: All PASS yields Allowed To Serve = YES & 100% score.');

  // Subtest 6B: Submitting mandatory item FAIL -> Allowed To Serve = NO
  const failItems = chkItems.map(item => ({
    checklist_item_id: item.id,
    color_result: item.is_mandatory ? 'FAIL' : 'PASS',
    smell_result: 'PASS',
    taste_result: 'PASS',
    quality_result: 'PASS',
    remark: item.is_mandatory ? 'Chất lượng không đạt tiêu chuẩn' : '',
    photo_url: item.photo_required ? 'sample_photo.jpg' : ''
  }));

  const asmFail = AssessmentModel.create({
    user: rest01User,
    restaurant_id: rest01User.restaurant_id,
    checklist_id: 'chk-morn-01',
    shift_type: 'EVENING',
    shift_date: new Date().toISOString().split('T')[0],
    items: failItems
  });

  assert.strictEqual(asmFail.overall_allowed_to_serve, 'NO', 'Mandatory FAIL must yield Allowed To Serve = NO');
  const failHistory = AssessmentModel.getAll({ user: rest01User, shift_date: asmFail.shift_date })
    .find(assessment => assessment.id === asmFail.id);
  assert.strictEqual(failHistory.fail_count, asmFail.details.filter(item => item.overall_result === 'FAIL').length);
  assert.strictEqual(failHistory.total_count, failHistory.pass_count + failHistory.fail_count);
  assert.strictEqual(failHistory.foh_fail_count + failHistory.boh_fail_count, failHistory.fail_count);
  const issueNotifications = NotificationModel.getForUser(acUser.id, { limit: 100 })
    .filter(notification => notification.data?.assessment_id === asmFail.id && notification.type === 'MATERIAL_ISSUE');
  assert.strictEqual(issueNotifications.length, asmFail.details.filter(item => item.overall_result === 'FAIL').length);
  assert.strictEqual(issueNotifications.every(notification => notification.data.allowed_to_serve === 'NO'), true);
  const failAudits = AuditLogModel.getAll({ limit: 100 }).filter(log => log.entity_type === 'MATERIAL' && log.new_values?.includes(asmFail.id));
  assert.strictEqual(failAudits.length, issueNotifications.length);
  assert.strictEqual(failAudits.every(log => log.action === 'MATERIAL FAIL' && log.restaurant_id === rest01User.restaurant_id), true);
  assert.strictEqual(NotificationModel.markRead(issueNotifications[0].id, rest01User.id), null, 'Restaurant users cannot mark AC notifications as read');
  assert.strictEqual(NotificationModel.markRead(issueNotifications[0].id, acUser.id).status, 'READ');
  const failIssues = AssessmentModel.getMaterialIssues({
    user: rest01User,
    from_date: asmFail.shift_date,
    to_date: asmFail.shift_date,
    assessment_id: asmFail.id
  });
  assert.strictEqual(failIssues.length > 0, true, 'Material FAIL details must be available for the control center');
  assert.strictEqual(failIssues.every(issue => issue.overall_result === 'FAIL'), true);
  assert.strictEqual(failIssues.every(issue => issue.restaurant_id === rest01User.restaurant_id), true);
  NotificationModel.markAllRead(acUser.id);
  assert.strictEqual(NotificationModel.getUnreadCount(acUser.id), 0, 'Mark all read must clear the AC user unread count');
  console.log('  ✓ Subtest 6B PASS: Mandatory FAIL yields Allowed To Serve = NO.');

  // Subtest 6C: FAIL without Remark MUST be rejected
  let remarkErrorCaught = false;
  try {
    const invalidRemarkItems = chkItems.map(item => ({
      checklist_item_id: item.id,
      color_result: 'FAIL',
      smell_result: 'PASS',
      taste_result: 'PASS',
      quality_result: 'PASS',
      remark: '',
      photo_url: item.photo_required ? 'sample_photo.jpg' : ''
    }));
    AssessmentModel.create({
      user: rest01User,
      restaurant_id: rest01User.restaurant_id,
      checklist_id: 'chk-morn-01',
      shift_type: 'MORNING',
      items: invalidRemarkItems
    });
  } catch (e) {
    remarkErrorCaught = true;
    assert.strictEqual(e.message.includes('Remark'), true);
  }
  assert.strictEqual(remarkErrorCaught, true, 'FAIL item without Remark must be rejected');
  console.log('  ✓ Subtest 6C PASS: FAIL item without Remark is rejected.');

  // Subtest 6D: Photo Required item without photo MUST be rejected
  let photoErrorCaught = false;
  try {
    const invalidPhotoItems = chkItems.map(item => ({
      checklist_item_id: item.id,
      color_result: 'PASS',
      smell_result: 'PASS',
      taste_result: 'PASS',
      quality_result: 'PASS',
      remark: '',
      photo_url: ''
    }));
    AssessmentModel.create({
      user: rest01User,
      restaurant_id: rest01User.restaurant_id,
      checklist_id: 'chk-morn-01',
      shift_type: 'MORNING',
      items: invalidPhotoItems
    });
  } catch (e) {
    photoErrorCaught = true;
    assert.strictEqual(e.message.includes('hình ảnh'), true);
  }
  assert.strictEqual(photoErrorCaught, true, 'Photo Required item without photo must be rejected');
  console.log('  ✓ Subtest 6D PASS: Photo Required item without photo is rejected.\n');

  // TEST 7: Phase 6 - Shift Deadline Engine Configuration
  console.log('TEST 7: Testing Phase 6 Shift Deadline Engine (DB Storage & Dynamic Update)...');
  const shifts = ShiftConfigModel.getAll();
  assert.strictEqual(shifts.length >= 3, true, 'Must have 3 shifts configured in DB');

  const morningConfig = ShiftConfigModel.getByCode('MORNING');
  assert.notStrictEqual(morningConfig, null);
  assert.strictEqual(morningConfig.deadline_time, '10:30');

  const updatedMorn = ShiftConfigModel.update('MORNING', { deadline_time: '11:00' });
  assert.strictEqual(updatedMorn.deadline_time, '11:00');
  const updatedReminder = ShiftConfigModel.update('MORNING', { reminder_minutes_before: 15 });
  assert.strictEqual(updatedReminder.reminder_minutes_before, 15);
  let invalidReminderRejected = false;
  try {
    ShiftConfigModel.update('MORNING', { reminder_minutes_before: 1500 });
  } catch {
    invalidReminderRejected = true;
  }
  assert.strictEqual(invalidReminderRejected, true, 'Reminder must be constrained to a valid minute range');

  ShiftConfigModel.update('MORNING', { deadline_time: '10:30', reminder_minutes_before: 30 });
  console.log('✓ PASS: Phase 6 Shift Deadline DB Configuration & Admin Update verified!\n');

  executeSql('DELETE FROM notifications WHERE user_id = ?', [acUser.id]);
  executeSql('DELETE FROM audit_logs WHERE user_id = ?', [acUser.id]);
  executeSql('DELETE FROM users WHERE id = ?', [acUser.id]);

  console.log('====================================================');
  console.log(' ALL AUTOMATED TESTS PASSED CLEANLY (100% SUCCESS)');
  console.log('====================================================');
} catch (err) {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exitCode = 1;
} finally {
  db.close();
  rmSync(testDatabaseDirectory, { recursive: true, force: true });
}
