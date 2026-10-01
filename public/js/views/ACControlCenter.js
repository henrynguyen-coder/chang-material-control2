import { Api } from '../api.js';
import { ChecklistHistoryView } from './ChecklistHistoryView.js';

export class ACControlCenter {
  static timeZone = 'Asia/Ho_Chi_Minh';
  static loadVersion = 0;
  static container = null;
  static state = null;
  static notifications = [];
  static notificationTimer = null;
  static viewVersion = 0;

  static async render(container) {
    this.dispose();
    const viewVersion = this.viewVersion;
    this.container = container;
    container.innerHTML = `
      <section class="ac-control-center">
        <header class="welcome-card ac-control-header">
          <div class="ac-control-copy">
            <div class="app-subtitle">AC / L&amp;D CONTROL CENTER</div>
            <h1 class="greeting-name">TODAY'S CONTROL CENTER</h1>
            <div class="current-date">Theo dõi tình trạng kiểm tra nguyên vật liệu theo nhà hàng và ca</div>
          </div>
          <div class="ac-control-actions">
            <button class="btn btn-secondary ac-history-button" id="open-ac-history" type="button">Checklist History</button>
            <button class="ac-notification-button" id="open-notifications" type="button" aria-label="Mở Notification Center">
              <span aria-hidden="true">🔔</span> Notifications
              <span class="ac-notification-count" id="notification-count" hidden>0</span>
            </button>
          </div>
        </header>

        <section class="ac-filters" aria-label="Bộ lọc giám sát">
          <label class="ac-filter-field">Date
            <input class="form-input" id="filter-date" type="date" value="${this.getLocalDate()}">
          </label>
          <label class="ac-filter-field">Restaurant
            <select class="form-select" id="filter-restaurant"><option value="">Tất cả nhà hàng</option></select>
          </label>
          <label class="ac-filter-field">Shift
            <select class="form-select" id="filter-shift">
              <option value="">Tất cả ca</option>
              <option value="MORNING">MORNING</option>
              <option value="EVENING">EVENING</option>
            </select>
          </label>
          <label class="ac-filter-field">Status
            <select class="form-select" id="filter-status">
              <option value="">Tất cả trạng thái</option>
              <option value="OVERDUE">Overdue</option>
              <option value="MATERIAL_FAIL">Material Fail</option>
              <option value="PENDING">Pending</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </label>
          <label class="ac-filter-field">Department
            <select class="form-select" id="filter-department">
              <option value="">Tất cả bộ phận</option>
              <option value="FOH">FOH</option>
              <option value="BOH">BOH</option>
            </select>
          </label>
          <label class="ac-filter-field">Material
            <select class="form-select" id="filter-material"><option value="">Tất cả vật tư</option></select>
          </label>
          <button class="btn btn-secondary ac-refresh-btn" id="refresh-ac-btn" type="button" aria-label="Làm mới dữ liệu">↻ Làm mới</button>
        </div>

        <section class="ac-kpis" aria-label="Control center KPIs">
          <article class="ac-kpi ac-kpi-total"><span>TOTAL RESTAURANTS</span><strong id="stat-total-restaurants">--</strong></article>
          <article class="ac-kpi"><span>MORNING COMPLETED</span><strong id="stat-morning-completed">--</strong></article>
          <article class="ac-kpi"><span>EVENING COMPLETED</span><strong id="stat-evening-completed">--</strong></article>
          <article class="ac-kpi ac-kpi-overdue"><span>OVERDUE</span><strong id="stat-overdue">--</strong></article>
          <article class="ac-kpi ac-kpi-fail"><span>MATERIAL FAIL</span><strong id="stat-material-fail">--</strong></article>
        </section>

        <section class="ac-monitoring-section" aria-labelledby="monitoring-title">
          <div class="section-title">
            <h2 id="monitoring-title">RESTAURANT MONITORING</h2>
            <span id="monitoring-count" class="ac-result-count"></span>
          </div>
          <div class="ac-monitoring-grid" id="monitoring-grid" aria-live="polite">
            <p class="ac-empty-state">Đang tải dữ liệu giám sát...</p>
          </div>
        </section>
      </section>

      <div class="modal-overlay" id="restaurant-detail-modal" role="dialog" aria-modal="true" aria-labelledby="restaurant-detail-title">
        <div class="modal-card ac-detail-modal">
          <div class="modal-header">
            <h2 id="restaurant-detail-title">Restaurant Detail</h2>
            <button class="ac-modal-close" type="button" aria-label="Đóng">&times;</button>
          </div>
          <div class="modal-body" id="restaurant-detail-body"></div>
        </div>
      </div>

      <div class="modal-overlay" id="material-issue-modal" role="dialog" aria-modal="true" aria-labelledby="material-issue-title">
        <div class="modal-card ac-detail-modal">
          <div class="modal-header">
            <h2 id="material-issue-title">Material Issue Detail</h2>
            <button class="ac-modal-close" type="button" aria-label="Đóng">&times;</button>
          </div>
          <div class="modal-body" id="material-issue-body"></div>
        </div>
      </div>

      <div class="modal-overlay" id="notification-center-modal" role="dialog" aria-modal="true" aria-labelledby="notification-center-title">
        <div class="modal-card ac-notification-modal">
          <div class="modal-header">
            <h2 id="notification-center-title">Notification Center</h2>
            <button class="ac-modal-close" type="button" aria-label="Đóng">&times;</button>
          </div>
          <div class="ac-notification-toolbar">
            <span id="notification-unread-summary">0 UNREAD</span>
            <button class="btn btn-secondary btn-sm" id="mark-all-notifications-read" type="button">Mark all as read</button>
          </div>
          <div class="modal-body ac-notification-list" id="notification-list" aria-live="polite">
            <p class="ac-empty-state">Đang tải notifications...</p>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
    ChecklistHistoryView.mount(container, {
      triggerSelector: '#open-ac-history',
      getRestaurantId: () => container.querySelector('#filter-restaurant').value
    });
    const [, , settingsData] = await Promise.all([
      this.loadData(this.getLocalDate()),
      this.refreshNotificationCount(),
      Api.get('/api/settings').catch(() => ({ settings: [] }))
    ]);
    if (viewVersion !== this.viewVersion || !container.querySelector('#notification-count')) return;
    const settings = Object.fromEntries((settingsData.settings || []).map(setting => [setting.key, setting.value]));
    const refreshSeconds = Math.max(10, Math.min(Number(settings.NOTIFICATION_REFRESH_SECONDS) || 30, 300));
    this.notificationTimer = setInterval(() => {
      if (document.visibilityState === 'visible') this.refreshNotificationCount();
    }, refreshSeconds * 1000);
  }

  static bindEvents() {
    const container = this.container;
    container.querySelector('#filter-date').addEventListener('change', event => this.loadData(event.target.value));
    container.querySelector('#filter-restaurant').addEventListener('change', () => this.renderDashboard());
    container.querySelector('#filter-shift').addEventListener('change', () => this.renderDashboard());
    container.querySelector('#filter-status').addEventListener('change', () => this.renderDashboard());
    container.querySelector('#filter-material').addEventListener('change', () => this.renderDashboard());
    container.querySelector('#filter-department').addEventListener('change', () => {
      this.updateMaterialOptions();
      this.renderDashboard();
    });
    container.querySelector('#refresh-ac-btn').addEventListener('click', () => {
      this.loadData(container.querySelector('#filter-date').value);
    });
    container.querySelector('#open-notifications').addEventListener('click', () => this.showNotificationCenter());
    container.querySelector('#mark-all-notifications-read').addEventListener('click', async () => {
      try {
        await Api.patch('/api/notifications/read-all', {});
        await this.loadNotifications();
      } catch (error) {
        console.error('Error marking notifications as read', error);
      }
    });

    container.querySelector('#monitoring-grid').addEventListener('click', event => {
      const issueButton = event.target.closest('.material-issue-trigger');
      if (issueButton) {
        this.showMaterialIssueDetail(issueButton.dataset.restaurantId);
        return;
      }

      const restaurantButton = event.target.closest('.restaurant-detail-trigger');
      if (restaurantButton) this.showRestaurantDetail(restaurantButton.dataset.restaurantId);
    });
    container.querySelector('#notification-list').addEventListener('click', event => {
      const notification = event.target.closest('.ac-notification-item');
      if (notification) this.openNotification(notification.dataset.notificationId);
    });

    container.querySelectorAll('.ac-modal-close').forEach(button => {
      button.addEventListener('click', () => button.closest('.modal-overlay').classList.remove('active'));
    });
    container.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.addEventListener('click', event => {
        if (event.target === modal) modal.classList.remove('active');
      });
    });
  }

  static dispose() {
    this.loadVersion++;
    this.viewVersion++;
    if (this.notificationTimer) clearInterval(this.notificationTimer);
    this.notificationTimer = null;
  }

  static async loadData(date) {
    const requestVersion = ++this.loadVersion;
    const grid = this.container.querySelector('#monitoring-grid');
    grid.innerHTML = '<p class="ac-empty-state">Đang tải dữ liệu giám sát...</p>';

    try {
      const dateQuery = encodeURIComponent(date);
      const [assessmentData, restaurantData, issueData, shiftData, materialData] = await Promise.all([
        Api.get(`/api/assessments?shift_date=${dateQuery}`),
        Api.get('/api/restaurants?status=ACTIVE'),
        Api.get(`/api/material-issues?shift_date=${dateQuery}`),
        Api.get('/api/shifts'),
        Api.get('/api/materials')
      ]);
      if (requestVersion !== this.loadVersion || !this.container.isConnected) return;

      this.state = {
        date,
        assessments: assessmentData.assessments || [],
        restaurants: restaurantData.restaurants || [],
        issues: issueData.issues || [],
        shifts: shiftData.shifts || [],
        materials: materialData.materials || []
      };
      this.updateRestaurantOptions();
      this.updateMaterialOptions();
      this.renderDashboard();
    } catch (error) {
      if (requestVersion !== this.loadVersion) return;
      grid.innerHTML = `<p class="ac-empty-state ac-load-error">Không thể tải dashboard: ${this.escapeHtml(error.message)}</p>`;
      console.error('Error loading AC control center', error);
    }
  }

  static async refreshNotificationCount() {
    try {
      const data = await Api.get('/api/notifications?limit=1');
      if (!this.container?.querySelector('#notification-count')) return;
      this.updateNotificationBadge(data.unread_count || 0);
    } catch (error) {
      console.error('Error loading notification count', error);
    }
  }

  static updateNotificationBadge(count) {
    const badge = this.container.querySelector('#notification-count');
    if (!badge) return;
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.hidden = count === 0;
    this.container.querySelector('#open-notifications').setAttribute(
      'aria-label',
      count ? `Mở Notification Center, ${count} unread` : 'Mở Notification Center'
    );
    this.container.querySelector('#notification-unread-summary').textContent = `${count} UNREAD`;
  }

  static async showNotificationCenter() {
    this.container.querySelector('#notification-center-modal').classList.add('active');
    await this.loadNotifications();
  }

  static async loadNotifications() {
    const requestVersion = this.loadVersion;
    const list = this.container.querySelector('#notification-list');
    list.innerHTML = '<p class="ac-empty-state">Đang tải notifications...</p>';
    try {
      const data = await Api.get('/api/notifications?limit=50');
      if (requestVersion !== this.loadVersion || !this.container.querySelector('#notification-list')) return;
      this.notifications = data.notifications || [];
      this.updateNotificationBadge(data.unread_count || 0);
      this.renderNotifications();
    } catch (error) {
      if (requestVersion !== this.loadVersion) return;
      list.innerHTML = `<p class="ac-empty-state ac-load-error">Không thể tải notifications: ${this.escapeHtml(error.message)}</p>`;
    }
  }

  static renderNotifications() {
    const list = this.container.querySelector('#notification-list');
    if (!list) return;
    if (!this.notifications.length) {
      list.innerHTML = '<p class="ac-empty-state">Chưa có notification nào.</p>';
      return;
    }

    list.innerHTML = this.notifications.map(notification => `
      <button class="ac-notification-item ${notification.status.toLowerCase()}" type="button" data-notification-id="${this.escapeHtml(notification.id)}">
        <span class="ac-notification-icon" aria-hidden="true">${notification.type === 'MATERIAL_ISSUE' ? '🔴' : '🔔'}</span>
        <span class="ac-notification-content">
          <span class="ac-notification-title">${this.escapeHtml(notification.title)}</span>
          <span class="ac-notification-message">${this.escapeHtml(notification.message)}</span>
          <time>${this.escapeHtml(new Date(notification.created_at).toLocaleString('vi-VN', { timeZone: this.timeZone }))}</time>
        </span>
        <span class="ac-notification-status">${notification.status}</span>
      </button>
    `).join('');
  }

  static async openNotification(notificationId) {
    const notification = this.notifications.find(item => item.id === notificationId);
    if (!notification) return;
    const requestVersion = this.loadVersion;

    try {
      await Api.patch(`/api/notifications/${encodeURIComponent(notificationId)}/read`, {});
      if (requestVersion !== this.loadVersion || !this.container.querySelector('#notification-center-modal')) return;
      notification.is_read = 1;
      notification.status = 'READ';
      this.renderNotifications();
      await this.refreshNotificationCount();
    } catch (error) {
      console.error('Error marking notification as read', error);
      return;
    }

    this.container.querySelector('#notification-center-modal').classList.remove('active');
    const data = notification.data || {};
    if (data.shift_date && data.shift_date !== this.state?.date) {
      this.container.querySelector('#filter-date').value = data.shift_date;
      await this.loadData(data.shift_date);
    }
    if (!data.restaurant_id) return;

    this.container.querySelector('#filter-restaurant').value = data.restaurant_id;
    this.container.querySelector('#filter-status').value = '';
    if (notification.type === 'MATERIAL_ISSUE') {
      this.container.querySelector('#filter-shift').value = data.shift_type || '';
      this.container.querySelector('#filter-department').value = data.department || '';
      this.updateMaterialOptions();
      this.container.querySelector('#filter-material').value = data.material_id || '';
      this.renderDashboard();
      this.showMaterialIssueDetail(data.restaurant_id);
    } else {
      this.renderDashboard();
      this.showRestaurantDetail(data.restaurant_id);
    }
  }

  static updateRestaurantOptions() {
    const select = this.container.querySelector('#filter-restaurant');
    const selected = select.value;
    select.innerHTML = '<option value="">Tất cả nhà hàng</option>' + this.state.restaurants.map(restaurant =>
      `<option value="${this.escapeHtml(restaurant.id)}">${this.escapeHtml(restaurant.restaurant_code)} · ${this.escapeHtml(restaurant.restaurant_name)}</option>`
    ).join('');
    if (this.state.restaurants.some(restaurant => restaurant.id === selected)) select.value = selected;
  }

  static updateMaterialOptions() {
    const select = this.container.querySelector('#filter-material');
    const department = this.container.querySelector('#filter-department').value;
    const selected = select.value;
    const materials = this.state.materials.filter(material => !department || material.department === department);
    select.innerHTML = '<option value="">Tất cả vật tư</option>' + materials.map(material =>
      `<option value="${this.escapeHtml(material.id)}">${this.escapeHtml(material.material_name)}</option>`
    ).join('');
    if (materials.some(material => material.id === selected)) select.value = selected;
  }

  static renderDashboard() {
    if (!this.state || !this.container.isConnected) return;

    const restaurantFilter = this.container.querySelector('#filter-restaurant').value;
    const shiftFilter = this.container.querySelector('#filter-shift').value;
    const statusFilter = this.container.querySelector('#filter-status').value;
    const restaurants = this.state.restaurants.filter(restaurant => !restaurantFilter || restaurant.id === restaurantFilter);
    const shifts = shiftFilter ? [shiftFilter] : ['MORNING', 'EVENING'];

    this.renderKpis(restaurants);

    const cards = restaurants.map(restaurant => {
      const issues = this.getFilteredIssues(restaurant.id, shiftFilter);
      const shiftStates = shifts.map(code => ({ code, ...this.getShiftState(restaurant.id, code) }));
      const status = this.getPriorityStatus(shiftStates, issues.length);
      return { restaurant, issues, shiftStates, status };
    }).filter(card => !statusFilter || card.status === statusFilter)
      .sort((left, right) => this.statusRank(left.status) - this.statusRank(right.status)
        || left.restaurant.restaurant_code.localeCompare(right.restaurant.restaurant_code));

    this.container.querySelector('#monitoring-count').textContent = `${cards.length} / ${restaurants.length} nhà hàng`;
    const grid = this.container.querySelector('#monitoring-grid');
    if (!cards.length) {
      grid.innerHTML = '<p class="ac-empty-state">Không có nhà hàng phù hợp với bộ lọc.</p>';
      return;
    }

    grid.innerHTML = cards.map(({ restaurant, issues, shiftStates, status }) => {
      const latest = this.getLatestAssessment(restaurant.id);
      return `
        <article class="ac-monitor-card priority-${status.toLowerCase().replace('_', '-')}">
          <div class="ac-monitor-card-header">
            <div>
              <span class="ac-restaurant-code">${this.escapeHtml(restaurant.restaurant_code)}</span>
              <button class="ac-restaurant-name restaurant-detail-trigger" type="button" data-restaurant-id="${this.escapeHtml(restaurant.id)}">
                ${this.escapeHtml(restaurant.restaurant_name)}
              </button>
            </div>
            <span class="ac-priority-label priority-label-${status.toLowerCase().replace('_', '-')}">${this.statusLabel(status)}</span>
          </div>
          <div class="ac-shift-status-list">
            ${shiftStates.map(shift => `
              <div class="ac-shift-status">
                <span>${shift.code}</span>
                <strong class="shift-state state-${shift.status.toLowerCase()}">${this.statusLabel(shift.status)}</strong>
              </div>
            `).join('')}
          </div>
          <div class="ac-monitor-card-footer">
            <button class="ac-material-issue-trigger material-issue-trigger" type="button" data-restaurant-id="${this.escapeHtml(restaurant.id)}">
              <span>MATERIAL ISSUE</span><strong>${issues.length}</strong>
            </button>
            <div class="ac-last-update"><span>LAST UPDATE</span><strong>${latest ? this.formatTime(latest.submitted_at || latest.created_at) : '--'}</strong></div>
          </div>
        </article>
      `;
    }).join('');
  }

  static renderKpis(restaurants) {
    const morningCompleted = restaurants.filter(restaurant => this.getShiftState(restaurant.id, 'MORNING').status === 'COMPLETED').length;
    const eveningCompleted = restaurants.filter(restaurant => this.getShiftState(restaurant.id, 'EVENING').status === 'COMPLETED').length;
    const overdue = restaurants.reduce((total, restaurant) => total + ['MORNING', 'EVENING'].filter(code =>
      this.getShiftState(restaurant.id, code).status === 'OVERDUE'
    ).length, 0);
    const materialFails = restaurants.reduce((total, restaurant) => total + this.getFilteredIssues(restaurant.id).length, 0);
    const denominator = restaurants.length;

    this.container.querySelector('#stat-total-restaurants').textContent = denominator;
    this.container.querySelector('#stat-morning-completed').textContent = `${morningCompleted} / ${denominator}`;
    this.container.querySelector('#stat-evening-completed').textContent = `${eveningCompleted} / ${denominator}`;
    this.container.querySelector('#stat-overdue').textContent = overdue;
    this.container.querySelector('#stat-material-fail').textContent = materialFails;
  }

  static getShiftState(restaurantId, shiftCode) {
    const assessment = this.state.assessments.find(item => item.restaurant_id === restaurantId && item.shift_type === shiftCode);
    if (assessment) return { status: 'COMPLETED', assessment };

    const today = this.getLocalDate();
    if (this.state.date < today) return { status: 'OVERDUE', assessment: null };
    if (this.state.date > today) return { status: 'PENDING', assessment: null };

    const config = this.state.shifts.find(shift => shift.shift_code === shiftCode);
    if (!config?.deadline_time) return { status: 'PENDING', assessment: null };
    const deadline = Date.parse(`${this.state.date}T${config.deadline_time}:00+07:00`);
    return { status: Date.now() > deadline ? 'OVERDUE' : 'PENDING', assessment: null };
  }

  static getFilteredIssues(restaurantId, shiftCode = null) {
    const department = this.container.querySelector('#filter-department').value;
    const materialId = this.container.querySelector('#filter-material').value;
    return this.state.issues.filter(issue => issue.restaurant_id === restaurantId
      && (!shiftCode || issue.shift_type === shiftCode)
      && (!department || issue.department === department)
      && (!materialId || issue.material_id === materialId));
  }

  static getPriorityStatus(shiftStates, issueCount) {
    if (shiftStates.some(shift => shift.status === 'OVERDUE')) return 'OVERDUE';
    if (issueCount > 0) return 'MATERIAL_FAIL';
    if (shiftStates.some(shift => shift.status === 'PENDING')) return 'PENDING';
    return 'COMPLETED';
  }

  static statusRank(status) {
    return { OVERDUE: 0, MATERIAL_FAIL: 1, PENDING: 2, COMPLETED: 3 }[status] ?? 4;
  }

  static statusLabel(status) {
    return {
      OVERDUE: 'Overdue',
      MATERIAL_FAIL: 'Material Fail',
      PENDING: 'Pending',
      COMPLETED: '✓ Completed'
    }[status] || status;
  }

  static getLatestAssessment(restaurantId) {
    return this.state.assessments
      .filter(item => item.restaurant_id === restaurantId)
      .sort((left, right) => new Date(right.submitted_at || right.created_at) - new Date(left.submitted_at || left.created_at))[0];
  }

  static showRestaurantDetail(restaurantId) {
    const restaurant = this.state.restaurants.find(item => item.id === restaurantId);
    if (!restaurant) return;
    const body = this.container.querySelector('#restaurant-detail-body');
    const assessments = this.state.assessments.filter(item => item.restaurant_id === restaurantId);
    const issues = this.state.issues.filter(issue => issue.restaurant_id === restaurantId);
    this.container.querySelector('#restaurant-detail-title').textContent = restaurant.restaurant_name;

    body.innerHTML = `
      <div class="ac-detail-summary"><span>${this.escapeHtml(restaurant.restaurant_code)}</span><span>${this.escapeHtml(this.state.date)}</span></div>
      <h3>Shift status</h3>
      <div class="ac-detail-shifts">
        ${['MORNING', 'EVENING'].map(code => {
          const shift = this.getShiftState(restaurantId, code);
          return `<div class="ac-detail-shift"><strong>${code}</strong><span class="shift-state state-${shift.status.toLowerCase()}">${this.statusLabel(shift.status)}</span>${shift.assessment ? `<span>${this.formatTime(shift.assessment.submitted_at || shift.assessment.created_at)}</span>` : ''}</div>`;
        }).join('')}
      </div>
      <h3>Assessment history</h3>
      ${assessments.length ? `<div class="table-responsive"><table class="data-table"><thead><tr><th>Ca</th><th>Người kiểm tra</th><th>Điểm</th><th>Allowed to serve</th><th>Last update</th></tr></thead><tbody>${assessments.map(item => `<tr><td>${this.escapeHtml(item.shift_type)}</td><td>${this.escapeHtml(item.inspector_name)}</td><td>${this.escapeHtml(item.score)}%</td><td>${this.escapeHtml(item.overall_allowed_to_serve)}</td><td>${this.formatTime(item.submitted_at || item.created_at)}</td></tr>`).join('')}</tbody></table></div>` : '<p>Chưa có phiếu kiểm tra trong ngày này.</p>'}
      <h3>Material issues (${issues.length})</h3>
      ${this.renderIssueList(issues)}
    `;
    this.container.querySelector('#restaurant-detail-modal').classList.add('active');
  }

  static showMaterialIssueDetail(restaurantId) {
    const restaurant = this.state.restaurants.find(item => item.id === restaurantId);
    if (!restaurant) return;
    const shiftFilter = this.container.querySelector('#filter-shift').value;
    const issues = this.getFilteredIssues(restaurantId, shiftFilter);
    this.container.querySelector('#material-issue-title').textContent = `Material Issue · ${restaurant.restaurant_name}`;
    this.container.querySelector('#material-issue-body').innerHTML = `
      <div class="ac-detail-summary"><span>${this.escapeHtml(restaurant.restaurant_code)}</span><span>${this.escapeHtml(this.state.date)}</span><span>${issues.length} issue${issues.length === 1 ? '' : 's'}</span></div>
      ${this.renderIssueList(issues)}
    `;
    this.container.querySelector('#material-issue-modal').classList.add('active');
  }

  static renderIssueList(issues) {
    if (!issues.length) return '<p class="ac-empty-state">Không có vật tư FAIL theo bộ lọc hiện tại.</p>';
    return `<div class="ac-issue-list">${issues.map(issue => `
      <article class="ac-issue-row">
        <div class="ac-issue-heading"><strong>${this.escapeHtml(issue.material_name)}</strong><span class="badge badge-overdue">${this.escapeHtml(issue.department)}</span></div>
        <div class="ac-issue-meta"><span>${this.escapeHtml(issue.shift_type)}</span><span>${this.escapeHtml(issue.material_code)}</span><span>${this.escapeHtml(issue.inspector_name)}</span></div>
        <p>${this.escapeHtml(issue.remark || 'Không có ghi chú')}</p>
        ${issue.photo_url ? '<span class="ac-photo-available">Có ảnh đính kèm</span>' : ''}
      </article>
    `).join('')}</div>`;
  }

  static getLocalDate(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  static formatTime(value) {
    if (!value) return '--';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '--';
    return date.toLocaleTimeString('vi-VN', {
      timeZone: this.timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
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
