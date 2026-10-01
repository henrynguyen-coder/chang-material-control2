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
          <h2 id="checklist-history-title">Checklist History</h2>
          <button class="history-modal-close" type="button" aria-label="Đóng">&times;</button>
        </div>
        <div class="history-filters">
          <label>From<input class="form-input" id="history-from-date" type="date"></label>
          <label>To<input class="form-input" id="history-to-date" type="date"></label>
          <label class="${restaurantOnly ? 'history-hidden' : ''}">Restaurant
            <select class="form-select" id="history-restaurant"><option value="">Tất cả nhà hàng</option></select>
          </label>
          <label>Shift
            <select class="form-select" id="history-shift">
              <option value="">Tất cả ca</option>
              <option value="MORNING">Ca sáng</option>
              <option value="MID_SHIFT">Ca giữa</option>
              <option value="EVENING">Ca tối</option>
            </select>
          </label>
          <label>Status
            <select class="form-select" id="history-status">
              <option value="">Tất cả trạng thái</option>
              <option value="SUBMITTED">SUBMITTED</option>
              <option value="MATERIAL_FAIL">Material Fail</option>
            </select>
          </label>
          <button class="btn btn-secondary" id="history-refresh" type="button">Lọc</button>
        </div>
        <div class="modal-body history-table-body">
          <div class="table-responsive">
            <table class="data-table">
              <thead><tr><th>Date</th><th>Restaurant</th><th>Shift</th><th>Submitted Time</th><th>Checked By</th><th>Total</th><th>Pass</th><th>Fail</th><th>Status</th></tr></thead>
              <tbody id="checklist-history-rows"><tr><td colspan="9" class="history-empty">Chọn bộ lọc để xem lịch sử.</td></tr></tbody>
            </table>
          </div>
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
    modal.querySelectorAll('input, select').forEach(input => {
      input.addEventListener('change', () => this.load(modal, { restaurantOnly, getRestaurantId }));
    });
    trigger.addEventListener('click', async () => {
      modal.classList.add('active');
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
      if (assignedRestaurant) modal.querySelector('#history-restaurant').value = assignedRestaurant;
      await this.load(modal, { restaurantOnly, getRestaurantId });
    });
  }

  static async load(modal, { restaurantOnly, getRestaurantId }) {
    const rows = modal.querySelector('#checklist-history-rows');
    rows.innerHTML = '<tr><td colspan="9" class="history-empty">Đang tải lịch sử...</td></tr>';

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
        if (statusFilter === 'MATERIAL_FAIL') return assessment.fail_count > 0;
        if (statusFilter === 'SUBMITTED') return assessment.status === 'SUBMITTED';
        return true;
      });
      if (!assessments.length) {
        rows.innerHTML = '<tr><td colspan="9" class="history-empty">Không có checklist phù hợp.</td></tr>';
        return;
      }

      rows.innerHTML = assessments.map(assessment => {
        const hasFail = assessment.fail_count > 0;
        const shiftLabel = {
          MORNING: 'Ca sáng',
          MID_SHIFT: 'Ca giữa',
          EVENING: 'Ca tối'
        }[assessment.shift_type] || assessment.shift_type;
        const submitted = assessment.submitted_at ? new Date(assessment.submitted_at).toLocaleTimeString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }) : '--';
        const status = hasFail ? 'SUBMITTED · MATERIAL FAIL' : assessment.status;
        return `<tr>
          <td>${this.escapeHtml(assessment.shift_date)}</td>
          <td>${this.escapeHtml(assessment.restaurant_name)}</td>
          <td>${this.escapeHtml(shiftLabel)}</td>
          <td>${this.escapeHtml(submitted)}</td>
          <td>${this.escapeHtml(assessment.inspector_name)}</td>
          <td>${this.escapeHtml(assessment.total_count)}</td>
          <td>${this.escapeHtml(assessment.pass_count)}</td>
          <td>${this.escapeHtml(assessment.fail_count)}</td>
          <td><span class="badge ${hasFail ? 'badge-overdue' : 'badge-completed'}">${this.escapeHtml(status)}</span></td>
        </tr>`;
      }).join('');
    } catch (error) {
      this.showError(modal, error.message);
    }
  }

  static showError(modal, message) {
    modal.querySelector('#checklist-history-rows').innerHTML =
      `<tr><td colspan="9" class="history-empty history-error">${this.escapeHtml(message)}</td></tr>`;
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