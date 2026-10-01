import { Api } from '../api.js';
import { ReportingDashboard } from './ReportingDashboard.js';

export class AdminPanel {
  static masterDataContext = null;

  static async render(container) {
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 20px;">
        <div class="welcome-card" style="background: linear-gradient(135deg, var(--color-burgundy-dark) 0%, #1A1A1A 100%);">
          <div class="app-subtitle">SYSTEM ADMIN PANEL</div>
          <div class="greeting-name">QUẢN TRỊ DANH MỤC & MASTER DATA HỆ THỐNG</div>
          <div class="current-date">Quản lý 15 Nhà hàng, Phân quyền người dùng & Cấu hình Deadline ca làm việc</div>
        </div>

        <!-- Admin Sub Tabs -->
        <div class="view-tabs" id="admin-subtabs">
          <button class="tab-btn active" data-tab="restaurants">Restaurants</button>
          <button class="tab-btn" data-tab="users">Users</button>
          <button class="tab-btn" data-tab="roles">Roles</button>
          <button class="tab-btn" data-tab="materials">Materials</button>
          <button class="tab-btn" data-tab="checklist-materials">Checklist Materials</button>
          <button class="tab-btn" data-tab="categories">Categories</button>
          <button class="tab-btn" data-tab="departments">Departments</button>
          <button class="tab-btn" data-tab="shifts">Shifts</button>
          <button class="tab-btn" data-tab="deadlines">Deadlines</button>
          <button class="tab-btn" data-tab="notifications">Notifications</button>
          <button class="tab-btn" data-tab="reports">Reports</button>
          <button class="tab-btn" data-tab="audit">Audit Logs</button>
          <button class="tab-btn" data-tab="settings">Settings</button>
        </div>

        <!-- TAB CONTENT CONTAINER -->
        <div id="admin-tab-content"></div>
      </div>

      <!-- ADD/EDIT RESTAURANT MODAL -->
      <div class="modal-overlay" id="restaurant-modal">
        <div class="modal-card">
          <div class="modal-header">
            <h3 id="rest-modal-title" style="color: var(--color-warm-white);">THÊM NHÀ HÀNG MỚI</h3>
            <button id="close-rest-modal-btn" style="background: none; border: none; color: white; font-size: 1.5rem; cursor: pointer;">&times;</button>
          </div>
          <div class="modal-body">
            <div id="rest-modal-error" style="display: none; background: #FEE2E2; color: #DC2626; padding: 10px 14px; border-radius: 8px; font-size: 0.875rem; margin-bottom: 14px; border: 1px solid rgba(220,38,38,0.3);"></div>

            <form id="restaurant-form">
              <input type="hidden" id="rest-id-input">
              <div class="form-group">
                <label class="form-label" for="rest-code-input">Mã Nhà Hàng (Restaurant Code) *</label>
                <input type="text" id="rest-code-input" class="form-input" placeholder="Ví dụ: CT-NDC, CT-PXL" required style="text-transform: uppercase;">
                <span class="subtext">Phải là duy nhất, không được trùng lặp.</span>
              </div>

              <div class="form-group">
                <label class="form-label" for="rest-name-input">Tên Nhà Hàng (Restaurant Name) *</label>
                <input type="text" id="rest-name-input" class="form-input" placeholder="Ví dụ: CT - Nguyễn Đức Cảnh" required>
              </div>

              <div class="form-group">
                <label class="form-label" for="rest-status-select">Trạng Thái Vận Hành</label>
                <select id="rest-status-select" class="form-select">
                  <option value="ACTIVE">ACTIVE (Đang Hoạt Động)</option>
                  <option value="INACTIVE">INACTIVE (Tạm Ngừng)</option>
                </select>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="cancel-rest-btn">Hủy</button>
            <button class="btn btn-primary" id="save-rest-btn">LƯU DỮ LIỆU</button>
          </div>
        </div>
      </div>

      <div class="modal-overlay" id="masterdata-modal" role="dialog" aria-modal="true" aria-labelledby="masterdata-modal-title">
        <div class="modal-card masterdata-modal-card">
          <div class="modal-header">
            <h3 id="masterdata-modal-title">Cập nhật dữ liệu</h3>
            <button id="close-masterdata-modal-btn" type="button" aria-label="Đóng" style="background: none; border: none; color: white; font-size: 1.5rem; cursor: pointer;">&times;</button>
          </div>
          <div class="modal-body">
            <div id="masterdata-modal-error" class="masterdata-modal-error" hidden></div>
            <div id="masterdata-modal-fields" class="masterdata-modal-fields"></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="cancel-masterdata-modal-btn" type="button">Hủy</button>
            <button class="btn btn-primary" id="save-masterdata-modal-btn" type="button">Lưu cập nhật</button>
          </div>
        </div>
      </div>
    `;

    const subtabs = container.querySelectorAll('#admin-subtabs .tab-btn');
    subtabs.forEach(btn => {
      btn.addEventListener('click', () => {
        subtabs.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tabKey = btn.dataset.tab;
        this.renderTabContent(tabKey, container.querySelector('#admin-tab-content'));
      });
    });

    this.renderTabContent('restaurants', container.querySelector('#admin-tab-content'));

    const restModal = container.querySelector('#restaurant-modal');
    container.querySelector('#close-rest-modal-btn').addEventListener('click', () => restModal.classList.remove('active'));
    container.querySelector('#cancel-rest-btn').addEventListener('click', () => restModal.classList.remove('active'));
    container.querySelector('#save-rest-btn').addEventListener('click', () => this.handleSaveRestaurant(container));
    const masterDataModal = container.querySelector('#masterdata-modal');
    container.querySelector('#close-masterdata-modal-btn').addEventListener('click', () => masterDataModal.classList.remove('active'));
    container.querySelector('#cancel-masterdata-modal-btn').addEventListener('click', () => masterDataModal.classList.remove('active'));
    container.querySelector('#save-masterdata-modal-btn').addEventListener('click', () => this.saveMasterDataEdit(container));
  }

  static async renderTabContent(tabKey, contentEl) {
    if (tabKey === 'checklist-materials') {
      await this.renderChecklistMaterials(contentEl);
      return;
    }
    if (tabKey === 'reports') {
      await ReportingDashboard.render(contentEl);
      return;
    }
    if (['roles', 'categories', 'departments', 'notifications', 'settings'].includes(tabKey)) {
      await this.renderAdminModule(tabKey, contentEl);
      return;
    }
    if (tabKey === 'shifts') {
      await this.renderShiftDirectory(contentEl);
      return;
    }
    if (tabKey === 'deadlines') tabKey = 'shifts';

    if (tabKey === 'restaurants') {
      contentEl.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <div style="display: flex; gap: 10px; align-items: center; justify-content: space-between; flex-wrap: wrap;">
            <div style="display: flex; gap: 8px; flex: 1; min-width: 280px;">
              <input type="text" id="rest-search-input" class="form-input" placeholder="🔍 Tìm theo mã hoặc tên nhà hàng...">
              <select id="rest-filter-status" class="form-select" style="width: 160px;">
                <option value="">Tất cả trạng thái</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
            <button class="btn btn-gold" id="open-add-rest-btn">➕ THÊM NHÀ HÀNG MỚI</button>
          </div>

          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>STT</th>
                  <th>Mã Nhà Hàng (Code)</th>
                  <th>Tên Nhà Hàng (Name)</th>
                  <th>Trạng Thái</th>
                  <th>Ngày Khởi Tạo</th>
                  <th>Thao Tác</th>
                </tr>
              </thead>
              <tbody id="restaurants-tbody">
                <tr><td colspan="6" style="text-align: center; padding: 20px;">Đang tải danh sách nhà hàng...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      `;

      this.loadRestaurantsTable(contentEl);

      contentEl.querySelector('#open-add-rest-btn').addEventListener('click', () => this.openAddModal());
      contentEl.querySelector('#rest-search-input').addEventListener('input', () => this.loadRestaurantsTable(contentEl));
      contentEl.querySelector('#rest-filter-status').addEventListener('change', () => this.loadRestaurantsTable(contentEl));

    } else if (tabKey === 'shifts') {
      // Phase 6 Shift Deadline Configuration Panel
      contentEl.innerHTML = `<p style="padding: 20px; text-align: center;">Đang tải cấu hình deadlines ca làm việc...</p>`;
      try {
        const data = await Api.get('/api/shifts');
        const shifts = data.shifts || [];

        contentEl.innerHTML = `
          <div style="display: flex; flex-direction: column; gap: 16px;">
            <div style="background: var(--color-warm-white); padding: 16px; border-radius: 12px; border: 1px solid var(--color-gold-muted);">
              <h3 style="color: var(--color-burgundy-primary); margin-bottom: 4px;">⏱️ PHASE 6: SHIFT DEADLINE ENGINE CONFIG</h3>
              <p class="subtext">Quản lý giờ chót (Deadline) kiểm tra nguyên vật liệu đầu ca. Dữ liệu được lưu trực tiếp trong Database (Timezone: Asia/Ho_Chi_Minh).</p>
            </div>

            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Mã Ca (Code)</th>
                    <th>Tên Ca Làm Việc</th>
                    <th>Yêu Cầu Bắt Buộc (Required)</th>
                    <th>Giờ Chót Deadline (HH:MM)</th>
                    <th>Nhắc Trước (phút)</th>
                    <th>Cập Nhật Deadline</th>
                  </tr>
                </thead>
                <tbody>
                  ${shifts.map(s => `
                    <tr>
                      <td><span class="badge badge-gold">${s.shift_code}</span></td>
                      <td><b>${s.shift_name}</b></td>
                      <td>${s.is_required ? '🔴 Required = TRUE' : '⚪ Optional = FALSE'}</td>
                      <td><b style="font-size: 1.1rem; color: var(--color-thai-red); font-family: monospace;">${s.deadline_time}</b></td>
                      <td><input type="number" class="form-input shift-reminder-input" data-code="${s.shift_code}" value="${s.reminder_minutes_before}" min="0" max="1440" style="width: 100px;"></td>
                      <td>
                        <div style="display: flex; gap: 6px; align-items: center;">
                          <input type="text" class="form-input shift-dl-input" data-code="${s.shift_code}" value="${s.deadline_time}" style="width: 90px; padding: 4px 8px; font-weight: 700; text-align: center;">
                          <button class="btn btn-primary btn-sm update-shift-btn" data-code="${s.shift_code}">💾 Lưu</button>
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;

        contentEl.querySelectorAll('.update-shift-btn').forEach(btn => {
          btn.addEventListener('click', async () => {
            const code = btn.dataset.code;
            const input = contentEl.querySelector(`.shift-dl-input[data-code="${code}"]`);
            const newTime = input.value.trim();
            const reminderInput = contentEl.querySelector(`.shift-reminder-input[data-code="${code}"]`);

            btn.disabled = true;
            btn.textContent = '...';

            try {
              const resData = await Api.put(`/api/shifts/${code}`, {
                deadline_time: newTime,
                reminder_minutes_before: Number(reminderInput.value)
              });
              alert(`✓ ${resData.message}`);
              this.renderTabContent('deadlines', contentEl);
            } catch (err) {
              alert(`Lỗi: ${err.message}`);
              btn.disabled = false;
              btn.textContent = '💾 Lưu';
            }
          });
        });

      } catch (e) {
        contentEl.innerHTML = `<p style="color: red;">Lỗi tải cấu hình shift: ${e.message}</p>`;
      }

    } else if (tabKey === 'materials') {
      contentEl.innerHTML = `<p style="padding: 20px; text-align: center;">Đang tải danh mục vật tư...</p>`;
      try {
        const data = await Api.get('/api/materials?include_inactive=true');
        const list = data.materials || [];
        contentEl.innerHTML = `
          <div class="admin-module-heading"><h2>Materials</h2><button class="btn btn-primary btn-sm" id="open-add-material-btn" type="button">Thêm Material</button></div>
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Mã Vật Tư</th>
                  <th>Bộ Phận (Dept)</th>
                  <th>Tên Nguyên Vật Liệu</th>
                  <th>Phân Loại</th>
                  <th>Bắt Buộc</th>
                  <th>Photo Required</th>
                  <th>Status</th>
                  <th>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                ${list.map(m => `
                  <tr>
                    <td><b>${m.material_code}</b></td>
                    <td><span class="badge ${m.department === 'FOH' ? 'badge-gold' : 'badge-completed'}">${m.department}</span></td>
                    <td>${m.material_name}</td>
                    <td>${m.category}</td>
                    <td>${m.is_mandatory ? '🔴 Yes' : '⚪ Optional'}</td>
                    <td>${m.photo_required ? '📷 Yes' : 'No'}</td>
                    <td><span class="badge ${m.is_active ? 'badge-completed' : 'badge-overdue'}">${m.is_active ? 'ACTIVE' : 'INACTIVE'}</span></td>
                    <td><div class="action-buttons"><button class="btn btn-secondary btn-sm edit-material-btn" data-id="${m.id}" type="button">Sửa</button><button class="btn ${m.is_active ? 'btn-danger' : 'btn-success'} btn-sm toggle-material-btn" data-id="${m.id}" data-active="${m.is_active ? 1 : 0}" type="button">${m.is_active ? 'Tắt' : 'Bật'}</button></div></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
        contentEl.querySelectorAll('.edit-material-btn').forEach(button => {
          button.addEventListener('click', () => this.openMaterialEditor(list.find(material => material.id === button.dataset.id), contentEl));
        });
        contentEl.querySelector('#open-add-material-btn').addEventListener('click', () => this.openMaterialEditor(null, contentEl));
        contentEl.querySelectorAll('.toggle-material-btn').forEach(button => {
          button.addEventListener('click', async () => {
            button.disabled = true;
            try {
              await Api.patch(`/api/materials/${encodeURIComponent(button.dataset.id)}/status`, { is_active: button.dataset.active !== '1' });
              this.renderTabContent('materials', contentEl);
            } catch (error) {
              alert(error.message);
              button.disabled = false;
            }
          });
        });
      } catch (e) {
        contentEl.innerHTML = `<p style="color: red;">Lỗi tải vật tư: ${e.message}</p>`;
      }
    } else if (tabKey === 'users') {
      contentEl.innerHTML = `<p style="padding: 20px; text-align: center;">Đang tải danh sách người dùng...</p>`;
      try {
        const data = await Api.get('/api/users');
        const list = data.users || [];
        contentEl.innerHTML = `
          <div class="admin-module-heading"><h2>Users</h2><button class="btn btn-primary btn-sm" id="open-add-user-btn" type="button">Thêm User</button></div>
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Họ Và Tên</th>
                  <th>Vai Trò (Role)</th>
                  <th>Restaurants</th>
                  <th>Trạng Thái</th>
                  <th>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                ${list.map(u => `
                  <tr>
                    <td><b>${u.username}</b></td>
                    <td>${u.full_name}</td>
                    <td><span class="badge badge-gold">${u.role_code}</span></td>
                    <td>${this.escapeHtml(u.role_code === 'RESTAURANT' ? (u.restaurant_name || '') : (u.assigned_restaurants || []).map(restaurant => restaurant.restaurant_code).join(', '))}</td>
                    <td>${u.is_active ? '✅ Active' : '❌ Inactive'}</td>
                    <td><button class="btn btn-secondary btn-sm edit-user-btn" data-id="${u.id}" type="button">Sửa</button></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
        contentEl.querySelectorAll('.edit-user-btn').forEach(button => {
          button.addEventListener('click', () => this.openUserEditor(list.find(user => user.id === button.dataset.id), contentEl));
        });
        contentEl.querySelector('#open-add-user-btn').addEventListener('click', () => this.openAddUserEditor(contentEl));
      } catch (e) {
        contentEl.innerHTML = `<p style="color: red;">Lỗi tải người dùng: ${e.message}</p>`;
      }
    } else if (tabKey === 'audit') {
      contentEl.innerHTML = `<p style="padding: 20px; text-align: center;">Đang tải nhật ký bảo mật...</p>`;
      try {
        const data = await Api.get('/api/audit-logs');
        const list = data.logs || [];
        contentEl.innerHTML = `
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Restaurant</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                ${list.map(log => `
                  <tr>
                    <td>${new Date(log.created_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</td>
                    <td><b>${this.escapeHtml(log.full_name || log.username || 'System')}</b></td>
                    <td><span class="badge badge-gold">${this.escapeHtml(log.action)}</span></td>
                    <td>${this.escapeHtml(log.restaurant_name ? `${log.restaurant_code} · ${log.restaurant_name}` : 'Toàn hệ thống')}</td>
                    <td><code class="audit-log-details">${this.escapeHtml(this.formatAuditDetails(log))}</code></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      } catch (e) {
        contentEl.innerHTML = `<p style="color: red;">Lỗi tải nhật ký: ${e.message}</p>`;
      }
    }
  }

  static async renderChecklistMaterials(contentEl) {
    contentEl.innerHTML = '<p class="admin-module-loading">Đang tải Checklist và Material...</p>';
    try {
      const [checklistData, materialData] = await Promise.all([
        Api.get('/api/checklists'),
        Api.get('/api/materials?include_inactive=true')
      ]);
      const checklists = checklistData.checklists || [];
      const materials = materialData.materials || [];
      if (!checklists.length) {
        contentEl.innerHTML = '<p class="admin-module-empty">Chưa có Checklist active để quản lý membership.</p>';
        return;
      }

      contentEl.innerHTML = `
        <section class="admin-module-section checklist-membership-manager">
          <div class="admin-module-heading"><div><h2>Checklist Materials</h2><p class="subtext">Gán Material rõ ràng vào Checklist; Material mới không tự thêm vào checklist khác.</p></div></div>
          <div class="checklist-membership-filters">
            <label>Checklist / Shift<select class="form-select" id="membership-checklist">${checklists.map(checklist => `<option value="${this.escapeHtml(checklist.id)}">${this.escapeHtml(checklist.title)} · ${this.escapeHtml(checklist.shift_type)}</option>`).join('')}</select></label>
            <label>Department<select class="form-select" id="membership-department"><option value="">FOH + BOH</option><option value="FOH">FOH</option><option value="BOH">BOH</option></select></label>
          </div>
          <div id="membership-error" class="admin-inline-error" hidden></div>
          <form id="membership-add-form" class="membership-add-form">
            <label>Material<select class="form-select" id="membership-material" required></select></label>
            <label>Requirement<input class="form-input" id="membership-requirement" type="text" placeholder="Requirement text"></label>
            <label>Mandatory<select class="form-select" id="membership-mandatory" required><option value="1">Yes</option><option value="0">No</option></select></label>
            <label>Order<input class="form-input" id="membership-order" type="number" min="1" value="1" required></label>
            <button class="btn btn-primary" type="submit">Add Material</button>
          </form>
          <div class="membership-order-toolbar"><span>Active and inactive memberships</span><button class="btn btn-secondary btn-sm" id="save-membership-order" type="button">Save Order</button></div>
          <div class="table-responsive"><table class="data-table">
            <thead><tr><th>Order</th><th>Material</th><th>Department</th><th>Material Status</th><th>Requirement</th><th>Mandatory</th><th>Membership</th><th>Actions</th></tr></thead>
            <tbody id="membership-rows"><tr><td colspan="8" class="admin-module-empty">Đang tải membership...</td></tr></tbody>
          </table></div>
        </section>`;

      const checklistSelect = contentEl.querySelector('#membership-checklist');
      const departmentSelect = contentEl.querySelector('#membership-department');
      const materialSelect = contentEl.querySelector('#membership-material');
      const membershipRows = contentEl.querySelector('#membership-rows');
      const errorBox = contentEl.querySelector('#membership-error');

      const showError = error => {
        errorBox.textContent = error.message || String(error);
        errorBox.hidden = false;
      };
      const fillMaterialOptions = () => {
        const department = departmentSelect.value;
        const assignedIds = new Set([...membershipRows.querySelectorAll('[data-membership-material]')].map(row => row.dataset.membershipMaterial));
        const available = materials.filter(material => material.is_active && (!department || material.department === department) && !assignedIds.has(material.id));
        materialSelect.innerHTML = available.map(material => `<option value="${this.escapeHtml(material.id)}">${this.escapeHtml(material.material_code)} · ${this.escapeHtml(material.material_name)} (${this.escapeHtml(material.department)})</option>`).join('');
        if (!available.length) materialSelect.innerHTML = '<option value="">Không có Material active phù hợp</option>';
      };
      const loadRows = async () => {
        errorBox.hidden = true;
        membershipRows.innerHTML = '<tr><td colspan="8" class="admin-module-empty">Đang tải membership...</td></tr>';
        try {
          const query = departmentSelect.value ? `?department=${encodeURIComponent(departmentSelect.value)}` : '';
          const data = await Api.get(`/api/checklists/${encodeURIComponent(checklistSelect.value)}/assignments${query}`);
          const assignments = data.assignments || [];
          if (!assignments.length) {
            membershipRows.innerHTML = '<tr><td colspan="8" class="admin-module-empty">Checklist chưa có Material trong bộ lọc này.</td></tr>';
          } else {
            membershipRows.innerHTML = assignments.map(item => `
              <tr data-membership-material="${this.escapeHtml(item.material_id)}">
                <td><input class="form-input membership-order" type="number" min="1" value="${this.escapeHtml(item.display_order)}" data-id="${this.escapeHtml(item.id)}" aria-label="Display order"></td>
                <td><b>${this.escapeHtml(item.material_name)}</b><small>${this.escapeHtml(item.material_code)}</small></td>
                <td>${this.escapeHtml(item.department)}</td>
                <td><span class="badge ${item.material_is_active ? 'badge-completed' : 'badge-overdue'}">${item.material_is_active ? 'ACTIVE' : 'INACTIVE'}</span></td>
                <td><input class="form-input membership-requirement" type="text" value="${this.escapeHtml(item.requirement_text || '')}" data-id="${this.escapeHtml(item.id)}"></td>
                <td><select class="form-select membership-mandatory" data-id="${this.escapeHtml(item.id)}"><option value="1" ${item.is_mandatory ? 'selected' : ''}>Yes</option><option value="0" ${!item.is_mandatory ? 'selected' : ''}>No</option></select></td>
                <td><span class="badge ${item.is_active ? 'badge-completed' : 'badge-overdue'}">${item.is_active ? 'ACTIVE' : 'INACTIVE'}</span></td>
                <td><div class="action-buttons"><button class="btn btn-secondary btn-sm save-membership-btn" data-id="${this.escapeHtml(item.id)}" type="button">Save</button><button class="btn ${item.is_active ? 'btn-danger' : 'btn-success'} btn-sm toggle-membership-btn" data-id="${this.escapeHtml(item.id)}" data-active="${item.is_active ? 1 : 0}" type="button">${item.is_active ? 'Remove' : 'Reactivate'}</button></div></td>
              </tr>`).join('');
          }
          fillMaterialOptions();
        } catch (error) {
          showError(error);
          membershipRows.innerHTML = '<tr><td colspan="8" class="admin-module-empty">Không tải được membership.</td></tr>';
        }
      };

      checklistSelect.addEventListener('change', loadRows);
      departmentSelect.addEventListener('change', () => {
        fillMaterialOptions();
        loadRows();
      });
      contentEl.querySelector('#membership-add-form').addEventListener('submit', async event => {
        event.preventDefault();
        if (!materialSelect.value) return;
        const nextOrder = Number(contentEl.querySelector('#membership-order').value);
        try {
          await Api.post(`/api/checklists/${encodeURIComponent(checklistSelect.value)}/items`, {
            material_id: materialSelect.value,
            display_order: nextOrder,
            requirement_text: contentEl.querySelector('#membership-requirement').value,
            is_mandatory: Number(contentEl.querySelector('#membership-mandatory').value)
          });
          contentEl.querySelector('#membership-requirement').value = '';
          contentEl.querySelector('#membership-order').value = String(nextOrder + 1);
          await loadRows();
        } catch (error) {
          showError(error);
        }
      });
      membershipRows.addEventListener('click', async event => {
        const saveButton = event.target.closest('.save-membership-btn');
        const toggleButton = event.target.closest('.toggle-membership-btn');
        try {
          if (saveButton) {
            const id = saveButton.dataset.id;
            const row = saveButton.closest('tr');
            await Api.put(`/api/checklist-items/${encodeURIComponent(id)}`, {
              requirement_text: row.querySelector('.membership-requirement').value,
              is_mandatory: Number(row.querySelector('.membership-mandatory').value)
            });
            await loadRows();
          }
          if (toggleButton) {
            await Api.patch(`/api/checklist-items/${encodeURIComponent(toggleButton.dataset.id)}/status`, {
              is_active: toggleButton.dataset.active !== '1'
            });
            await loadRows();
          }
        } catch (error) {
          showError(error);
        }
      });
      contentEl.querySelector('#save-membership-order').addEventListener('click', async () => {
        const items = [...membershipRows.querySelectorAll('.membership-order')].map(input => ({ id: input.dataset.id, display_order: Number(input.value) }));
        if (!items.length) return;
        try {
          await Api.put(`/api/checklists/${encodeURIComponent(checklistSelect.value)}/items/reorder`, { items });
          await loadRows();
        } catch (error) {
          showError(error);
        }
      });
      await loadRows();
    } catch (error) {
      contentEl.innerHTML = `<p class="admin-module-error">${this.escapeHtml(error.message)}</p>`;
    }
  }

  static async renderShiftDirectory(contentEl) {
    contentEl.innerHTML = '<p class="admin-module-loading">Đang tải danh sách ca...</p>';
    try {
      const data = await Api.get('/api/shifts');
      const shifts = data.shifts || [];
      contentEl.innerHTML = `
        <section class="admin-module-section">
          <h2>Shifts</h2>
          <div class="table-responsive"><table class="data-table">
            <thead><tr><th>Code</th><th>Name</th><th>Required</th><th>Deadline</th><th>Reminder Before</th></tr></thead>
            <tbody>${shifts.map(shift => `<tr><td>${this.escapeHtml(shift.shift_code)}</td><td>${this.escapeHtml(shift.shift_name)}</td><td>${shift.is_required ? 'Required' : 'Optional'}</td><td>${this.escapeHtml(shift.deadline_time)}</td><td>${this.escapeHtml(shift.reminder_minutes_before)} minutes</td></tr>`).join('')}</tbody>
          </table></div>
        </section>`;
      } catch (error) {
        contentEl.innerHTML = `<p class="admin-module-error">${this.escapeHtml(error.message)}</p>`;
      }
  }

  static async renderAdminModule(tabKey, contentEl) {
    contentEl.innerHTML = '<p class="admin-module-loading">Đang tải dữ liệu...</p>';
    try {
      if (tabKey === 'roles') {
        const data = await Api.get('/api/roles');
        contentEl.innerHTML = `
          <section class="admin-module-section"><h2>System Roles</h2><div class="table-responsive"><table class="data-table">
            <thead><tr><th>Code</th><th>Role</th><th>Description</th><th>Scope</th></tr></thead>
            <tbody>${(data.roles || []).map(role => `<tr><td><b>${this.escapeHtml(role.code)}</b></td><td>${this.escapeHtml(role.name)}</td><td>${this.escapeHtml(role.description)}</td><td>${role.code === 'ADMIN' ? 'Toàn hệ thống' : role.code === 'AC_LD' ? 'Các nhà hàng được gán' : 'Một nhà hàng được gán'}</td></tr>`).join('')}</tbody>
          </table></div></section>`;
        return;
      }

      if (tabKey === 'categories' || tabKey === 'departments') {
        const data = await Api.get('/api/materials?include_inactive=true');
        const materials = data.materials || [];
        if (tabKey === 'categories') {
          const categories = new Map();
          materials.forEach(material => categories.set(material.category, (categories.get(material.category) || 0) + 1));
          contentEl.innerHTML = `<section class="admin-module-section"><h2>Material Categories</h2><p class="subtext">Category values are edited through Materials to keep each material change auditable.</p><div class="table-responsive"><table class="data-table"><thead><tr><th>Category</th><th>Materials</th></tr></thead><tbody>${[...categories].sort(([left], [right]) => left.localeCompare(right)).map(([name, count]) => `<tr><td>${this.escapeHtml(name)}</td><td>${count}</td></tr>`).join('')}</tbody></table></div></section>`;
          return;
        }

        const departments = ['FOH', 'BOH'].map(code => {
          const list = materials.filter(material => material.department === code);
          return { code, count: list.length, active: list.filter(material => material.is_active).length, mandatory: list.filter(material => material.is_mandatory).length };
        });
        contentEl.innerHTML = `<section class="admin-module-section"><h2>Departments</h2><div class="admin-department-grid">${departments.map(department => `<article class="admin-department-item"><strong>${department.code}</strong><span>${department.active} / ${department.count} active materials</span><span>${department.mandatory} mandatory</span></article>`).join('')}</div><p class="subtext">FOH/BOH are controlled by the material department field and are edited in Materials.</p></section>`;
        return;
      }

      if (tabKey === 'notifications') {
        const data = await Api.get('/api/notifications?limit=100');
        contentEl.innerHTML = `
          <section class="admin-module-section"><div class="admin-module-heading"><h2>Notifications</h2><button class="btn btn-secondary btn-sm" id="admin-mark-notifications-read" type="button">Mark all read (${data.unread_count || 0})</button></div>
            <div class="admin-notification-list">${(data.notifications || []).length ? (data.notifications || []).map(notification => `<article class="admin-notification ${notification.status.toLowerCase()}"><div><strong>${this.escapeHtml(notification.title)}</strong><p>${this.escapeHtml(notification.message)}</p><time>${this.escapeHtml(new Date(notification.created_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }))}</time></div><span>${notification.status}</span></article>`).join('') : '<p class="admin-module-empty">Chưa có notifications.</p>'}</div>
          </section>`;
        contentEl.querySelector('#admin-mark-notifications-read').addEventListener('click', async event => {
          event.currentTarget.disabled = true;
          try {
            await Api.patch('/api/notifications/read-all', {});
            this.renderAdminModule('notifications', contentEl);
          } catch (error) {
            alert(error.message);
            event.currentTarget.disabled = false;
          }
        });
        return;
      }

      if (tabKey === 'settings') {
        const data = await Api.get('/api/settings');
        contentEl.innerHTML = `
          <section class="admin-module-section"><h2>System Settings</h2><div id="admin-settings-error" class="admin-inline-error" hidden></div>
            <form id="admin-settings-form" class="admin-settings-form">${(data.settings || []).map(setting => `<label class="form-group"><span class="form-label">${this.escapeHtml(setting.label)}</span>${setting.type === 'period'
              ? `<select class="form-select" data-setting-key="${this.escapeHtml(setting.key)}"><option value="DAILY" ${setting.value === 'DAILY' ? 'selected' : ''}>Daily</option><option value="WEEKLY" ${setting.value === 'WEEKLY' ? 'selected' : ''}>Weekly</option><option value="MONTHLY" ${setting.value === 'MONTHLY' ? 'selected' : ''}>Monthly</option></select>`
              : `<input class="form-input" type="number" min="${setting.key === 'REPORT_MAX_ROWS' ? 100 : 10}" max="${setting.key === 'REPORT_MAX_ROWS' ? 5000 : 300}" data-setting-key="${this.escapeHtml(setting.key)}" value="${this.escapeHtml(setting.value)}" required>`}</label>`).join('')}
              <button class="btn btn-primary" type="submit">Lưu Settings</button>
            </form>
          </section>`;
        contentEl.querySelector('#admin-settings-form').addEventListener('submit', async event => {
          event.preventDefault();
          const values = Object.fromEntries([...contentEl.querySelectorAll('[data-setting-key]')].map(input => [input.dataset.settingKey, input.value]));
          try {
            const result = await Api.put('/api/settings', values);
            alert(result.message);
          } catch (error) {
            const errorBox = contentEl.querySelector('#admin-settings-error');
            errorBox.textContent = error.message;
            errorBox.hidden = false;
          }
        });
      }
    } catch (error) {
      contentEl.innerHTML = `<p class="admin-module-error">${this.escapeHtml(error.message)}</p>`;
    }
  }

