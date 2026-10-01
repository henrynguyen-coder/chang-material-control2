import { db, queryAll, queryOne, executeSql } from '../database/db.js';
import { NotificationModel } from './NotificationModel.js';
import { AuditLogModel } from './AuditLogModel.js';
import { UserModel } from './UserModel.js';
import crypto from 'node:crypto';

export class AssessmentModel {
  static getAll({ user, restaurant_id, shift_type, shift_date, from_date, to_date, limit = 500 } = {}) {
    let sql = `
      SELECT ma.*, r.restaurant_code, r.restaurant_name, u.full_name as inspector_name, c.title as checklist_title,
             (SELECT COUNT(*) FROM assessment_details ad WHERE ad.assessment_id = ma.id) as total_count,
             (SELECT COUNT(*) FROM assessment_details ad WHERE ad.assessment_id = ma.id AND ad.overall_result = 'PASS') as pass_count,
             (SELECT COUNT(*) FROM assessment_details ad WHERE ad.assessment_id = ma.id AND ad.overall_result = 'FAIL') as fail_count,
             (SELECT COUNT(*) FROM assessment_details ad WHERE ad.assessment_id = ma.id AND ad.department = 'FOH') as foh_total_count,
             (SELECT COUNT(*) FROM assessment_details ad WHERE ad.assessment_id = ma.id AND ad.department = 'FOH' AND ad.overall_result = 'FAIL') as foh_fail_count,
             (SELECT COUNT(*) FROM assessment_details ad WHERE ad.assessment_id = ma.id AND ad.department = 'BOH') as boh_total_count,
             (SELECT COUNT(*) FROM assessment_details ad WHERE ad.assessment_id = ma.id AND ad.department = 'BOH' AND ad.overall_result = 'FAIL') as boh_fail_count
      FROM material_assessments ma
      JOIN restaurants r ON ma.restaurant_id = r.id
      JOIN users u ON ma.inspector_id = u.id
      JOIN checklists c ON ma.checklist_id = c.id
      WHERE 1=1
    `;
    const params = [];

    // ENFORCE SECURITY AT BACKEND LEVEL
    if (user.role_code === 'RESTAURANT') {
      sql += ' AND ma.restaurant_id = ?';
      params.push(user.restaurant_id);
    } else if (user.role_code === 'AC_LD') {
      const assignedIds = user.assigned_restaurant_ids || UserModel.getAssignedRestaurantIds(user.id);
      if (restaurant_id) {
        sql += assignedIds.includes(restaurant_id) ? ' AND ma.restaurant_id = ?' : ' AND 1 = 0';
        if (assignedIds.includes(restaurant_id)) params.push(restaurant_id);
      } else if (assignedIds.length) {
        sql += ` AND ma.restaurant_id IN (${assignedIds.map(() => '?').join(', ')})`;
        params.push(...assignedIds);
      } else {
        sql += ' AND 1 = 0';
      }
    } else if (restaurant_id) {
      sql += ' AND ma.restaurant_id = ?';
      params.push(restaurant_id);
    }

    if (shift_type) {
      sql += ' AND ma.shift_type = ?';
      params.push(shift_type);
    }

    if (shift_date) {
      sql += ' AND ma.shift_date = ?';
      params.push(shift_date);
    }

    if (from_date) {
      sql += ' AND ma.shift_date >= ?';
      params.push(from_date);
    }

    if (to_date) {
      sql += ' AND ma.shift_date <= ?';
      params.push(to_date);
    }

    const safeLimit = Math.max(1, Math.min(Number.parseInt(limit, 10) || 500, 5000));
    sql += ' ORDER BY ma.shift_date DESC, ma.created_at DESC LIMIT ?';
    params.push(safeLimit);
    return queryAll(sql, params);
  }

  static getMaterialIssues({ user, restaurant_id, shift_type, shift_date, from_date, to_date, assessment_id } = {}) {
    let sql = `
      SELECT ad.id as issue_id, ma.id as assessment_id, ma.restaurant_id,
             ma.shift_date, ma.shift_type, ma.submitted_at, ma.score,
             r.restaurant_code, r.restaurant_name, u.full_name as inspector_name,
             m.id as material_id,
             COALESCE(ad.material_code_snapshot, m.material_code) as material_code,
             COALESCE(ad.material_name_snapshot, m.material_name) as material_name,
             ad.department,
             ad.overall_result, ad.allowed_to_serve, ad.remark, ad.photo_url
      FROM assessment_details ad
      JOIN material_assessments ma ON ad.assessment_id = ma.id
      JOIN restaurants r ON ma.restaurant_id = r.id
      JOIN users u ON ma.inspector_id = u.id
      JOIN materials m ON ad.material_id = m.id
      WHERE ad.overall_result = 'FAIL'
    `;
    const params = [];

    if (user.role_code === 'RESTAURANT') {
      sql += ' AND ma.restaurant_id = ?';
      params.push(user.restaurant_id);
    } else if (user.role_code === 'AC_LD') {
      const assignedIds = user.assigned_restaurant_ids || UserModel.getAssignedRestaurantIds(user.id);
      if (restaurant_id) {
        sql += assignedIds.includes(restaurant_id) ? ' AND ma.restaurant_id = ?' : ' AND 1 = 0';
        if (assignedIds.includes(restaurant_id)) params.push(restaurant_id);
      } else if (assignedIds.length) {
        sql += ` AND ma.restaurant_id IN (${assignedIds.map(() => '?').join(', ')})`;
        params.push(...assignedIds);
      } else {
        sql += ' AND 1 = 0';
      }
    } else if (restaurant_id) {
      sql += ' AND ma.restaurant_id = ?';
      params.push(restaurant_id);
    }

    if (shift_type) {
      sql += ' AND ma.shift_type = ?';
      params.push(shift_type);
    }

    if (shift_date) {
      sql += ' AND ma.shift_date = ?';
      params.push(shift_date);
    }

    if (from_date) {
      sql += ' AND ma.shift_date >= ?';
      params.push(from_date);
    }

    if (to_date) {
      sql += ' AND ma.shift_date <= ?';
      params.push(to_date);
    }

    if (assessment_id) {
      sql += ' AND ma.id = ?';
      params.push(assessment_id);
    }

    sql += ' ORDER BY ma.submitted_at DESC, m.department ASC, m.material_name ASC';
    return queryAll(sql, params);
  }

