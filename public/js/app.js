import { Api } from './api.js';
import { Store } from './store.js';
import { LoginView } from './views/LoginView.js';
import { RestaurantPortal } from './views/RestaurantPortal.js';
import { ACControlCenter } from './views/ACControlCenter.js';
import { AdminPanel } from './views/AdminPanel.js';
import { ReportingDashboard } from './views/ReportingDashboard.js';

class App {
  static async init() {
    console.log('Initializing CHANG MATERIAL CONTROL Application...');

    // Attempt token restore
    if (Store.token) {
      try {
        const data = await Api.get('/api/auth/me');
        Store.setUser(data.user, Store.token);
      } catch (err) {
        console.warn('Session expired, clearing store');
        Store.clearUser();
      }
    }

    this.renderHeader();
    this.renderCurrentView();
  }

  static renderHeader() {
    const navbar = document.querySelector('#app-navbar');
    if (!Store.user) {
      navbar.style.display = 'none';
      return;
    }

    navbar.style.display = 'flex';
    const user = Store.user;

    navbar.innerHTML = `
      <div class="brand-title">
        <span>CHANG</span>
        <span class="brand-badge">MATERIAL CONTROL</span>
      </div>

      <div class="user-nav">
        <div class="user-chip">
          <span class="user-name">${user.full_name}</span>
          <span class="user-role">${user.role_name} ${user.restaurant_name ? `• ${user.restaurant_code}` : ''}</span>
        </div>
        <button class="btn btn-secondary btn-sm" id="logout-btn">Đăng Xuất</button>
      </div>
    `;

    navbar.querySelector('#logout-btn').addEventListener('click', async () => {
      try {
        await Api.post('/api/auth/logout');
      } catch (e) {}
      Store.clearUser();
      this.renderHeader();
      this.renderCurrentView();
    });
  }

  static renderCurrentView() {
    ACControlCenter.dispose();
    ReportingDashboard.dispose();
    const container = document.querySelector('#app-view-container');
    container.innerHTML = '';

    if (!Store.user) {
      LoginView.render(container, (user) => {
        this.renderHeader();
        this.renderCurrentView();
      });
      return;
    }

    // Role-based portal router
    const role = Store.user.role_code;

    if (role === 'RESTAURANT') {
      RestaurantPortal.render(container);
    } else if (role === 'AC_LD') {
      this.renderPortalWithNavigation(container, [
        { key: 'ac', label: '📊 Control Center', renderFn: (target) => ACControlCenter.render(target) },
        { key: 'reports', label: '📈 Reporting Dashboard', renderFn: (target) => ReportingDashboard.render(target) },
        { key: 'restaurant', label: '📱 Demo View Nhà Hàng', renderFn: (target) => RestaurantPortal.render(target) }
      ]);
    } else if (role === 'ADMIN') {
      this.renderPortalWithNavigation(container, [
        { key: 'admin', label: '⚙️ Admin Panel (15 Outlets)', renderFn: (target) => AdminPanel.render(target) },
        { key: 'ac', label: '📊 AC/L&D Control Center', renderFn: (target) => ACControlCenter.render(target) },
        { key: 'reports', label: '📈 Reporting Dashboard', renderFn: (target) => ReportingDashboard.render(target) },
        { key: 'restaurant', label: '📱 Demo View Nhà Hàng', renderFn: (target) => RestaurantPortal.render(target) }
      ]);
    }
  }

  static renderPortalWithNavigation(container, portals) {
    const navWrapper = document.createElement('div');
    navWrapper.className = 'view-tabs';
    navWrapper.style.marginTop = '10px';

    portals.forEach((p, idx) => {
      const btn = document.createElement('button');
      btn.className = `tab-btn ${idx === 0 ? 'active' : ''}`;
      btn.textContent = p.label;
      btn.addEventListener('click', () => {
        navWrapper.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const viewContent = container.querySelector('#portal-content-body');
        viewContent.innerHTML = '';
        ACControlCenter.dispose();
        ReportingDashboard.dispose();
        p.renderFn(viewContent);
      });
      navWrapper.appendChild(btn);
    });

    const bodyContainer = document.createElement('div');
    bodyContainer.id = 'portal-content-body';

    container.appendChild(navWrapper);
    container.appendChild(bodyContainer);

    // Initial render
    portals[0].renderFn(bodyContainer);
  }
}

document.addEventListener('DOMContentLoaded', () => App.init());
