import { AssessmentModel } from '../models/AssessmentModel.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';

export class AssessmentController {
  static getAll(req, urlParams, res) {
    const user = requireAuth(req, res);
    if (!user) return;

    const restaurant_id = urlParams.get('restaurant_id') || null;
    const shift_type = urlParams.get('shift_type') || null;
    const shift_date = urlParams.get('shift_date') || null;
    const from_date = urlParams.get('from_date') || null;
    const to_date = urlParams.get('to_date') || null;

    try {
      const assessments = AssessmentModel.getAll({
        user,
        restaurant_id,
        shift_type,
        shift_date,
        from_date,
        to_date,
        limit: urlParams.get('limit')
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ assessments }));
    } catch (err) {
      res.writeHead(err.statusCode || 400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  }

  static getMaterialIssues(req, urlParams, res) {
    const user = requireAuth(req, res);
    if (!user) return;

    try {
      const issues = AssessmentModel.getMaterialIssues({
        user,
        restaurant_id: urlParams.get('restaurant_id') || null,
        shift_type: urlParams.get('shift_type') || null,
        shift_date: urlParams.get('shift_date') || null,
        from_date: urlParams.get('from_date') || null,
        to_date: urlParams.get('to_date') || null,
        assessment_id: urlParams.get('assessment_id') || null
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ issues }));
    } catch (err) {
      res.writeHead(err.statusCode || 400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  }

  static getById(req, id, res) {
    const user = requireAuth(req, res);
    if (!user) return;

    try {
      const assessment = AssessmentModel.getById(id, user);
      if (!assessment) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Không tìm thấy phiếu kiểm tra' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ assessment }));
    } catch (err) {
      res.writeHead(err.statusCode || 400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  }

  static create(req, body, res) {
    const user = requireAuth(req, res);
    if (!user || !requireRole('RESTAURANT')(user, res)) return;

    try {
      const assessment = AssessmentModel.create({ user, ...body });

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        message: 'Gửi phiếu kiểm tra đầu ca thành công',
        assessment
      }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  }
}
