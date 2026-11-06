require('dotenv').config();
const createApp = require('./src/app');
const port = process.env.PORT || 3000;
createApp(process.env.DB_FILE || 'data.db').listen(port, () => console.log(`http://localhost:${port}`));