  static openMaterialEditor(material, contentEl) {
    this.masterDataContext = { type: 'material', record: material || null, contentEl, isNew: !material };
    const modal = document.querySelector('#masterdata-modal');
    document.querySelector('#masterdata-modal-title').textContent = material ? `Cập nhật vật tư: ${material.material_name}` : 'Thêm vật tư';
    document.querySelector('#masterdata-modal-error').hidden = true;
    document.querySelector('#masterdata-modal-fields').innerHTML = `
      <label class="form-group"><span class="form-label">Mã vật tư</span><input class="form-input" id="master-material-code" value="${this.escapeHtml(material?.material_code || '')}" required></label>
      <label class="form-group"><span class="form-label">Tên vật tư</span><input class="form-input" id="master-material-name" value="${this.escapeHtml(material?.material_name || '')}" required></label>
      <label class="form-group"><span class="form-label">Bộ phận</span><select class="form-select" id="master-material-department"><option value="FOH" ${material?.department === 'FOH' ? 'selected' : ''}>FOH</option><option value="BOH" ${!material || material.department === 'BOH' ? 'selected' : ''}>BOH</option></select></label>
      <label class="form-group"><span class="form-label">Phân loại</span><input class="form-input" id="master-material-category" value="${this.escapeHtml(material?.category || '')}" required></label>
      <label class="form-group"><span class="form-label">Đơn vị</span><input class="form-input" id="master-material-unit" value="${this.escapeHtml(material?.unit || '')}" required></label>
      <label class="form-group"><span class="form-label">Bắt buộc</span><select class="form-select" id="master-material-mandatory"><option value="1" ${!material || material.is_mandatory ? 'selected' : ''}>Có</option><option value="0" ${material && !material.is_mandatory ? 'selected' : ''}>Không</option></select></label>
      <label class="form-group"><span class="form-label">Yêu cầu ảnh</span><select class="form-select" id="master-material-photo"><option value="1" ${material?.photo_required ? 'selected' : ''}>Có</option><option value="0" ${!material?.photo_required ? 'selected' : ''}>Không</option></select></label>
    `;
    modal.classList.add('active');
  }

