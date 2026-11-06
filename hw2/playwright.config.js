const { defineConfig } = require('@playwright/test');
const db = '/tmp/nqu-e2e.db';
module.exports = defineConfig({
  testDir: 'tests/e2e',
  workers: 1,
  use: { baseURL: 'http://localhost:3101', locale: 'en-US' },
  webServer: {
    command: `rm -f ${db} && node server.js`,
    url: 'http://localhost:3101',
    env: { PORT: '3101', DB_FILE: db, JWT_SECRET: 'e2e-secret' },
    reuseExistingServer: false,
  },
});
