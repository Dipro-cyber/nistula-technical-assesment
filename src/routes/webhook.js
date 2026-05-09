const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { classifyMessage } = require('../services/classifier');
const { getDraftedReply } = require('../services/claudeService');

const router = express.Router();

// Valid sources the platform accepts
const VALID_SOURCES = ['whatsapp', 'booking_com', 'airbnb', 'instagram', 'direct'];

/**
 * POST /webhook/message
 * Accepts a raw guest message from any hospitality channel,
 * normalizes it, classifies the query type, gets a Claude-drafted reply,
 * and returns a structured JSON response.
 */
router.post('/message', async (req, res) => {
  const { source, guest_name, message, timestamp, booking_ref, property_id } = req.body;

  // --- Basic validation ---
  if (!source || !guest_name || !message || !timestamp || !property_id) {
    return res.status(400).json({
      error: 'Missing required fields: source, guest_name, message, timestamp, property_id'
    });
  }

  if (!VALID_SOURCES.includes(source)) {
    return res.status(400).json({
      error: `Invalid source "${source}". Must be one of: ${VALID_SOURCES.join(', ')}`
    });
  }

  // --- Normalize into unified schema ---
  const normalizedMessage = {
    message_id: uuidv4(),
    source,
    guest_name,
    message_text: message,
    timestamp,
    booking_ref: booking_ref || null,
    property_id,
    query_type: classifyMessage(message)
  };

  // --- Get drafted reply from Claude ---
  try {
    const drafted_reply = await getDraftedReply(normalizedMessage);
    return res.status(200).json({
      ...normalizedMessage,
      drafted_reply
    });
  } catch (err) {
    return res.status(502).json({
      error: 'Failed to get reply from Claude API',
      detail: err.message
    });
  }
});

module.exports = router;