  static async openUserEditor(user, contentEl) {
    return this.openUserEditorForm(user, contentEl, false);
  }

  static async openAddUserEditor(contentEl) {
    return this.openUserEditorForm(null, contentEl, true);
  }

  static async openUserEditorForm(user, contentEl, isNew) {
    this.masterDataContext = { type: 'user', record: user || null, contentEl, isNew };
    const modal = document.querySelector('#masterdata-modal');
    const fields = document.querySelector('#masterdata-modal-fields');
    document.querySelector('#masterdata-modal-title').textContent = isNew ? 'Tạo User' : `Cập nhật tài khoản: ${user.username}`;
    document.querySelector('#masterdata-modal-error').hidden = true;
    fields.innerHTML = '<p>Đang tải vai trò và danh sách nhà hàng...</p>';
    modal.classList.add('active');

    try {
      const [roleData, restaurantData] = await Promise.all([Api.get('/api/roles'), Api.get('/api/restaurants')]);
      fields.innerHTML = `
        ${isNew ? '<label class="form-group"><span class="form-label">Username</span><input class="form-input" id="master-user-username" required minlength="3"></label>' : ''}
        <label class="form-group"><span class="form-label">Họ và tên</span><input class="form-input" id="master-user-full-name" value="${this.escapeHtml(user?.full_name || '')}" required></label>
        ${isNew ? '<label class="form-group"><span class="form-label">Mật khẩu (ít nhất 8 ký tự)</span><input class="form-input" id="master-user-password" type="password" required minlength="8" autocomplete="new-password"></label>' : '<label class="form-group"><span class="form-label">Mật khẩu mới (bỏ trống nếu không đổi)</span><input class="form-input" id="master-user-password" type="password" minlength="8" autocomplete="new-password"></label>'}
        <label class="form-group"><span class="form-label">Vai trò</span><select class="form-select" id="master-user-role">${(roleData.roles || []).map(role => `<option value="${this.escapeHtml(role.code)}" ${(user?.role_code || 'RESTAURANT') === role.code ? 'selected' : ''}>${this.escapeHtml(role.name)} (${this.escapeHtml(role.code)})</option>`).join('')}</select></label>
        <label class="form-group"><span class="form-label">Nhà hàng gán (chọn nhiều cho AC/L&amp;D)</span><select class="form-select" id="master-user-restaurant" size="5">${(restaurantData.restaurants || []).map(restaurant => {
          const selectedIds = user?.role_code === 'RESTAURANT' ? [user.restaurant_id] : (user?.assigned_restaurant_ids || []);
          return `<option value="${this.escapeHtml(restaurant.id)}" ${selectedIds.includes(restaurant.id) ? 'selected' : ''}>${this.escapeHtml(restaurant.restaurant_code)} · ${this.escapeHtml(restaurant.restaurant_name)}</option>`;
        }).join('')}</select></label>
        ${isNew ? '' : `<label class="form-group"><span class="form-label">Trạng thái</span><select class="form-select" id="master-user-active"><option value="1" ${user.is_active ? 'selected' : ''}>Active</option><option value="0" ${!user.is_active ? 'selected' : ''}>Inactive</option></select></label>`}
      `;
      const roleSelect = fields.querySelector('#master-user-role');
      const restaurantSelect = fields.querySelector('#master-user-restaurant');
      const syncRestaurant = () => {
        restaurantSelect.multiple = roleSelect.value === 'AC_LD';
        restaurantSelect.disabled = roleSelect.value === 'ADMIN';
        if (roleSelect.value === 'ADMIN') [...restaurantSelect.options].forEach(option => { option.selected = false; });
        if (roleSelect.value === 'RESTAURANT' && restaurantSelect.selectedOptions.length > 1) {
          const firstSelected = restaurantSelect.selectedOptions[0].value;
          [...restaurantSelect.options].forEach(option => { option.selected = option.value === firstSelected; });
        }
      };
      roleSelect.addEventListener('change', syncRestaurant);
      syncRestaurant();
    } catch (error) {
      this.showMasterDataError(error.message);
    }
  }

