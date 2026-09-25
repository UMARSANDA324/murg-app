const app = require('./src/app');

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`[MURG Backend API] Server listening on http://localhost:${PORT}`);
  console.log(`[MURG Backend API] Environment: ${process.env.NODE_ENV || 'development'}`);
});
