import { Api } from '../api.js';

export class ChecklistHistoryView {
  static async mount(container, { triggerSelector, restaurantOnly = false, getRestaurantId = () => '' }) {
    const trigger = container.querySelector(triggerSelector);
    if (!trigger) return;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'checklist-history-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'checklist-history-title');
    modal.innerHTML = `
      <div class="modal-card history-modal-card">
        <div class="modal-header">
          <h2 id="checklist-history-title">Lịch sử đánh giá</h2>
          <button class="history-modal-close" type="button" aria-label="Đóng">&times;</button>
        </div>
        <div class="history-filters">
          <label>Từ ngày<input class="form-input" id="history-from-date" type="date"></label>
          <label>Đến ngày<input class="form-input" id="history-to-date" type="date"></label>
          <label class="${restaurantOnly ? 'history-hidden' : ''}">Nhà hàng
            <select class="form-select" id="history-restaurant"><option value="">Tất cả nhà hàng</option></select>
          </label>
          <label>Ca làm việc
            <select class="form-select" id="history-shift">
              <option value="">Tất cả ca</option>
              <option value="MORNING">Ca sáng</option>
              <option value="MID_SHIFT">Ca giữa</option>
              <option value="EVENING">Ca tối</option>
            </select>
          </label>
          <label>Kết quả
            <select class="form-select" id="history-status">
              <option value="">Tất cả kết quả</option>
              <option value="SUBMITTED">Đã gửi</option>
              <option value="MATERIAL_FAIL">Có vật tư lỗi</option>
            </select>
          </label>
          <button class="btn btn-secondary" id="history-refresh" type="button">Lọc</button>
        </div>
        <div class="modal-body history-table-body">
          <div id="history-list-view" class="table-responsive">
            <table class="data-table history-assessment-table">
              <thead><tr><th>Ngày</th><th>Nhà hàng</th><th>Ca</th><th>Giờ gửi</th><th>Người đánh giá</th><th>Tổng vật tư</th><th>Đạt</th><th>Lỗi</th><th>Kết quả</th><th>Chi tiết</th></tr></thead>
              <tbody id="checklist-history-rows"><tr><td colspan="10" class="history-empty">Chọn bộ lọc để xem lịch sử.</td></tr></tbody>
            </table>
          </div>
          <section id="history-detail-view" class="history-detail-view" hidden aria-live="polite"></section>
        </div>
      </div>
    `;
    container.appendChild(modal);

    const close = () => modal.classList.remove('active');
    modal.querySelector('.history-modal-close').addEventListener('click', close);
    modal.addEventListener('click', event => {
      if (event.target === modal) close();
    });
    modal.querySelector('#history-refresh').addEventListener('click', () => this.load(modal, { restaurantOnly, getRestaurantId }));
    modal.querySelectorAll('.history-filters input, .history-filters select').forEach(input => {
      input.addEventListener('change', () => this.load(modal, { restaurantOnly, getRestaurantId }));
    });
    modal.querySelector('#checklist-history-rows').addEventListener('click', event => {
      const button = event.target.closest('.history-detail-trigger');
      if (button) this.showAssessmentDetail(modal, button.dataset.assessmentId);
    });
    modal.querySelector('#history-detail-view').addEventListener('click', event => {
      if (event.target.closest('.history-detail-back')) this.showList(modal);
    });

    trigger.addEventListener('click', async () => {
      modal.classList.add('active');
      this.showList(modal);
      if (!restaurantOnly && !modal.dataset.restaurantsLoaded) {
        try {
          const data = await Api.get('/api/restaurants');
          const select = modal.querySelector('#history-restaurant');
          select.innerHTML = '<option value="">Tất cả nhà hàng</option>' + (data.restaurants || []).map(restaurant =>
            `<option value="${this.escapeHtml(restaurant.id)}">${this.escapeHtml(restaurant.restaurant_code)} · ${this.escapeHtml(restaurant.restaurant_name)}</option>`
          ).join('');
          modal.dataset.restaurantsLoaded = 'true';
        } catch (error) {
          this.showError(modal, error.message);
          return;
        }
      }
      const assignedRestaurant = getRestaurantId();
      if (assignedRestaurant && modal.querySelector('#history-restaurant')) {
        modal.querySelector('#history-restaurant').value = assignedRestaurant;
      }
      await this.load(modal, { restaurantOnly, getRestaurantId });
    });
  }