  static async saveMasterDataEdit(container) {
    const context = this.masterDataContext;
    if (!context) return;
    const saveButton = container.querySelector('#save-masterdata-modal-btn');
    saveButton.disabled = true;

    try {
      let endpoint;
      let payload;
      if (context.type === 'material') {
        endpoint = context.isNew ? '/api/materials' : `/api/materials/${encodeURIComponent(context.record.id)}`;
        payload = {
          material_code: container.querySelector('#master-material-code').value,
          material_name: container.querySelector('#master-material-name').value,
          department: container.querySelector('#master-material-department').value,
          category: container.querySelector('#master-material-category').value,
          unit: container.querySelector('#master-material-unit').value,
          is_mandatory: Number(container.querySelector('#master-material-mandatory').value),
          photo_required: Number(container.querySelector('#master-material-photo').value)
        };
      } else {
        const roleCode = container.querySelector('#master-user-role').value;
        const selectedRestaurantIds = [...container.querySelector('#master-user-restaurant').selectedOptions].map(option => option.value);
        endpoint = context.isNew ? '/api/users' : `/api/users/${encodeURIComponent(context.record.id)}`;
        payload = {
          ...(context.isNew ? { username: container.querySelector('#master-user-username').value } : {}),
          full_name: container.querySelector('#master-user-full-name').value,
          role_code: roleCode,
          restaurant_id: roleCode === 'RESTAURANT' ? (selectedRestaurantIds[0] || '') : '',
          assigned_restaurant_ids: roleCode === 'AC_LD' ? selectedRestaurantIds : [],
          ...(context.isNew ? { password: container.querySelector('#master-user-password').value } : {}),
          ...(!context.isNew ? { password: container.querySelector('#master-user-password').value || undefined, is_active: Number(container.querySelector('#master-user-active').value) } : {})
        };
      }

      if (context.isNew) await Api.post(endpoint, payload);
      else await Api.put(endpoint, payload);
      container.querySelector('#masterdata-modal').classList.remove('active');
      this.masterDataContext = null;
      await this.renderTabContent(context.type === 'material' ? 'materials' : 'users', context.contentEl);
    } catch (error) {
      this.showMasterDataError(error.message);
    } finally {
      saveButton.disabled = false;
    }
  }