  static getById(id, user) {
    const assessment = queryOne(
      `SELECT ma.*, r.restaurant_code, r.restaurant_name, u.full_name as inspector_name, c.title as checklist_title
       FROM material_assessments ma
       JOIN restaurants r ON ma.restaurant_id = r.id
       JOIN users u ON ma.inspector_id = u.id
       JOIN checklists c ON ma.checklist_id = c.id
       WHERE ma.id = ?`,
      [id]
    );

    if (!assessment) return null;

    // Backend Security Check: Restrict RESTAURANT user to assigned restaurant
    if (user.role_code === 'RESTAURANT' && assessment.restaurant_id !== user.restaurant_id) {
      const error = new Error('Truy cập bị từ chối: Bạn không có quyền xem dữ liệu của nhà hàng khác');
      error.statusCode = 403;
      throw error;
    }
    if (user.role_code === 'AC_LD') {
      const assignedIds = user.assigned_restaurant_ids || UserModel.getAssignedRestaurantIds(user.id);
      if (!assignedIds.includes(assessment.restaurant_id)) {
        const error = new Error('Truy cập bị từ chối: Nhà hàng chưa được gán cho tài khoản AC/L&D');
        error.statusCode = 403;
        throw error;
      }
    }

    const details = queryAll(
            `SELECT ad.*, ci.requirement_text, ci.target_temp,
              COALESCE(ad.material_code_snapshot, m.material_code) as material_code,
              COALESCE(ad.material_name_snapshot, m.material_name) as material_name,
              ad.department, m.unit, m.is_mandatory, m.photo_required
       FROM assessment_details ad
       JOIN checklist_items ci ON ad.checklist_item_id = ci.id
       JOIN materials m ON ad.material_id = m.id
       WHERE ad.assessment_id = ?`,
      [id]
    );

    assessment.details = details;
    return assessment;
  }

