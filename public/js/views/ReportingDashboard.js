import { Api } from '../api.js';

export class ReportingDashboard {
  static timeZone = 'Asia/Ho_Chi_Minh';
  static container = null;
  static state = null;
  static requestVersion = 0;

  static async render(container) {
    this.dispose();
    this.container = container;
    container.innerHTML = `
      <main class="report-dashboard" id="report-dashboard">
        <header class="welcome-card report-header">
          <div class="report-heading-copy">
            <div class="app-subtitle">AC / L&amp;D REPORTING</div>
            <h1 class="greeting-name">REPORTING DASHBOARD</h1>
            <div class="current-date" id="report-period-label"></div>
          </div>
          <div class="report-export-actions" aria-label="Export báo cáo">
            <button class="btn btn-secondary report-export-btn" id="export-excel" type="button">Excel</button>
            <button class="btn btn-secondary report-export-btn" id="export-csv" type="button">CSV</button>
            <button class="btn btn-secondary report-export-btn" id="export-pdf" type="button">PDF</button>
          </div>
        </header>

        <div class="report-period-control" role="group" aria-label="Kỳ báo cáo">
          <button class="report-period-btn active" data-period="DAILY" type="button" aria-pressed="true">Daily</button>
          <button class="report-period-btn" data-period="WEEKLY" type="button" aria-pressed="false">Weekly</button>
          <button class="report-period-btn" data-period="MONTHLY" type="button" aria-pressed="false">Monthly</button>
        </div>

        <section class="report-filters" aria-label="Report filters">
          <label>Date<input class="form-input" id="report-date" type="date" value="${this.getLocalDate()}"></label>
          <label>Restaurant<select class="form-select" id="report-restaurant"><option value="">Tất cả nhà hàng</option></select></label>
          <label>Shift<select class="form-select" id="report-shift"><option value="">Tất cả ca bắt buộc</option></select></label>
          <label>Department<select class="form-select" id="report-department"><option value="">FOH + BOH</option><option value="FOH">FOH</option><option value="BOH">BOH</option></select></label>
          <label>Status<select class="form-select" id="report-status"><option value="">Tất cả trạng thái</option><option value="COMPLETED">Completed</option><option value="PENDING">Pending</option><option value="OVERDUE">Overdue</option><option value="MATERIAL_FAIL">Material Fail</option></select></label>
          <button class="btn btn-primary report-refresh" id="report-refresh" type="button">Làm mới</button>
        </section>

        <section class="report-kpis" aria-label="Report KPIs">
          <article class="report-kpi"><span>COMPLETION RATE</span><strong id="kpi-completion">--</strong></article>
          <article class="report-kpi"><span>ON-TIME COMPLETION RATE</span><strong id="kpi-on-time">--</strong></article>
          <article class="report-kpi report-kpi-overdue"><span>OVERDUE RATE</span><strong id="kpi-overdue">--</strong></article>
          <article class="report-kpi report-kpi-fail"><span>MATERIAL FAIL RATE</span><strong id="kpi-material-fail">--</strong></article>
          <article class="report-kpi report-kpi-foh"><span>FOH ISSUES</span><strong id="kpi-foh-issues">--</strong></article>
          <article class="report-kpi report-kpi-boh"><span>BOH ISSUES</span><strong id="kpi-boh-issues">--</strong></article>
        </section>

        <section class="report-chart-grid" aria-label="Analytics charts">
          <article class="report-chart-panel">
            <h2>Completed vs Pending</h2>
            <div class="report-bar-chart" id="chart-completed-pending"></div>
          </article>
          <article class="report-chart-panel">
            <h2>Restaurant Completion</h2>
            <div class="report-restaurant-chart" id="chart-restaurants"></div>
          </article>
          <article class="report-chart-panel report-trend-panel">
            <h2>Daily Completion Trend</h2>
            <div id="chart-trend"></div>
          </article>
          <article class="report-chart-panel">
            <h2>FOH vs BOH Issues</h2>
            <div class="report-bar-chart" id="chart-departments"></div>
          </article>
        </section>

        <section class="report-detail-section">
          <div class="section-title"><h2>REPORT DETAIL</h2><span id="report-row-count" class="ac-result-count"></span></div>
          <div class="table-responsive">
            <table class="data-table">
              <thead><tr><th>Date</th><th>Restaurant</th><th>Shift</th><th>Submitted</th><th>Checked By</th><th>Total</th><th>Pass</th><th>Fail</th><th>Status</th></tr></thead>
              <tbody id="report-rows"><tr><td colspan="9" class="report-empty">Đang tải dữ liệu báo cáo...</td></tr></tbody>
            </table>
          </div>
        </section>
      </main>
    `;

    this.state = { mode: null };
    this.bindEvents();
    await this.loadData();
  }

