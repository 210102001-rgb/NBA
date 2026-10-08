'use strict';
const { createApp } = require('./app');

const PORT = Number(process.env.PORT || 3003);
const { app } = createApp();

app.listen(PORT, () => {
  console.log(`nba-backend jalan di http://localhost:${PORT}`);
});
