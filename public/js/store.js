export const Store = {
  user: null,
  token: localStorage.getItem('chang_token') || null,
  activeView: 'LOGIN', // LOGIN, RESTAURANT_PORTAL, AC_CONTROL_CENTER, ADMIN_PANEL

  setUser(user, token) {
    this.user = user;
    this.token = token;
    if (token) {
      localStorage.setItem('chang_token', token);
    } else {
      localStorage.removeItem('chang_token');
    }
  },

  clearUser() {
    this.user = null;
    this.token = null;
    localStorage.removeItem('chang_token');
    this.activeView = 'LOGIN';
  }
};
