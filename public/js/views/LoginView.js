import { Api } from '../api.js';
import { Store } from '../store.js';

export class LoginView {
  static renderPasswordChange(container, user, onPasswordChanged) {
    container.innerHTML = `
      <div class="login-wrapper">
        <div class="login-card">
          <div class="login-header">
            <img class="login-logo-image" src="/chang-logo.png" alt="CHANG Modern Thai Cuisine">
            <h2>ĐỔI MẬT KHẨU</h2>
            <p class="subtext">Tài khoản ${user.username} cần đặt mật khẩu mới trước khi sử dụng ứng dụng.</p>
          </div>
          <div id="password-change-error" style="display:none; background:#FEE2E2; color:#DC2626; padding:10px 14px; border-radius:8px; font-size:.875rem; margin-bottom:16px; border:1px solid rgba(220,38,38,.2);"></div>
          <form id="password-change-form">
            <div class="form-group">
              <label class="form-label" for="new-password">Mật khẩu mới (ít nhất 12 ký tự)</label>
              <input type="password" id="new-password" class="form-input" required minlength="12" autocomplete="new-password" autofocus>
            </div>
            <div class="form-group">
              <label class="form-label" for="confirm-password">Nhập lại mật khẩu mới</label>
              <input type="password" id="confirm-password" class="form-input" required minlength="12" autocomplete="new-password">
            </div>
            <button type="submit" class="btn btn-primary btn-block" style="margin-top:8px; padding:14px;">LƯU MẬT KHẨU MỚI</button>
          </form>
        </div>
      </div>
    `;

    const form = container.querySelector('#password-change-form');
    const errorBox = container.querySelector('#password-change-error');
    form.addEventListener('submit', async event => {
      event.preventDefault();
      errorBox.style.display = 'none';
      const password = container.querySelector('#new-password').value;
      const confirmPassword = container.querySelector('#confirm-password').value;
      try {
        const data = await Api.post('/api/auth/change-password', { password, confirmPassword });
        Store.setUser(data.user, Store.token);
        onPasswordChanged(data.user);
      } catch (error) {
        errorBox.textContent = error.message || 'Không thể đổi mật khẩu';
        errorBox.style.display = 'block';
      }
    });
  }

  static render(container, onLoginSuccess) {
    container.innerHTML = `
      <div class="login-wrapper">
        <div class="login-card">
          <div class="login-header">
            <img class="login-logo-image" src="/chang-logo.png" alt="CHANG Modern Thai Cuisine">
            <h2>CHANG MATERIAL CONTROL</h2>
            <p class="subtext">Hệ Thống Kiểm Soát Nguyên Vật Liệu Đầu Ca</p>
          </div>

          <div id="login-error" style="display: none; background: #FEE2E2; color: #DC2626; padding: 10px 14px; border-radius: 8px; font-size: 0.875rem; margin-bottom: 16px; border: 1px solid rgba(220,38,38,0.2);"></div>

          <form id="login-form">
            <div class="form-group">
              <label class="form-label" for="username">Tên đăng nhập / Mã nhân viên</label>
              <input type="text" id="username" class="form-input" placeholder="Nhập tên đăng nhập" required autofocus>
            </div>

            <div class="form-group">
              <label class="form-label" for="password">Mật khẩu</label>
              <input type="password" id="password" class="form-input" placeholder="Nhập mật khẩu" required>
            </div>

            <button type="submit" class="btn btn-primary btn-block" style="margin-top: 8px; padding: 14px;">
              ĐĂNG NHẬP HỆ THỐNG
            </button>
          </form>

        </div>
      </div>
    `;

    const form = container.querySelector('#login-form');
    const errorBox = container.querySelector('#login-error');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorBox.style.display = 'none';

      const username = container.querySelector('#username').value.trim();
      const password = container.querySelector('#password').value;

      try {
        const data = await Api.post('/api/auth/login', { username, password });
        Store.setUser(data.user, data.token);
        onLoginSuccess(data.user);
      } catch (err) {
        errorBox.textContent = err.message || 'Đăng nhập thất bại';
        errorBox.style.display = 'block';
      }
    });

  }
}