  static dispose() {
    this.requestVersion++;
    this.state = null;
  }

  static bindEvents() {
    const container = this.container;
    container.querySelectorAll('.report-period-btn').forEach(button => {
      button.addEventListener('click', () => {
        container.querySelectorAll('.report-period-btn').forEach(periodButton => {
          const active = periodButton === button;
          periodButton.classList.toggle('active', active);
          periodButton.setAttribute('aria-pressed', String(active));
        });
        this.state.mode = button.dataset.period;
        this.loadData();
      });
    });
    container.querySelector('#report-date').addEventListener('change', () => this.loadData());
    ['restaurant', 'shift', 'department', 'status'].forEach(filter => {
      container.querySelector(`#report-${filter}`).addEventListener('change', () => this.renderReport());
    });
    container.querySelector('#report-refresh').addEventListener('click', () => this.loadData());
    container.querySelector('#export-csv').addEventListener('click', () => this.exportCsv());
    container.querySelector('#export-excel').addEventListener('click', () => this.exportExcel());
    container.querySelector('#export-pdf').addEventListener('click', () => window.print());
  }

  static async loadData() {
    const requestVersion = ++this.requestVersion;
    const selectedMode = this.state?.mode;
    const anchorDate = this.container.querySelector('#report-date').value || this.getLocalDate();
    const rows = this.container.querySelector('#report-rows');
    rows.innerHTML = '<tr><td colspan="9" class="report-empty">Đang tải dữ liệu báo cáo...</td></tr>';

    try {
      const settingsData = await Api.get('/api/settings');
      if (requestVersion !== this.requestVersion) return;
      const settings = Object.fromEntries((settingsData.settings || []).map(setting => [setting.key, setting.value]));
      const mode = selectedMode || settings.REPORT_DEFAULT_PERIOD || 'DAILY';
      const period = this.getPeriod(mode, anchorDate);
      const from = encodeURIComponent(period.fetchStart);
      const to = encodeURIComponent(period.end);
      const [assessmentData, issueData, restaurantData, shiftData] = await Promise.all([
        Api.get(`/api/assessments?from_date=${from}&to_date=${to}&limit=${encodeURIComponent(settings.REPORT_MAX_ROWS || '5000')}`),
        Api.get(`/api/material-issues?from_date=${from}&to_date=${to}`),
        Api.get('/api/restaurants?status=ACTIVE'),
        Api.get('/api/shifts')
      ]);
      if (requestVersion !== this.requestVersion || !this.container.querySelector('#report-rows')) return;

      this.state = {
        mode,
        anchorDate,
        period,
        assessments: assessmentData.assessments || [],
        issues: issueData.issues || [],
        restaurants: restaurantData.restaurants || [],
        shifts: shiftData.shifts || [],
        settings
      };
      this.populateFilters();
      this.renderReport();
    } catch (error) {
      if (requestVersion !== this.requestVersion) return;
      rows.innerHTML = `<tr><td colspan="9" class="report-empty report-error">Không thể tải báo cáo: ${this.escapeHtml(error.message)}</td></tr>`;
    }
  }