  static create({ user, restaurant_id, checklist_id, shift_type, shift_date, notes, items = [] }) {
    // 1. Enforce Restaurant ID Security
    let targetRestaurantId = restaurant_id;
    if (user.role_code === 'RESTAURANT') {
      targetRestaurantId = user.restaurant_id;
    }

    if (!targetRestaurantId) {
      throw new Error('Không xác định được nhà hàng cần kiểm tra');
    }

    // 2. Fetch all required checklist items with material definitions
    const checklistItems = queryAll(
      `SELECT ci.*, m.id as mat_id, m.material_code, m.material_name, m.department, m.is_mandatory, m.photo_required
       FROM checklist_items ci
       JOIN materials m ON ci.material_id = m.id
      WHERE ci.checklist_id = ? AND ci.is_active = 1 AND m.is_active = 1`,
      [checklist_id || 'chk-morn-01']
    );

    // Map item payload by checklist_item_id
    const itemMap = new Map();
    items.forEach(it => itemMap.set(it.checklist_item_id, it));

    // 3. Validation: Verify all MANDATORY materials are inspected
    const missingMandatory = [];
    for (const ci of checklistItems) {
      if (ci.is_mandatory && !itemMap.has(ci.id)) {
        missingMandatory.push(`${ci.material_name} (${ci.department})`);
      }
    }

    if (missingMandatory.length > 0) {
      throw new Error(`Không thể nộp! Chưa hoàn thành kiểm tra các nguyên vật liệu bắt buộc (Mandatory): ${missingMandatory.join(', ')}`);
    }

    // 4. Process Each Item & Apply Phase 5 Business Rules
    let overallAllowedToServe = 'YES';
    let totalScore = 0;
    let totalEvaluated = 0;

    const processedDetails = [];

    for (const ci of checklistItems) {
      const payload = itemMap.get(ci.id);
      if (!payload) continue; // Optional uninspected item

      const colorRes = ['PASS', 'FAIL', 'N/A'].includes(payload.color_result) ? payload.color_result : 'PASS';
      const smellRes = ['PASS', 'FAIL', 'N/A'].includes(payload.smell_result) ? payload.smell_result : 'PASS';
      const tasteRes = ['PASS', 'FAIL', 'N/A'].includes(payload.taste_result) ? payload.taste_result : 'PASS';
      const qualityRes = ['PASS', 'FAIL', 'N/A'].includes(payload.quality_result) ? payload.quality_result : 'PASS';

      const hasFail = (colorRes === 'FAIL' || smellRes === 'FAIL' || tasteRes === 'FAIL' || qualityRes === 'FAIL');

      // AUTOMATIC BUSINESS LOGIC:
      // If ANY criterion is FAIL -> overall_result = FAIL, allowed_to_serve = NO (for mandatory)
      // USER CANNOT EDIT allowed_to_serve!
      let itemOverall = 'PASS';
      let itemAllowed = 'YES';

      if (hasFail) {
        itemOverall = 'FAIL';
        if (ci.is_mandatory) {
          itemAllowed = 'NO';
          overallAllowedToServe = 'NO';
        }
      }

      // Check Remark Requirement
      const remarkText = (payload.remark || '').trim();
      if (hasFail && !remarkText) {
        throw new Error(`Bắt buộc nhập Remark (ghi chú nguyên nhân) cho vật tư bị FAIL: "${ci.material_name}"`);
      }

      // Check Photo Requirement
      const photoUrl = (payload.photo_url || '').trim();
      if (ci.photo_required && !photoUrl) {
        throw new Error(`Vật tư "${ci.material_name}" yêu cầu hình ảnh chụp thực tế (Photo Required). Vui lòng tải/chụp hình trước khi nộp!`);
      }

      if (itemOverall === 'PASS') totalScore += 100;
      totalEvaluated++;

      processedDetails.push({
        checklist_item_id: ci.id,
        material_id: ci.mat_id,
        material_name_snapshot: ci.material_name,
        material_code_snapshot: ci.material_code,
        department: ci.department,
        color_result: colorRes,
        smell_result: smellRes,
        taste_result: tasteRes,
        quality_result: qualityRes,
        overall_result: itemOverall,
        allowed_to_serve: itemAllowed,
        remark: remarkText,
        photo_url: photoUrl
      });
    }

    const finalScore = totalEvaluated > 0 ? Math.round(totalScore / totalEvaluated) : 100;
    const id = `asm-${crypto.randomBytes(6).toString('hex')}`;
    const now = new Date().toISOString();
    const todayStr = shift_date || now.split('T')[0];

    db.exec('BEGIN');
    try {
      executeSql(
        `INSERT INTO material_assessments (id, restaurant_id, checklist_id, inspector_id, shift_date, shift_type, status, overall_allowed_to_serve, score, notes, submitted_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'SUBMITTED', ?, ?, ?, ?, ?)`,
        [id, targetRestaurantId, checklist_id || 'chk-morn-01', user.id, todayStr, shift_type || 'MORNING', overallAllowedToServe, finalScore, notes || '', now, now]
      );

      for (const det of processedDetails) {
        const detailId = `det-${crypto.randomBytes(6).toString('hex')}`;
        executeSql(
          `INSERT INTO assessment_details (id, assessment_id, checklist_item_id, material_id, department, color_result, smell_result, taste_result, quality_result, overall_result, allowed_to_serve, remark, photo_url, material_name_snapshot, material_code_snapshot)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [detailId, id, det.checklist_item_id, det.material_id, det.department, det.color_result, det.smell_result, det.taste_result, det.quality_result, det.overall_result, det.allowed_to_serve, det.remark, det.photo_url, det.material_name_snapshot, det.material_code_snapshot]
        );
      }

      const assessment = this.getById(id, user);
      NotificationModel.createForAssessment(assessment);
      AuditLogModel.log({
        user_id: user.id,
        restaurant_id: assessment.restaurant_id,
        action: 'CHECKLIST SUBMIT',
        entity_type: 'MATERIAL_ASSESSMENT',
        entity_id: assessment.id,
        new_values: {
          shift_date: assessment.shift_date,
          shift_type: assessment.shift_type,
          total_count: assessment.details.length,
          pass_count: assessment.details.filter(item => item.overall_result === 'PASS').length,
          fail_count: assessment.details.filter(item => item.overall_result === 'FAIL').length,
          score: assessment.score,
          status: assessment.status
        }
      });
      assessment.details.filter(item => item.overall_result === 'FAIL').forEach(item => {
        AuditLogModel.log({
          user_id: user.id,
          restaurant_id: assessment.restaurant_id,
          action: 'MATERIAL FAIL',
          entity_type: 'MATERIAL',
          entity_id: item.material_id,
          new_values: {
            assessment_id: assessment.id,
            material_code: item.material_code,
            material_name: item.material_name,
            department: item.department,
            result: item.overall_result,
            allowed_to_serve: item.allowed_to_serve,
            remark: item.remark
          }
        });
      });
      db.exec('COMMIT');
      return assessment;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}
