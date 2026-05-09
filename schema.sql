-- =============================================================
-- Nistula Unified Messaging Platform — PostgreSQL Schema
-- =============================================================
-- Design decisions:
-- 1. guests table is channel-agnostic — one row per real person,
--    identified by phone or email. channel_guest_id stores the
--    external ID from each platform (e.g. WhatsApp number, Airbnb user ID).
-- 2. messages table stores every inbound and outbound message in one
--    place regardless of source. This makes reporting and search simple.
-- 3. conversations groups messages into threads per guest per property.
--    A conversation can span multiple channels (guest starts on WhatsApp,
--    follows up on Booking.com — same conversation).
-- 4. reservations is kept separate from conversations because a guest
--    may have many conversations before and after a booking.
-- 5. ai_logs captures every AI decision — confidence score, query type,
--    action taken, and whether a human edited the reply before sending.
--    This is the audit trail for the AI system.
--
-- Hardest design decision:
-- Whether to link messages directly to reservations or via conversations.
-- I chose to go via conversations because not every message has a booking
-- reference (pre-sales enquiries, Instagram DMs). Conversations act as the
-- bridge — they can optionally link to a reservation once one exists.
-- This avoids nullable foreign keys on the messages table and keeps the
-- schema clean for both pre-sales and post-sales flows.
-- =============================================================


-- -------------------------------------------------------------
-- guests
-- One record per real guest, regardless of how many channels
-- they use to contact Nistula.
-- -------------------------------------------------------------
CREATE TABLE guests (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name           VARCHAR(255) NOT NULL,
    email               VARCHAR(255),                        -- may be unknown for WhatsApp-only guests
    phone               VARCHAR(50),                         -- international format e.g. +919876543210
    channel_guest_id    VARCHAR(255),                        -- external ID from source platform
    source_channel      VARCHAR(50),                         -- whatsapp | booking_com | airbnb | instagram | direct
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT guests_source_channel_check
        CHECK (source_channel IN ('whatsapp', 'booking_com', 'airbnb', 'instagram', 'direct'))
);

CREATE INDEX idx_guests_email   ON guests (email);
CREATE INDEX idx_guests_phone   ON guests (phone);


-- -------------------------------------------------------------
-- reservations
-- Booking data linked to a guest. A guest can have many reservations.
-- -------------------------------------------------------------
CREATE TABLE reservations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_id            UUID NOT NULL REFERENCES guests (id) ON DELETE RESTRICT,
    booking_ref         VARCHAR(100) UNIQUE NOT NULL,        -- e.g. NIS-2024-0891
    property_id         VARCHAR(100) NOT NULL,               -- e.g. villa-b1
    check_in_date       DATE NOT NULL,
    check_out_date      DATE NOT NULL,
    num_guests          SMALLINT NOT NULL DEFAULT 1,
    total_amount_inr    NUMERIC(12, 2),
    status              VARCHAR(50) NOT NULL DEFAULT 'confirmed',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT reservations_status_check
        CHECK (status IN ('enquiry', 'confirmed', 'checked_in', 'checked_out', 'cancelled')),
    CONSTRAINT reservations_dates_check
        CHECK (check_out_date > check_in_date)
);

CREATE INDEX idx_reservations_guest_id    ON reservations (guest_id);
CREATE INDEX idx_reservations_property_id ON reservations (property_id);


-- -------------------------------------------------------------
-- conversations
-- Groups messages into threads. One conversation per guest per
-- property per stay context. Optionally linked to a reservation
-- once a booking exists.
-- -------------------------------------------------------------
CREATE TABLE conversations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_id            UUID NOT NULL REFERENCES guests (id) ON DELETE RESTRICT,
    reservation_id      UUID REFERENCES reservations (id) ON DELETE SET NULL,  -- nullable pre-booking
    property_id         VARCHAR(100) NOT NULL,
    status              VARCHAR(50) NOT NULL DEFAULT 'open',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT conversations_status_check
        CHECK (status IN ('open', 'resolved', 'escalated'))
);

CREATE INDEX idx_conversations_guest_id       ON conversations (guest_id);
CREATE INDEX idx_conversations_reservation_id ON conversations (reservation_id);


-- -------------------------------------------------------------
-- messages
-- Every inbound and outbound message across all channels.
-- direction: 'inbound' = from guest, 'outbound' = to guest.
-- -------------------------------------------------------------
CREATE TABLE messages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id     UUID NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
    guest_id            UUID NOT NULL REFERENCES guests (id) ON DELETE RESTRICT,
    source              VARCHAR(50) NOT NULL,                -- whatsapp | booking_com | airbnb | instagram | direct
    direction           VARCHAR(10) NOT NULL,                -- inbound | outbound
    message_text        TEXT NOT NULL,
    timestamp           TIMESTAMPTZ NOT NULL,
    booking_ref         VARCHAR(100),                        -- optional, may not exist at time of message
    property_id         VARCHAR(100) NOT NULL,
    query_type          VARCHAR(50),                         -- populated for inbound messages only
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT messages_source_check
        CHECK (source IN ('whatsapp', 'booking_com', 'airbnb', 'instagram', 'direct')),
    CONSTRAINT messages_direction_check
        CHECK (direction IN ('inbound', 'outbound'))
);

CREATE INDEX idx_messages_conversation_id ON messages (conversation_id);
CREATE INDEX idx_messages_guest_id        ON messages (guest_id);
CREATE INDEX idx_messages_timestamp       ON messages (timestamp DESC);


-- -------------------------------------------------------------
-- ai_logs
-- One row per inbound message that was processed by the AI.
-- Tracks the full decision: confidence score, action taken,
-- whether a human edited the reply, and whether it was sent.
-- This is the audit trail for the AI system.
-- -------------------------------------------------------------
CREATE TABLE ai_logs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id          UUID NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
    conversation_id     UUID NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
    query_type          VARCHAR(50) NOT NULL,
    confidence_score    NUMERIC(4, 2) NOT NULL,              -- 0.00 to 1.00
    drafted_reply       TEXT NOT NULL,                       -- what the AI wrote
    final_reply         TEXT,                                -- what was actually sent (may differ if agent edited)
    action              VARCHAR(20) NOT NULL,                -- auto_send | agent_review | escalate
    agent_edited        BOOLEAN NOT NULL DEFAULT FALSE,      -- true if a human changed the drafted reply
    was_sent            BOOLEAN NOT NULL DEFAULT FALSE,      -- true if the reply was sent to the guest
    sent_at             TIMESTAMPTZ,                         -- when it was sent
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ai_logs_action_check
        CHECK (action IN ('auto_send', 'agent_review', 'escalate')),
    CONSTRAINT ai_logs_confidence_range
        CHECK (confidence_score >= 0.00 AND confidence_score <= 1.00)
);

CREATE INDEX idx_ai_logs_message_id      ON ai_logs (message_id);
CREATE INDEX idx_ai_logs_query_type      ON ai_logs (query_type);
CREATE INDEX idx_ai_logs_action          ON ai_logs (action);
CREATE INDEX idx_ai_logs_confidence      ON ai_logs (confidence_score);