  static getPeriod(mode, anchorDate) {
    const anchor = this.parseDate(anchorDate);
    if (mode === 'WEEKLY') {
      const weekday = anchor.getUTCDay() || 7;
      const start = new Date(anchor.getTime() - (weekday - 1) * 86400000);
      return { start: this.formatDate(start), end: this.formatDate(new Date(start.getTime() + 6 * 86400000)), fetchStart: this.formatDate(start) };
    }
    if (mode === 'MONTHLY') {
      const start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
      const end = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0));
      return { start: this.formatDate(start), end: this.formatDate(end), fetchStart: this.formatDate(start) };
    }
    const trendStart = new Date(anchor.getTime() - 6 * 86400000);
    return { start: anchorDate, end: anchorDate, fetchStart: this.formatDate(trendStart) };
  }

  static populateFilters() {
    const restaurantSelect = this.container.querySelector('#report-restaurant');
    const selectedRestaurant = restaurantSelect.value;
    restaurantSelect.innerHTML = '<option value="">Tất cả nhà hàng</option>' + this.state.restaurants.map(restaurant =>
      `<option value="${this.escapeHtml(restaurant.id)}">${this.escapeHtml(restaurant.restaurant_code)} · ${this.escapeHtml(restaurant.restaurant_name)}</option>`
    ).join('');
    if (this.state.restaurants.some(restaurant => restaurant.id === selectedRestaurant)) restaurantSelect.value = selectedRestaurant;

    const shiftSelect = this.container.querySelector('#report-shift');
    const selectedShift = shiftSelect.value;
    shiftSelect.innerHTML = '<option value="">Tất cả ca bắt buộc</option>' + this.state.shifts.map(shift =>
      `<option value="${this.escapeHtml(shift.shift_code)}">${this.escapeHtml(shift.shift_name)}</option>`
    ).join('');
    if (this.state.shifts.some(shift => shift.shift_code === selectedShift)) shiftSelect.value = selectedShift;
  }

  static renderReport() {
    if (!this.state || !this.container.querySelector('#report-rows')) return;
    const restaurantId = this.container.querySelector('#report-restaurant').value;
    const shiftCode = this.container.querySelector('#report-shift').value;
    const department = this.container.querySelector('#report-department').value;
    const statusFilter = this.container.querySelector('#report-status').value;
    const restaurants = this.state.restaurants.filter(restaurant => !restaurantId || restaurant.id === restaurantId);
    const periodDates = this.getDateRange(this.state.period.start, this.minDate(this.state.period.end, this.getLocalDate()));
    const trendDates = this.state.mode === 'DAILY'
      ? this.getDateRange(this.state.period.fetchStart, this.minDate(this.state.period.end, this.getLocalDate()))
      : periodDates;
    const shiftCodes = shiftCode
      ? [shiftCode]
      : this.state.shifts.filter(shift => Number(shift.is_required) === 1).map(shift => shift.shift_code);
    const slots = this.buildSlots(restaurants, periodDates, shiftCodes, shiftCode);
    const visibleSlots = slots.filter(slot => this.matchesStatus(slot, statusFilter, department));
    const trendSlotsByDate = new Map(trendDates.map(date => [date, this.buildSlots(restaurants, [date], shiftCodes, shiftCode)
      .filter(slot => this.matchesStatus(slot, statusFilter, department))]));

    const selectedRestaurant = this.container.querySelector('#report-restaurant').selectedOptions[0]?.textContent || 'All restaurants';
    const selectedShift = this.container.querySelector('#report-shift').selectedOptions[0]?.textContent || 'Required shifts';
    const selectedDepartment = this.container.querySelector('#report-department').selectedOptions[0]?.textContent || 'FOH + BOH';
    const selectedStatus = this.container.querySelector('#report-status').selectedOptions[0]?.textContent || 'All statuses';
    this.container.querySelector('#report-period-label').textContent =
      `${this.periodLabel()} · ${selectedRestaurant} · ${selectedShift} · ${selectedDepartment} · ${selectedStatus}`;
    this.renderKpis(visibleSlots, department);
    this.renderCompletedChart(visibleSlots);
    this.renderRestaurantChart(restaurants, visibleSlots);
    this.renderTrendChart(trendDates, trendSlotsByDate);
    this.renderDepartmentChart(visibleSlots, department);
    this.renderRows(visibleSlots, department);
  }

  static buildSlots(restaurants, dates, shiftCodes, selectedShift) {
    if (!dates.length) return [];
    const restaurantIds = new Set(restaurants.map(restaurant => restaurant.id));
    const assessments = this.state.assessments.filter(assessment => restaurantIds.has(assessment.restaurant_id)
      && dates.includes(assessment.shift_date)
      && (!selectedShift || assessment.shift_type === selectedShift));
    const assessmentMap = new Map();
    assessments.forEach(assessment => {
      const key = `${assessment.restaurant_id}|${assessment.shift_date}|${assessment.shift_type}`;
      const current = assessmentMap.get(key);
      if (!current || new Date(assessment.submitted_at || assessment.created_at) > new Date(current.submitted_at || current.created_at)) {
        assessmentMap.set(key, assessment);
      }
    });

    const slots = [];
    const optionalShift = selectedShift && this.state.shifts.find(shift => shift.shift_code === selectedShift)?.is_required !== 1;
    if (optionalShift) {
      assessmentMap.forEach(assessment => slots.push(this.createSlot(assessment.restaurant_id, assessment.shift_date, assessment.shift_type, assessment)));
      return slots;
    }

    dates.forEach(date => restaurants.forEach(restaurant => shiftCodes.forEach(code => {
      const key = `${restaurant.id}|${date}|${code}`;
      const assessment = assessmentMap.get(key) || null;
      slots.push(this.createSlot(restaurant.id, date, code, assessment));
    })));
    return slots;
  }

  static createSlot(restaurantId, date, shiftCode, assessment) {
    const shift = this.state.shifts.find(item => item.shift_code === shiftCode);
    const deadline = shift?.deadline_time ? Date.parse(`${date}T${shift.deadline_time}:00+07:00`) : Number.POSITIVE_INFINITY;
    const due = Date.now() >= deadline;
    return {
      restaurantId,
      date,
      shiftCode,
      assessment,
      status: assessment ? 'COMPLETED' : (due ? 'OVERDUE' : 'PENDING'),
      due,
      onTime: Boolean(assessment && new Date(assessment.submitted_at || assessment.created_at).getTime() <= deadline)
    };
  }

  static getCounts(slot, department) {
    const assessment = slot.assessment;
    if (!assessment) return { total: 0, pass: 0, fail: 0 };
    if (department === 'FOH') {
      return {
        total: Number(assessment.foh_total_count) || 0,
        pass: Math.max(0, (Number(assessment.foh_total_count) || 0) - (Number(assessment.foh_fail_count) || 0)),
        fail: Number(assessment.foh_fail_count) || 0
      };
    }
    if (department === 'BOH') {
      return {
        total: Number(assessment.boh_total_count) || 0,
        pass: Math.max(0, (Number(assessment.boh_total_count) || 0) - (Number(assessment.boh_fail_count) || 0)),
        fail: Number(assessment.boh_fail_count) || 0
      };
    }
    return {
      total: Number(assessment.total_count) || 0,
      pass: Number(assessment.pass_count) || 0,
      fail: Number(assessment.fail_count) || 0
    };
  }

  static matchesStatus(slot, status, department) {
    if (!status) return true;
    if (status === 'MATERIAL_FAIL') return this.getCounts(slot, department).fail > 0;
    return slot.status === status;
  }

  static renderKpis(slots, department) {
    const completed = slots.filter(slot => slot.assessment);
    const dueSlots = slots.filter(slot => slot.due);
    const overdue = slots.filter(slot => slot.status === 'OVERDUE');
    const totalItems = slots.reduce((sum, slot) => sum + this.getCounts(slot, department).total, 0);
    const failedItems = slots.reduce((sum, slot) => sum + this.getCounts(slot, department).fail, 0);
    const fohIssues = department === 'BOH' ? 0 : slots.reduce((sum, slot) => sum + this.getCounts(slot, 'FOH').fail, 0);
    const bohIssues = department === 'FOH' ? 0 : slots.reduce((sum, slot) => sum + this.getCounts(slot, 'BOH').fail, 0);

    this.container.querySelector('#kpi-completion').textContent = this.percent(completed.length, slots.length);
    this.container.querySelector('#kpi-on-time').textContent = this.percent(completed.filter(slot => slot.onTime).length, completed.length);
    this.container.querySelector('#kpi-overdue').textContent = this.percent(overdue.length, dueSlots.length);
    this.container.querySelector('#kpi-material-fail').textContent = this.percent(failedItems, totalItems);
    this.container.querySelector('#kpi-foh-issues').textContent = fohIssues;
    this.container.querySelector('#kpi-boh-issues').textContent = bohIssues;
  }

  static renderCompletedChart(slots) {
    const counts = [
      { label: 'Completed', value: slots.filter(slot => slot.status === 'COMPLETED').length },
      { label: 'Pending', value: slots.filter(slot => slot.status === 'PENDING').length },
      { label: 'Overdue', value: slots.filter(slot => slot.status === 'OVERDUE').length }
    ];
    this.container.querySelector('#chart-completed-pending').innerHTML = this.renderBars(counts);
  }

  static renderRestaurantChart(restaurants, slots) {
    const chartRows = restaurants.map(restaurant => {
      const restaurantSlots = slots.filter(slot => slot.restaurantId === restaurant.id);
      const complete = restaurantSlots.filter(slot => slot.status === 'COMPLETED').length;
      return {
        label: `${restaurant.restaurant_code} · ${restaurant.restaurant_name}`,
        value: restaurantSlots.length ? Math.round((complete / restaurantSlots.length) * 100) : 0,
        suffix: '%',
        denominator: restaurantSlots.length
      };
    }).sort((left, right) => left.value - right.value || left.label.localeCompare(right.label));
    const chart = this.container.querySelector('#chart-restaurants');
    chart.innerHTML = chartRows.length ? `<div class="report-restaurant-bars">${chartRows.map(row => `
      <div class="report-restaurant-bar-row" title="${this.escapeHtml(row.label)}">
        <span>${this.escapeHtml(row.label)}</span><div class="report-track"><i style="width:${row.value}%"></i></div><strong>${row.denominator ? `${row.value}%` : '--'}</strong>
      </div>
    `).join('')}</div>` : this.emptyChart();
  }

  static renderTrendChart(dates, slotsByDate) {
    const chart = this.container.querySelector('#chart-trend');
    const data = dates.map(date => {
      const slots = slotsByDate.get(date) || [];
      const completed = slots.filter(slot => slot.status === 'COMPLETED').length;
      return { date, value: slots.length ? (completed / slots.length) * 100 : 0, count: slots.length };
    });
    if (!data.length) {
      chart.innerHTML = this.emptyChart();
      return;
    }

    const width = 620;
    const height = 220;
    const left = 36;
    const right = 12;
    const top = 16;
    const bottom = 38;
    const chartWidth = width - left - right;
    const chartHeight = height - top - bottom;
    const points = data.map((point, index) => {
      const x = data.length === 1 ? left + chartWidth / 2 : left + (index / (data.length - 1)) * chartWidth;
      const y = top + chartHeight - (point.value / 100) * chartHeight;
      return { ...point, x, y };
    });
    const gridLines = [0, 25, 50, 75, 100].map(value => {
      const y = top + chartHeight - (value / 100) * chartHeight;
      return `<line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}" class="report-grid-line"/><text x="${left - 8}" y="${y + 4}" text-anchor="end" class="report-axis-label">${value}%</text>`;
    }).join('');
    const labels = points.map((point, index) => index % Math.max(1, Math.ceil(points.length / 7)) === 0 || index === points.length - 1
      ? `<text x="${point.x}" y="${height - 8}" text-anchor="middle" class="report-axis-label">${this.escapeHtml(point.date.slice(5))}</text>` : '').join('');
    chart.innerHTML = `
      <svg class="report-trend-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Daily completion trend">
        ${gridLines}
        <polyline points="${points.map(point => `${point.x},${point.y}`).join(' ')}" class="report-trend-line"/>
        ${points.map(point => `<circle cx="${point.x}" cy="${point.y}" r="4" class="report-trend-point"><title>${this.escapeHtml(point.date)} · ${point.count ? `${point.value.toFixed(1)}%` : 'No shifts due'}</title></circle>`).join('')}
        ${labels}
      </svg>
    `;
  }

  static renderDepartmentChart(slots, department) {
    const foh = department === 'BOH' ? 0 : slots.reduce((sum, slot) => sum + this.getCounts(slot, 'FOH').fail, 0);
    const boh = department === 'FOH' ? 0 : slots.reduce((sum, slot) => sum + this.getCounts(slot, 'BOH').fail, 0);
    this.container.querySelector('#chart-departments').innerHTML = this.renderBars([
      { label: 'FOH Issues', value: foh },
      { label: 'BOH Issues', value: boh }
    ]);
  }

  static renderBars(items) {
    const max = Math.max(1, ...items.map(item => item.value));
    return `<div class="report-bars">${items.map(item => `
      <div class="report-bar-row">
        <span>${this.escapeHtml(item.label)}</span><div class="report-track"><i style="width:${Math.max(item.value ? 4 : 0, (item.value / max) * 100)}%"></i></div><strong>${item.value}</strong>
      </div>
    `).join('')}</div>`;
  }

  static renderRows(slots, department) {
    const rows = this.container.querySelector('#report-rows');
    const sorted = [...slots].sort((left, right) => left.date.localeCompare(right.date)
      || left.restaurantId.localeCompare(right.restaurantId)
      || left.shiftCode.localeCompare(right.shiftCode));
    this.container.querySelector('#report-row-count').textContent = `${sorted.length} records`;
    if (!sorted.length) {
      rows.innerHTML = '<tr><td colspan="9" class="report-empty">Không có dữ liệu trong bộ lọc hiện tại.</td></tr>';
      return;
    }

    const restaurantById = new Map(this.state.restaurants.map(restaurant => [restaurant.id, restaurant]));
    rows.innerHTML = sorted.map(slot => {
      const restaurant = restaurantById.get(slot.restaurantId);
      const counts = this.getCounts(slot, department);
      const assessment = slot.assessment;
      const submitted = assessment?.submitted_at ? new Date(assessment.submitted_at).toLocaleTimeString('vi-VN', {
        timeZone: this.timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }) : '--';
      const status = assessment && counts.fail > 0 ? 'COMPLETED · MATERIAL FAIL' : slot.status;
      return `<tr>
        <td>${this.escapeHtml(slot.date)}</td>
        <td>${this.escapeHtml(restaurant?.restaurant_name || '')}</td>
        <td>${this.escapeHtml(slot.shiftCode)}</td>
        <td>${this.escapeHtml(submitted)}</td>
        <td>${this.escapeHtml(assessment?.inspector_name || '--')}</td>
        <td>${counts.total}</td><td>${counts.pass}</td><td>${counts.fail}</td>
        <td><span class="badge ${slot.status === 'OVERDUE' || counts.fail > 0 ? 'badge-overdue' : slot.status === 'COMPLETED' ? 'badge-completed' : 'badge-gold'}">${this.escapeHtml(status)}</span></td>
      </tr>`;
    }).join('');
  }

  static periodLabel() {
    const { start, end } = this.state.period;
    const range = start === end ? start : `${start} → ${end}`;
    return `${this.state.mode} · ${range}`;
  }

  static percent(numerator, denominator) {
    return denominator ? `${((numerator / denominator) * 100).toFixed(1)}%` : '--';
  }

  static emptyChart() {
    return '<p class="report-empty">Không có dữ liệu.</p>';
  }

  static getExportRows() {
    const headers = ['Date', 'Restaurant', 'Shift', 'Submitted Time', 'Checked By', 'Total', 'Pass', 'Fail', 'Status'];
    const body = [...this.container.querySelectorAll('#report-rows tr')].map(row =>
      [...row.querySelectorAll('td')].map(cell => cell.innerText.trim())
    ).filter(row => row.length === headers.length);
    const selectedText = selector => this.container.querySelector(selector).selectedOptions[0]?.textContent || '';
    const summary = [
      ['REPORTING DASHBOARD', this.periodLabel()],
      ['Restaurant', selectedText('#report-restaurant') || 'All active restaurants'],
      ['Shift', selectedText('#report-shift') || 'All required shifts'],
      ['Department', selectedText('#report-department') || 'FOH + BOH'],
      ['Status', selectedText('#report-status') || 'All statuses'],
      ['Completion Rate', this.container.querySelector('#kpi-completion').textContent],
      ['On-time Completion Rate', this.container.querySelector('#kpi-on-time').textContent],
      ['Overdue Rate', this.container.querySelector('#kpi-overdue').textContent],
      ['Material Fail Rate', this.container.querySelector('#kpi-material-fail').textContent],
      ['FOH Issues', this.container.querySelector('#kpi-foh-issues').textContent],
      ['BOH Issues', this.container.querySelector('#kpi-boh-issues').textContent],
      [],
      headers
    ];
    return [...summary, ...body];
  }

  static exportCsv() {
    const csv = this.getExportRows().map(row => row.map(value => {
      const safeValue = /^[=+\-@]/.test(String(value)) ? `'${value}` : String(value);
      return `"${safeValue.replace(/"/g, '""')}"`;
    }).join(',')).join('\r\n');
    this.downloadFile(`chang-report-${this.state.anchorDate}.csv`, `\uFEFF${csv}`, 'text/csv;charset=utf-8');
  }

  static exportExcel() {
    const rows = this.getExportRows();
    const sheetRows = rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, columnIndex) => {
      const reference = `${this.columnName(columnIndex + 1)}${rowIndex + 1}`;
      const numericValue = typeof value === 'number' ? value : (rowIndex > 0 && /^\d+(\.\d+)?$/.test(String(value)) ? Number(value) : null);
      if (numericValue !== null) return `<c r="${reference}"><v>${numericValue}</v></c>`;
      return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${this.xmlEscape(value)}</t></is></c>`;
    }).join('')}</row>`).join('');
    const files = [
      { name: '[Content_Types].xml', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>' },
      { name: '_rels/.rels', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: 'xl/workbook.xml', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Report" sheetId="1" r:id="rId1"/></sheets></workbook>' },
      { name: 'xl/_rels/workbook.xml.rels', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>' },
      { name: 'xl/worksheets/sheet1.xml', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>` }
    ];
    this.downloadFile(`chang-report-${this.state.anchorDate}.xlsx`, this.zipStore(files), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }

  static downloadFile(name, content, type) {
    const blob = content instanceof Uint8Array ? new Blob([content], { type }) : new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  }

  static zipStore(files) {
    const encoder = new TextEncoder();
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    const writeHeader = (length, write) => {
      const bytes = new Uint8Array(length);
      write(new DataView(bytes.buffer));
      return bytes;
    };
    files.forEach(file => {
      const name = encoder.encode(file.name);
      const data = encoder.encode(file.content);
      const crc = this.crc32(data);
      const local = writeHeader(30, view => {
        view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(6, 0x0800, true);
        view.setUint16(8, 0, true); view.setUint32(14, crc, true); view.setUint32(18, data.length, true);
        view.setUint32(22, data.length, true); view.setUint16(26, name.length, true);
      });
      localParts.push(local, name, data);
      const central = writeHeader(46, view => {
        view.setUint32(0, 0x02014b50, true); view.setUint16(4, 20, true); view.setUint16(6, 20, true);
        view.setUint16(8, 0x0800, true); view.setUint16(10, 0, true); view.setUint32(16, crc, true);
        view.setUint32(20, data.length, true); view.setUint32(24, data.length, true); view.setUint16(28, name.length, true);
        view.setUint32(42, offset, true);
      });
      centralParts.push(central, name);
      offset += local.length + name.length + data.length;
    });
    const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
    const end = writeHeader(22, view => {
      view.setUint32(0, 0x06054b50, true); view.setUint16(8, files.length, true); view.setUint16(10, files.length, true);
      view.setUint32(12, centralSize, true); view.setUint32(16, offset, true);
    });
    const output = new Uint8Array(offset + centralSize + end.length);
    let cursor = 0;
    [...localParts, ...centralParts, end].forEach(part => { output.set(part, cursor); cursor += part.length; });
    return output;
  }

  static crc32(data) {
    let crc = 0xffffffff;
    data.forEach(byte => {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    });
    return (crc ^ 0xffffffff) >>> 0;
  }

  static columnName(number) {
    let name = '';
    while (number > 0) {
      const remainder = (number - 1) % 26;
      name = String.fromCharCode(65 + remainder) + name;
      number = Math.floor((number - 1) / 26);
    }
    return name;
  }

  static xmlEscape(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
    })[character]);
  }

  static parseDate(value) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  static formatDate(date) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  }

  static addDays(value, amount) {
    return this.formatDate(new Date(this.parseDate(value).getTime() + amount * 86400000));
  }

  static getDateRange(start, end) {
    if (!start || !end || start > end) return [];
    const dates = [];
    for (let date = start; date <= end; date = this.addDays(date, 1)) dates.push(date);
    return dates;
  }

  static minDate(left, right) {
    return left < right ? left : right;
  }

  static getLocalDate(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.timeZone, year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  static escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }
}