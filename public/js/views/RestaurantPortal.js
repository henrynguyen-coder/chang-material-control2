import { Api } from '../api.js';
import { Store } from '../store.js';
import { ChecklistHistoryView } from './ChecklistHistoryView.js';

export class RestaurantPortal {
  static timerInterval = null;

  static getBusinessDate(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  static async render(container) {
    if (this.timerInterval) clearInterval(this.timerInterval);

    const user = Store.user;
    const restaurantName = user?.restaurant_name || 'Nhà Hàng Chang';

    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' };
    const currentDateStr = now.toLocaleDateString('vi-VN', options);

    // Fetch shift configurations from Database (Phase 6)
    let shiftsConfig = [];
    try {
      const data = await Api.get('/api/shifts');
      shiftsConfig = data.shifts || [];
    } catch (e) {
      console.warn('Could not fetch shifts config', e);
    }

    const mornConfig = shiftsConfig.find(s => s.shift_code === 'MORNING') || { deadline_time: '10:30', is_required: 1 };
    const midConfig = shiftsConfig.find(s => s.shift_code === 'MID_SHIFT') || { deadline_time: '14:00', is_required: 0 };
    const eveConfig = shiftsConfig.find(s => s.shift_code === 'EVENING') || { deadline_time: '17:30', is_required: 1 };

    // Fetch existing assessments for today
    let assessments = [];
    try {
      const data = await Api.get(`/api/assessments?shift_date=${this.getBusinessDate(now)}`);
      assessments = data.assessments || [];
    } catch (e) {
      console.warn('Could not fetch assessments', e);
    }

    const morningCheck = assessments.find(a => a.shift_type === 'MORNING');
    const midCheck = assessments.find(a => a.shift_type === 'MID_SHIFT');
    const eveningCheck = assessments.find(a => a.shift_type === 'EVENING');

    container.innerHTML = `
      <div class="restaurant-dashboard">
        <!-- Header Welcome Banner -->
        <div class="welcome-card">
          <div class="app-subtitle">CHANG MATERIAL CONTROL</div>
          <div class="greeting-name">Xin chào, ${restaurantName}</div>
          <div class="current-date">📅 ${currentDateStr} (Asia/Ho_Chi_Minh)</div>
        </div>

        <div class="section-title">
          <span>TODAY'S SHIFT CONTROL</span>
          <div class="restaurant-control-actions">
            <button class="btn btn-secondary btn-sm" id="open-checklist-history" type="button">Checklist History</button>
            <span class="badge badge-gold">DEADLINE ENGINE LIVE</span>
          </div>
        </div>

        <!-- Shift Grid Cards -->
        <div class="shift-grid">

          <!-- CA SÁNG CARD -->
          <div class="shift-card" id="card-morning">
            <div class="shift-header">
              <span class="shift-title">🌅 CA SÁNG</span>
              <span class="shift-deadline">Deadline DB: <b id="dl-text-morning">${mornConfig.deadline_time}</b></span>
            </div>
            
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span class="subtext">Thời gian còn lại:</span>
              <div class="timer-box" id="timer-morning">⏱️ --:--:--</div>
            </div>

            <div id="action-morning"></div>
          </div>

          <!-- CA GIỮA CARD (OPTIONAL) -->
          <div class="shift-card" id="card-mid">
            <div class="shift-header">
              <span class="shift-title" style="color: var(--color-text-muted);">☀️ CA GIỮA (OPTIONAL)</span>
              <span class="shift-deadline">Deadline DB: <b id="dl-text-mid">${midConfig.deadline_time}</b></span>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span class="subtext">Thời gian còn lại:</span>
              <div class="timer-box" id="timer-mid">⏱️ --:--:--</div>
            </div>
            <div id="action-mid"></div>
          </div>

          <!-- CA CHIỀU / TỐI CARD -->
          <div class="shift-card" id="card-evening">
            <div class="shift-header">
              <span class="shift-title">🌙 CA CHIỀU / TỐI</span>
              <span class="shift-deadline">Deadline DB: <b id="dl-text-evening">${eveConfig.deadline_time}</b></span>
            </div>

            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span class="subtext">Thời gian còn lại:</span>
              <div class="timer-box" id="timer-evening">⏱️ --:--:--</div>
            </div>

            <div id="action-evening"></div>
          </div>

        </div>
      </div>

      <!-- Phase 5 Checklist Modal -->
      <div class="modal-overlay" id="checklist-modal">
        <div class="modal-card" style="max-width: 650px;">
          <div class="modal-header">
            <div>
              <h3 id="modal-shift-title" style="color: var(--color-warm-white); margin-bottom: 2px;">KIỂM TRA NGUYÊN VẬT LIỆU</h3>
              <div style="font-size: 0.8rem; color: var(--color-gold-light);">Material Checklist Engine (FOH & BOH)</div>
            </div>
            <button id="close-modal-btn" style="background: none; border: none; color: white; font-size: 1.5rem; cursor: pointer;">&times;</button>
          </div>

          <!-- Progress Counters Header -->
          <div style="background: var(--color-linen-bg); padding: 12px 16px; border-bottom: 1px solid var(--color-border-subtle); display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; font-weight: 700;">
            <div style="color: var(--color-burgundy-primary);">FOH: <span id="progress-foh-counter" style="color: var(--color-thai-red);">0/0</span></div>
            <div style="color: var(--color-burgundy-primary);">BOH: <span id="progress-boh-counter" style="color: var(--color-thai-red);">0/0</span></div>
            <div style="color: var(--color-burgundy-primary);">TOTAL: <span id="progress-total-counter" style="color: var(--color-gold-dark);">0/0</span></div>
          </div>

          <div class="modal-body" id="modal-body-content" style="padding: 16px;">
            <p style="text-align: center; padding: 20px;">Đang tải danh mục vật tư FOH & BOH...</p>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" id="cancel-check-btn">Hủy</button>
            <button class="btn btn-secondary" id="save-check-draft-btn" type="button">Lưu nháp</button>
            <button class="btn btn-primary" id="submit-check-btn">NỘP BÁO CÁO KIỂM TRA</button>
          </div>
        </div>
      </div>
    `;

    ChecklistHistoryView.mount(container, {
      triggerSelector: '#open-checklist-history',
      restaurantOnly: true,
      getRestaurantId: () => Store.user?.restaurant_id || ''
    });
    this.updateShiftCardStates(morningCheck, midCheck, eveningCheck, mornConfig, midConfig, eveConfig);
    this.startRealtimeTimers(morningCheck, midCheck, eveningCheck, mornConfig, midConfig, eveConfig);

    const modal = container.querySelector('#checklist-modal');
    container.querySelector('#close-modal-btn').addEventListener('click', () => modal.classList.remove('active'));
    container.querySelector('#cancel-check-btn').addEventListener('click', () => modal.classList.remove('active'));
  }

  static updateShiftCardStates(morningCheck, midCheck, eveningCheck, mornConfig, midConfig, eveConfig) {
    const now = new Date();
    const todayStr = this.getBusinessDate(now);

    const morningDeadline = new Date(`${todayStr}T${mornConfig.deadline_time}:00+07:00`);
    const midDeadline = new Date(`${todayStr}T${midConfig.deadline_time}:00+07:00`);
    const eveningDeadline = new Date(`${todayStr}T${eveConfig.deadline_time}:00+07:00`);

    // --- MORNING ---
    const cardMorning = document.querySelector('#card-morning');
    const actionMorning = document.querySelector('#action-morning');
    if (morningCheck) {
      const subTime = new Date(morningCheck.submitted_at);
      const isLate = subTime > morningDeadline;
      cardMorning.className = 'shift-card completed';
      actionMorning.innerHTML = `<div class="status-indicator completed">✓ ${isLate ? 'COMPLETED – LATE' : 'COMPLETED – ON TIME'}</div>`;
    } else if (now > morningDeadline) {
      cardMorning.className = 'shift-card overdue';
      actionMorning.innerHTML = `
        <div class="status-indicator overdue">🔴 OVERDUE</div>
        <button class="btn btn-primary shift-action-btn" style="margin-top: 8px;" onclick="window.startChecklist('MORNING')">[ BẮT ĐẦU KIỂM TRA BỔ SUNG ]</button>
      `;
    } else {
      cardMorning.className = 'shift-card pending';
      actionMorning.innerHTML = `<button class="btn btn-primary shift-action-btn" onclick="window.startChecklist('MORNING')">[ BẮT ĐẦU KIỂM TRA ]</button>`;
    }

    // --- MID SHIFT (OPTIONAL) ---
    const cardMid = document.querySelector('#card-mid');
    const actionMid = document.querySelector('#action-mid');
    if (midCheck) {
      cardMid.className = 'shift-card completed';
      actionMid.innerHTML = `<div class="status-indicator completed">✓ COMPLETED</div>`;
    } else {
      cardMid.className = 'shift-card pending';
      actionMid.innerHTML = `<button class="btn btn-secondary shift-action-btn" onclick="window.startChecklist('MID_SHIFT')">[ BẮT ĐẦU KIỂM TRA ]</button>`;
    }

    // --- EVENING ---
    const cardEvening = document.querySelector('#card-evening');
    const actionEvening = document.querySelector('#action-evening');
    if (eveningCheck) {
      const subTime = new Date(eveningCheck.submitted_at);
      const isLate = subTime > eveningDeadline;
      cardEvening.className = 'shift-card completed';
      actionEvening.innerHTML = `<div class="status-indicator completed">✓ ${isLate ? 'COMPLETED – LATE' : 'COMPLETED – ON TIME'}</div>`;
    } else if (now > eveningDeadline) {
      cardEvening.className = 'shift-card overdue';
      actionEvening.innerHTML = `
        <div class="status-indicator overdue">🔴 OVERDUE</div>
        <button class="btn btn-primary shift-action-btn" style="margin-top: 8px;" onclick="window.startChecklist('EVENING')">[ BẮT ĐẦU KIỂM TRA BỔ SUNG ]</button>
      `;
    } else {
      cardEvening.className = 'shift-card pending';
      actionEvening.innerHTML = `<button class="btn btn-primary shift-action-btn" onclick="window.startChecklist('EVENING')">[ BẮT ĐẦU KIỂM TRA ]</button>`;
    }

    window.startChecklist = (shiftType) => this.openChecklistModal(shiftType);
  }

  static startRealtimeTimers(morningCheck, midCheck, eveningCheck, mornConfig, midConfig, eveConfig) {
    const updateTimers = () => {
      const now = new Date();
      const todayStr = this.getBusinessDate(now);

      const morningDeadline = new Date(`${todayStr}T${mornConfig.deadline_time}:00+07:00`);
      const midDeadline = new Date(`${todayStr}T${midConfig.deadline_time}:00+07:00`);
      const eveningDeadline = new Date(`${todayStr}T${eveConfig.deadline_time}:00+07:00`);

      const timerMorning = document.querySelector('#timer-morning');
      const timerMid = document.querySelector('#timer-mid');
      const timerEvening = document.querySelector('#timer-evening');

      this.updateShiftTimer(timerMorning, morningCheck, morningDeadline, mornConfig, now);
      this.updateShiftTimer(timerMid, midCheck, midDeadline, midConfig, now);
      this.updateShiftTimer(timerEvening, eveningCheck, eveningDeadline, eveConfig, now);
    };

    updateTimers();
    this.timerInterval = setInterval(updateTimers, 1000);
  }

  static updateShiftTimer(timer, assessment, deadline, config, now) {
    if (!timer) return;
    if (assessment) {
      timer.textContent = 'HOÀN THÀNH';
      timer.style.color = '#1E7E34';
      return;
    }

    const remaining = deadline - now;
    if (remaining <= 0) {
      timer.textContent = 'QUÁ HẠN';
      timer.style.color = '#DC2626';
      return;
    }

    const reminderWindow = Math.max(0, Number(config.reminder_minutes_before) || 0) * 60000;
    const reminderActive = reminderWindow > 0 && remaining <= reminderWindow;
    timer.textContent = `${reminderActive ? 'NHẮC HẠN · ' : ''}${this.formatDiff(remaining)}`;
    timer.style.color = reminderActive ? '#B45309' : '';
  }

  static formatDiff(ms) {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  static async openChecklistModal(shiftType) {
    const modal = document.querySelector('#checklist-modal');
    const modalBody = document.querySelector('#modal-body-content');
    const modalTitle = document.querySelector('#modal-shift-title');

    modalTitle.textContent = `KIỂM TRA NGUYÊN VẬT LIỆU - CA ${shiftType === 'MORNING' ? 'SÁNG' : shiftType === 'EVENING' ? 'TỐI' : 'GIỮA'}`;
    modalBody.innerHTML = '<p style="text-align: center; padding: 20px;">Đang tải danh mục vật tư FOH & BOH...</p>';
    modal.classList.add('active');
    this.logChecklistEvent('CHECKLIST START', shiftType, 0);

    try {
      const itemsData = await Api.get('/api/checklists/chk-morn-01/items');
      const items = itemsData.items || [];

      const fohItems = items.filter(it => it.department === 'FOH');
      const bohItems = items.filter(it => it.department === 'BOH');

      let html = `
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div style="display: flex; gap: 8px; position: sticky; top: 0; background: var(--color-warm-white); padding-bottom: 8px; z-index: 10;">
            <button class="tab-btn active dept-tab-btn" data-dept="ALL">Tất cả (${items.length})</button>
            <button class="tab-btn dept-tab-btn" data-dept="FOH">🥤 FOH (${fohItems.length})</button>
            <button class="tab-btn dept-tab-btn" data-dept="BOH">🍳 BOH (${bohItems.length})</button>
          </div>

          <div id="checklist-items-list" style="display: flex; flex-direction: column; gap: 14px;">
      `;

      items.forEach((it, idx) => {
        html += `
          <div class="material-item-card" data-dept="${it.department}" data-item-id="${it.id}" data-mandatory="${it.is_mandatory}" data-photo="${it.photo_required}" style="background: var(--color-warm-white); border: 1px solid var(--color-border-subtle); border-radius: 12px; padding: 14px; box-shadow: var(--box-shadow-subtle);">
            
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 6px;">
              <div>
                <span class="badge ${it.department === 'FOH' ? 'badge-gold' : 'badge-completed'}">${it.department}</span>
                <strong style="font-size: 0.95rem; color: var(--color-burgundy-primary);">${it.material_name}</strong>
                <span style="font-size: 0.75rem; color: var(--color-text-muted);">(${it.material_code})</span>
              </div>
              <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                ${it.is_mandatory ? '<span class="badge badge-overdue">🔴 Mandatory</span>' : '<span class="badge">Optional</span>'}
                ${it.photo_required ? '<span class="badge badge-gold">📷 Photo Req</span>' : ''}
              </div>
            </div>

            <div style="font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 10px;">
              📋 Tiêu chuẩn: ${it.requirement_text}
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; margin-bottom: 10px; background: var(--color-linen-bg); padding: 10px; border-radius: 8px;">
              <div>
                <label style="font-size: 0.75rem; font-weight: 700; color: var(--color-charcoal-medium); display: block;">Màu Sắc (Color)</label>
                <select class="form-select crit-select crit-color" data-item-id="${it.id}" style="padding: 6px; font-size: 0.8rem;">
                  <option value="PASS">✅ PASS</option>
                  <option value="FAIL">❌ FAIL</option>
                  <option value="N/A">➖ N/A</option>
                </select>
              </div>

              <div>
                <label style="font-size: 0.75rem; font-weight: 700; color: var(--color-charcoal-medium); display: block;">Mùi Vị (Smell)</label>
                <select class="form-select crit-select crit-smell" data-item-id="${it.id}" style="padding: 6px; font-size: 0.8rem;">
                  <option value="PASS">✅ PASS</option>
                  <option value="FAIL">❌ FAIL</option>
                  <option value="N/A">➖ N/A</option>
                </select>
              </div>

              <div>
                <label style="font-size: 0.75rem; font-weight: 700; color: var(--color-charcoal-medium); display: block;">Nếm Thử (Taste)</label>
                <select class="form-select crit-select crit-taste" data-item-id="${it.id}" style="padding: 6px; font-size: 0.8rem;">
                  <option value="PASS">✅ PASS</option>
                  <option value="FAIL">❌ FAIL</option>
                  <option value="N/A">➖ N/A</option>
                </select>
              </div>

              <div>
                <label style="font-size: 0.75rem; font-weight: 700; color: var(--color-charcoal-medium); display: block;">Chất Lượng (Quality)</label>
                <select class="form-select crit-select crit-quality" data-item-id="${it.id}" style="padding: 6px; font-size: 0.8rem;">
                  <option value="PASS">✅ PASS</option>
                  <option value="FAIL">❌ FAIL</option>
                  <option value="N/A">➖ N/A</option>
                </select>
              </div>
            </div>

            <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: rgba(0,0,0,0.03); border-radius: 6px; margin-bottom: 8px;">
              <span style="font-size: 0.8rem; font-weight: 700; color: var(--color-charcoal-medium);">ALLOWED TO SERVE (Tự Động Tính):</span>
              <span class="serve-status-badge badge badge-completed" id="serve-badge-${it.id}">YES</span>
            </div>

            <div class="remark-box" id="remark-box-${it.id}" style="display: flex; flex-direction: column; gap: 4px; margin-top: 6px;">
              <label style="font-size: 0.75rem; font-weight: 700; color: var(--color-charcoal-medium);">Remark / Ghi Chú:</label>
              <input type="text" class="form-input item-remark" data-item-id="${it.id}" placeholder="Ghi chú thêm...">
            </div>

            ${it.photo_required ? `
              <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--color-border-subtle);">
                <label style="font-size: 0.75rem; font-weight: 700; color: var(--color-thai-red);">📷 Ảnh Chụp Bắt Buộc (Photo Required):</label>
                <input type="text" class="form-input item-photo" data-item-id="${it.id}" placeholder="Đường dẫn ảnh hoặc đính kèm ảnh (vd: img_photo_01.jpg)" value="attached_photo_demo.jpg">
              </div>
            ` : ''}

          </div>
        `;
      });

      html += `
          </div>
          <div class="form-group">
            <label class="form-label">Ghi chú chung toàn ca (General Shift Notes):</label>
            <textarea id="assessment-notes" class="form-textarea" rows="2" placeholder="Nhập tổng quan ca làm việc..."></textarea>
          </div>
        </div>
      `;

      modalBody.innerHTML = html;
      this.restoreChecklistDraft(items, modalBody, shiftType);
      this.updateChecklistProgress(items);

      const deptTabs = modalBody.querySelectorAll('.dept-tab-btn');
      deptTabs.forEach(tab => {
        tab.addEventListener('click', () => {
          deptTabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          const dept = tab.dataset.dept;
          modalBody.querySelectorAll('.material-item-card').forEach(card => {
            if (dept === 'ALL' || card.dataset.dept === dept) {
              card.style.display = 'block';
            } else {
              card.style.display = 'none';
            }
          });
        });
      });

      modalBody.querySelectorAll('.crit-select').forEach(sel => {
        sel.addEventListener('change', () => {
          const itemId = sel.dataset.itemId;
          const card = modalBody.querySelector(`.material-item-card[data-item-id="${itemId}"]`);
          
          const cColor = card.querySelector('.crit-color').value;
          const cSmell = card.querySelector('.crit-smell').value;
          const cTaste = card.querySelector('.crit-taste').value;
          const cQuality = card.querySelector('.crit-quality').value;

          const hasFail = (cColor === 'FAIL' || cSmell === 'FAIL' || cTaste === 'FAIL' || cQuality === 'FAIL');
          const serveBadge = card.querySelector(`#serve-badge-${itemId}`);
          const remarkInput = card.querySelector(`.item-remark[data-item-id="${itemId}"]`);

          if (hasFail) {
            serveBadge.textContent = 'NO';
            serveBadge.className = 'serve-status-badge badge badge-overdue';
            remarkInput.placeholder = '⚠️ BẮT BUỘC nhập nguyên nhân bị FAIL...';
            remarkInput.style.borderColor = 'var(--color-thai-red)';
          } else {
            serveBadge.textContent = 'YES';
            serveBadge.className = 'serve-status-badge badge badge-completed';
            remarkInput.placeholder = 'Ghi chú thêm...';
            remarkInput.style.borderColor = 'var(--color-border-subtle)';
          }

          this.updateChecklistProgress(items);
        });
      });

      const submitBtn = document.querySelector('#submit-check-btn');
      document.querySelector('#save-check-draft-btn').onclick = async () => {
        const draft = {
          items: this.collectChecklistItems(items, modalBody),
          notes: document.querySelector('#assessment-notes')?.value || '',
          saved_at: new Date().toISOString()
        };
        try {
          localStorage.setItem(this.getDraftKey(shiftType), JSON.stringify(draft));
          await this.logChecklistEvent('CHECKLIST SAVE', shiftType, draft.items.length);
          alert('✓ Đã lưu checklist nháp trên thiết bị này.');
        } catch (error) {
          alert(`Không thể lưu nháp: ${error.message}`);
        }
      };

      submitBtn.onclick = async () => {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Đang kiểm tra & gửi...';

        const detailItems = [];
        let validationError = null;

        items.forEach(it => {
          const card = modalBody.querySelector(`.material-item-card[data-item-id="${it.id}"]`);
          if (!card) return;

          const cColor = card.querySelector('.crit-color').value;
          const cSmell = card.querySelector('.crit-smell').value;
          const cTaste = card.querySelector('.crit-taste').value;
          const cQuality = card.querySelector('.crit-quality').value;
          const remark = card.querySelector(`.item-remark`)?.value.trim() || '';
          const photoUrl = card.querySelector(`.item-photo`)?.value.trim() || '';

          const hasFail = (cColor === 'FAIL' || cSmell === 'FAIL' || cTaste === 'FAIL' || cQuality === 'FAIL');

          if (hasFail && !remark) {
            validationError = `Vật tư "${it.material_name}" bị FAIL. Bắt buộc nhập Remark nguyên nhân!`;
          }

          if (it.photo_required && !photoUrl) {
            validationError = `Vật tư "${it.material_name}" yêu cầu hình ảnh đính kèm (Photo Required)!`;
          }

          detailItems.push({
            checklist_item_id: it.id,
            color_result: cColor,
            smell_result: cSmell,
            taste_result: cTaste,
            quality_result: cQuality,
            remark,
            photo_url: photoUrl
          });
        });

        if (validationError) {
          alert(`❌ KHÔNG THỂ NỘP:\n${validationError}`);
          submitBtn.disabled = false;
          submitBtn.textContent = 'NỘP BÁO CÁO KIỂM TRA';
          return;
        }

        const notes = document.querySelector('#assessment-notes')?.value || '';

        try {
          await Api.post('/api/assessments', {
            checklist_id: 'chk-morn-01',
            shift_type: shiftType,
            shift_date: this.getBusinessDate(),
            notes,
            items: detailItems
          });

          localStorage.removeItem(this.getDraftKey(shiftType));
          modal.classList.remove('active');
          alert('✓ Gửi báo cáo kiểm tra đầu ca thành công!');
          this.render(document.querySelector('#app-view-container'));
        } catch (err) {
          alert(`❌ Lỗi hệ thống: ${err.message}`);
          submitBtn.disabled = false;
          submitBtn.textContent = 'NỘP BÁO CÁO KIỂM TRA';
        }
      };

    } catch (e) {
      modalBody.innerHTML = `<p style="color: red;">Không thể tải danh mục vật tư: ${e.message}</p>`;
    }
  }

  static getDraftKey(shiftType) {
    return `chang_checklist_draft:${Store.user?.restaurant_id || 'unknown'}:${shiftType}:${this.getBusinessDate()}`;
  }

  static collectChecklistItems(items, modalBody) {
    return items.map(item => {
      const card = modalBody.querySelector(`.material-item-card[data-item-id="${item.id}"]`);
      if (!card) return null;
      return {
        checklist_item_id: item.id,
        color_result: card.querySelector('.crit-color').value,
        smell_result: card.querySelector('.crit-smell').value,
        taste_result: card.querySelector('.crit-taste').value,
        quality_result: card.querySelector('.crit-quality').value,
        remark: card.querySelector('.item-remark')?.value || '',
        photo_url: card.querySelector('.item-photo')?.value || ''
      };
    }).filter(Boolean);
  }

  static restoreChecklistDraft(items, modalBody, shiftType) {
    try {
      const draft = JSON.parse(localStorage.getItem(this.getDraftKey(shiftType)) || 'null');
      if (!draft) return;
      const savedItems = new Map((draft.items || []).map(item => [item.checklist_item_id, item]));
      items.forEach(item => {
        const saved = savedItems.get(item.id);
        if (!saved) return;
        const card = modalBody.querySelector(`.material-item-card[data-item-id="${item.id}"]`);
        ['color', 'smell', 'taste', 'quality'].forEach(criterion => {
          const input = card.querySelector(`.crit-${criterion}`);
          if (saved[`${criterion}_result`]) input.value = saved[`${criterion}_result`];
        });
        card.querySelector('.item-remark').value = saved.remark || '';
        const photoInput = card.querySelector('.item-photo');
        if (photoInput && saved.photo_url) photoInput.value = saved.photo_url;
        card.querySelector('.crit-color').dispatchEvent(new Event('change', { bubbles: true }));
      });
      document.querySelector('#assessment-notes').value = draft.notes || '';
    } catch (error) {
      console.warn('Could not restore saved checklist draft', error);
    }
  }

  static logChecklistEvent(action, shiftType, itemCount) {
    Api.post('/api/audit-events', {
      action,
      shift_type: shiftType,
      shift_date: this.getBusinessDate(),
      item_count: itemCount
    }).catch(error => console.warn('Could not save checklist audit event', error));
  }

  static updateChecklistProgress(items) {
    const cards = document.querySelectorAll('.material-item-card');
    let fohDone = 0, fohTotal = 0;
    let bohDone = 0, bohTotal = 0;

    cards.forEach(card => {
      const dept = card.dataset.dept;
      if (dept === 'FOH') {
        fohTotal++;
        fohDone++;
      } else if (dept === 'BOH') {
        bohTotal++;
        bohDone++;
      }
    });

    const totalDone = fohDone + bohDone;
    const totalCount = fohTotal + bohTotal;

    const elFoh = document.querySelector('#progress-foh-counter');
    const elBoh = document.querySelector('#progress-boh-counter');
    const elTot = document.querySelector('#progress-total-counter');

    if (elFoh) elFoh.textContent = `${fohDone}/${fohTotal}`;
    if (elBoh) elBoh.textContent = `${bohDone}/${bohTotal}`;
    if (elTot) elTot.textContent = `${totalDone}/${totalCount}`;
  }
}