  static async load(modal, { restaurantOnly, getRestaurantId }) {
    const rows = modal.querySelector('#checklist-history-rows');
    this.showList(modal);
    rows.innerHTML = '<tr><td colspan="10" class="history-empty">Đang tải lịch sử...</td></tr>';

    const params = new URLSearchParams({ limit: '1000' });
    const fromDate = modal.querySelector('#history-from-date').value;
    const toDate = modal.querySelector('#history-to-date').value;
    const restaurantId = restaurantOnly ? getRestaurantId() : modal.querySelector('#history-restaurant').value;
    const shiftType = modal.querySelector('#history-shift').value;
    if (fromDate) params.set('from_date', fromDate);
    if (toDate) params.set('to_date', toDate);
    if (restaurantId) params.set('restaurant_id', restaurantId);
    if (shiftType) params.set('shift_type', shiftType);

    try {
      const data = await Api.get(`/api/assessments?${params}`);
      const statusFilter = modal.querySelector('#history-status').value;
      const assessments = (data.assessments || []).filter(assessment => {
        if (statusFilter === 'MATERIAL_FAIL') return Number(assessment.fail_count) > 0;
        if (statusFilter === 'SUBMITTED') return assessment.status === 'SUBMITTED';
        return true;
      });
      if (!assessments.length) {
        rows.innerHTML = '<tr><td colspan="10" class="history-empty">Không có bài đánh giá phù hợp.</td></tr>';
        return;
      }

      rows.innerHTML = assessments.map(assessment => {
        const hasFail = Number(assessment.fail_count) > 0;
        const shiftLabel = {
          MORNING: 'Ca sáng',
          MID_SHIFT: 'Ca giữa',
          EVENING: 'Ca tối'
        }[assessment.shift_type] || assessment.shift_type;
        const submitted = assessment.submitted_at ? new Date(assessment.submitted_at).toLocaleTimeString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false
        }) : '--';
        const status = hasFail ? 'Có vật tư lỗi' : (assessment.status === 'SUBMITTED' ? 'Đã hoàn thành' : assessment.status);
        return `<tr>
          <td>${this.escapeHtml(assessment.shift_date)}</td>
          <td><strong>${this.escapeHtml(assessment.restaurant_code || '')}</strong><br>${this.escapeHtml(assessment.restaurant_name)}</td>
          <td>${this.escapeHtml(shiftLabel)}</td>
          <td>${this.escapeHtml(submitted)}</td>
          <td>${this.escapeHtml(assessment.inspector_name)}</td>
          <td>${this.escapeHtml(assessment.total_count)}</td>
          <td>${this.escapeHtml(assessment.pass_count)}</td>
          <td><strong class="${hasFail ? 'history-fail-count' : ''}">${this.escapeHtml(assessment.fail_count)}</strong></td>
          <td><span class="badge ${hasFail ? 'badge-overdue' : 'badge-completed'}">${this.escapeHtml(status)}</span></td>
          <td><button type="button" class="btn btn-secondary btn-sm history-detail-trigger" data-assessment-id="${this.escapeHtml(assessment.id)}">Xem chi tiết</button></td>
        </tr>`;
      }).join('');
    } catch (error) {
      this.showError(modal, error.message);
    }
  }

  static async showAssessmentDetail(modal, assessmentId) {
    const detailView = modal.querySelector('#history-detail-view');
    const listView = modal.querySelector('#history-list-view');
    listView.hidden = true;
    detailView.hidden = false;
    detailView.innerHTML = '<p class="history-empty">Đang tải chi tiết bài đánh giá...</p>';
    try {
      const { assessment } = await Api.get(`/api/assessments/${encodeURIComponent(assessmentId)}`);
      if (!assessment || !modal.isConnected) return;
      const details = assessment.details || [];
      const passed = details.filter(item => item.overall_result === 'PASS').length;
      const failed = details.filter(item => item.overall_result === 'FAIL').length;
      const criteria = [
        ['Màu sắc', 'color_result'], ['Mùi', 'smell_result'],
        ['Vị', 'taste_result'], ['Chất lượng', 'quality_result']
      ];
      const resultLabel = value => value === 'PASS' ? 'Đạt' : value === 'FAIL' ? 'Không đạt' : value === 'N/A' ? 'Không áp dụng' : 'Chưa có';
      const resultClass = value => value === 'PASS' ? 'state-completed' : value === 'FAIL' ? 'state-overdue' : 'state-pending';
      const assessmentTime = assessment.submitted_at || assessment.created_at;
      detailView.innerHTML = `
        <button type="button" class="btn btn-secondary history-detail-back">← Quay lại danh sách</button>
        <h3 class="history-detail-heading">${this.escapeHtml(assessment.restaurant_code || '')} · ${this.escapeHtml(assessment.restaurant_name || '')}</h3>
        <div class="ac-assessment-summary history-detail-summary">
          <div><span>Ngày / ca</span><strong>${this.escapeHtml(assessment.shift_date)} · ${this.escapeHtml({ MORNING: 'Ca sáng', MID_SHIFT: 'Ca giữa', EVENING: 'Ca tối' }[assessment.shift_type] || assessment.shift_type)}</strong></div>
          <div><span>Người đánh giá</span><strong>${this.escapeHtml(assessment.inspector_name)}</strong></div>
          <div><span>Thời gian gửi</span><strong>${this.escapeHtml(assessmentTime ? new Date(assessmentTime).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '--')}</strong></div>
          <div><span>Điểm tổng</span><strong>${this.escapeHtml(assessment.score)}%</strong></div>
          <div><span>Kết quả vật tư</span><strong>${passed} đạt · ${failed} lỗi / ${details.length} vật tư</strong></div>
          <div><span>Quyết định phục vụ</span><strong class="${assessment.overall_allowed_to_serve === 'YES' ? 'state-completed' : 'state-overdue'}">${assessment.overall_allowed_to_serve === 'YES' ? 'Được phục vụ' : 'Không được phục vụ'}</strong></div>
        </div>
        ${assessment.notes ? `<p class="ac-assessment-notes"><strong>Ghi chú bài đánh giá:</strong> ${this.escapeHtml(assessment.notes)}</p>` : ''}
        <h3>Kết quả chi tiết từng vật tư</h3>
        <div class="table-responsive"><table class="data-table ac-assessment-detail-table history-detail-table">
          <thead><tr><th>Vật tư / yêu cầu</th><th>Bộ phận</th><th>Tiêu chí</th><th>Kết quả</th><th>Được phục vụ</th><th>Ghi chú</th></tr></thead>
          <tbody>${details.map(item => `<tr class="${item.overall_result === 'FAIL' ? 'assessment-failed-row' : ''}">
            <td><strong>${this.escapeHtml(item.material_name)}</strong><small>${this.escapeHtml(item.material_code || '')}</small>${item.requirement_text ? `<p>${this.escapeHtml(item.requirement_text)}</p>` : ''}${item.target_temp !== null && item.target_temp !== undefined ? `<small>Nhiệt độ mục tiêu: ${this.escapeHtml(item.target_temp)}°</small>` : ''}</td>
            <td>${this.escapeHtml(item.department)}</td>
            <td><div class="ac-criteria-list">${criteria.map(([label, key]) => `<span class="ac-criterion ${resultClass(item[key])}"><b>${label}</b>${resultLabel(item[key])}</span>`).join('')}</div></td>
            <td><span class="ac-status-badge ${resultClass(item.overall_result)}">${resultLabel(item.overall_result)}</span></td>
            <td>${item.allowed_to_serve === 'YES' ? 'Có' : 'Không'}</td>
            <td>${this.escapeHtml(item.remark || '—')}</td>
          </tr>`).join('') || '<tr><td colspan="6" class="history-empty">Không có dữ liệu chi tiết.</td></tr>'}</tbody>
        </table></div>`;
    } catch (error) {
      detailView.innerHTML = `<p class="history-empty history-error">Không thể tải chi tiết bài đánh giá: ${this.escapeHtml(error.message)}</p><button type="button" class="btn btn-secondary history-detail-back">Quay lại danh sách</button>`;
    }
  }

  static showList(modal) {
    modal.querySelector('#history-list-view').hidden = false;
    modal.querySelector('#history-detail-view').hidden = true;
  }

  static showError(modal, message) {
    modal.querySelector('#checklist-history-rows').innerHTML =
      `<tr><td colspan="10" class="history-empty history-error">${this.escapeHtml(message)}</td></tr>`;
  }

  static escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character]);
  }
}
