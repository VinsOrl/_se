'use strict';

const { createApp } = require('./app');

const PORT = Number(process.env.PORT) || 3000;

if (require.main === module) {
  createApp().listen(PORT, () => {
    console.log(`Todo app listening on http://localhost:${PORT}`);
  });
}
