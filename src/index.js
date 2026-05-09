// Load environment variables from .env before anything else
require('dotenv').config();

const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// Parse incoming JSON request bodies
app.use(express.json());

// Handle malformed JSON bodies gracefully
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }
  next(err);
});

// Health check — confirms the server is running
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'nistula-technical-assessment' });
});

// Webhook routes
app.use('/webhook', require('./routes/webhook'));

// 404 handler — unknown routes
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// Global error handler — catches anything unhandled
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Nistula backend running on port ${PORT}`);
});

module.exports = app;
