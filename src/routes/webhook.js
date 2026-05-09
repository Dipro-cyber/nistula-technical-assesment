const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { classifyMessage } = require('../services/classifier');

const router = express.Router();

// Valid sources the platform accepts
const VALID_SOURCES = ['whatsapp', 'booking_com', 'airbnb', 'instagram', 'direct'];

/**
 * POST /webhook/message
 * Accepts a raw guest message from any hospitality channel,
 * normalizes it into a unified schema, and returns it with a UUID.
 */
router.post('/message', (req, res) => {
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

  return res.status(200).json(normalizedMessage);
});

module.exports = router;