  static showMasterDataError(message) {
    const error = document.querySelector('#masterdata-modal-error');
    error.textContent = message;
    error.hidden = false;
  }

  static formatAuditDetails(log) {
    const parse = value => {
      if (!value) return null;
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    };
    return JSON.stringify({ before: parse(log.old_values), after: parse(log.new_values) });
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

  static async loadRestaurantsTable(contentEl) {
    const tbody = contentEl.querySelector('#restaurants-tbody');
    if (!tbody) return;

    const search = contentEl.querySelector('#rest-search-input')?.value || '';
    const status = contentEl.querySelector('#rest-filter-status')?.value || '';

    try {
      const data = await Api.get(`/api/restaurants?search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}`);
      const list = data.restaurants || [];

      if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--color-text-muted);">Không tìm thấy nhà hàng phù hợp</td></tr>`;
        return;
      }

      tbody.innerHTML = list.map((r, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td><b style="color: var(--color-burgundy-primary);">${r.restaurant_code}</b></td>
          <td><b>${r.restaurant_name}</b></td>
          <td>
            <span class="badge ${r.status === 'ACTIVE' ? 'badge-completed' : 'badge-overdue'}">
              ${r.status === 'ACTIVE' ? '✓ ACTIVE' : '🔴 INACTIVE'}
            </span>
          </td>
          <td>${new Date(r.created_at).toLocaleDateString('vi-VN')}</td>
          <td>
            <div class="action-buttons">
              <button class="btn btn-secondary btn-sm" onclick="window.editRestaurant('${r.id}')">✏️ Sửa</button>
              <button class="btn ${r.status === 'ACTIVE' ? 'btn-danger' : 'btn-success'} btn-sm" onclick="window.toggleRestaurantStatus('${r.id}', '${r.status}')">
                ${r.status === 'ACTIVE' ? '⏹️ Tắt' : '▶️ Bật'}
              </button>
            </div>
          </td>
        </tr>
      `).join('');

      window.editRestaurant = (id) => this.openEditModal(id, list);
      window.toggleRestaurantStatus = (id, currentStatus) => this.toggleStatus(id, currentStatus, contentEl);

    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="6" style="color: red; text-align: center;">Lỗi tải danh sách nhà hàng: ${e.message}</td></tr>`;
    }
  }

  static openAddModal() {
    const modal = document.querySelector('#restaurant-modal');
    document.querySelector('#rest-modal-title').textContent = 'THÊM NHÀ HÀNG MỚI';
    document.querySelector('#rest-modal-error').style.display = 'none';
    document.querySelector('#rest-id-input').value = '';
    document.querySelector('#rest-code-input').value = '';
    document.querySelector('#rest-name-input').value = '';
    document.querySelector('#rest-status-select').value = 'ACTIVE';
    modal.classList.add('active');
  }

  static openEditModal(id, list) {
    const restaurant = list.find(r => r.id === id);
    if (!restaurant) return;

    const modal = document.querySelector('#restaurant-modal');
    document.querySelector('#rest-modal-title').textContent = `CHỈNH SỬA: ${restaurant.restaurant_name}`;
    document.querySelector('#rest-modal-error').style.display = 'none';
    document.querySelector('#rest-id-input').value = restaurant.id;
    document.querySelector('#rest-code-input').value = restaurant.restaurant_code;
    document.querySelector('#rest-name-input').value = restaurant.restaurant_name;
    document.querySelector('#rest-status-select').value = restaurant.status;
    modal.classList.add('active');
  }

  static async handleSaveRestaurant(container) {
    const modal = document.querySelector('#restaurant-modal');
    const errorBox = document.querySelector('#rest-modal-error');
    errorBox.style.display = 'none';

    const id = document.querySelector('#rest-id-input').value;
    const restaurant_code = document.querySelector('#rest-code-input').value.trim();
    const restaurant_name = document.querySelector('#rest-name-input').value.trim();
    const status = document.querySelector('#rest-status-select').value;

    if (!restaurant_code || !restaurant_name) {
      errorBox.textContent = 'Mã nhà hàng và tên nhà hàng không được để trống!';
      errorBox.style.display = 'block';
      return;
    }

    try {
      if (id) {
        await Api.put(`/api/restaurants/${id}`, { restaurant_code, restaurant_name, status });
      } else {
        await Api.post('/api/restaurants', { restaurant_code, restaurant_name, status });
      }

      modal.classList.remove('active');
      this.renderTabContent('restaurants', container.querySelector('#admin-tab-content'));
    } catch (err) {
      errorBox.textContent = `❌ Lỗi: ${err.message}`;
      errorBox.style.display = 'block';
    }
  }

  static async toggleStatus(id, currentStatus, contentEl) {
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await Api.patch(`/api/restaurants/${id}/status`, { status: newStatus });
      this.loadRestaurantsTable(contentEl);
    } catch (err) {
      alert(`Không thể thay đổi trạng thái: ${err.message}`);
    }
  }
}
