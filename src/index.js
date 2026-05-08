// Load environment variables from .env before anything else
require('dotenv').config();

const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// Parse incoming JSON request bodies
app.use(express.json());

// Health check — confirms the server is running
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'nistula-technical-assessment' });
});

// Placeholder for webhook routes — wired up in Commit 2
// app.use('/webhook', require('./routes/webhook'));

// Start the server
app.listen(PORT, () => {
  console.log(`Nistula backend running on port ${PORT}`);
});

module.exports = app;
