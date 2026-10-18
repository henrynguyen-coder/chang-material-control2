import { executeSql, queryAll, withTransaction } from '../database/db.js';

const defaults = [
  { key: 'REPORT_DEFAULT_PERIOD', value: 'DAILY', label: 'Kỳ báo cáo mặc định', type: 'period' },
  { key: 'REPORT_MAX_ROWS', value: '5000', label: 'Số dòng báo cáo tối đa', type: 'number' },
  { key: 'NOTIFICATION_REFRESH_SECONDS', value: '30', label: 'Chu kỳ làm mới notification (giây)', type: 'number' }
];

export class SettingsModel {
  static async getAll() {
    for (const setting of defaults) {
      await executeSql(
        'INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON CONFLICT (setting_key) DO NOTHING',
        [setting.key, setting.value]
      );
    }
    const rows = await queryAll('SELECT setting_key, setting_value, updated_at FROM system_settings');
    const values = new Map(rows
      .map(setting => [setting.setting_key, setting]));
    return defaults.map(setting => ({ ...setting, value: values.get(setting.key)?.setting_value || setting.value, updated_at: values.get(setting.key)?.updated_at || null }));
  }

  static async getMap() {
    return Object.fromEntries((await this.getAll()).map(setting => [setting.key, setting.value]));
  }

  static async update(values, userId) {
    if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Error('Settings phải là một object');
    const allowed = new Set(defaults.map(setting => setting.key));
    const keys = Object.keys(values);
    if (!keys.length || keys.some(key => !allowed.has(key))) throw new Error('Setting key không được hỗ trợ');

    const normalized = {};
    keys.forEach(key => {
      const value = String(values[key] ?? '').trim();
      if (key === 'REPORT_DEFAULT_PERIOD' && !['DAILY', 'WEEKLY', 'MONTHLY'].includes(value)) {
        throw new Error('Kỳ báo cáo phải là DAILY, WEEKLY hoặc MONTHLY');
      }
      if (key === 'REPORT_MAX_ROWS' && (!/^\d+$/.test(value) || Number(value) < 100 || Number(value) > 5000)) {
        throw new Error('Số dòng báo cáo phải từ 100 đến 5000');
      }
      if (key === 'NOTIFICATION_REFRESH_SECONDS' && (!/^\d+$/.test(value) || Number(value) < 10 || Number(value) > 300)) {
        throw new Error('Chu kỳ notification phải từ 10 đến 300 giây');
      }
      normalized[key] = value;
    });

    await withTransaction(async tx => {
      for (const [key, value] of Object.entries(normalized)) {
        await tx.executeSql(
          `INSERT INTO system_settings (setting_key, setting_value, updated_by, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_by = EXCLUDED.updated_by, updated_at = EXCLUDED.updated_at`,
          [key, value, userId, new Date().toISOString()]
        );
      }
    });
    return this.getAll();
  }
}
