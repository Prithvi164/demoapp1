-- Create enum for batch event status
CREATE TYPE batch_event_status AS ENUM ('scheduled', 'completed', 'cancelled');

-- Create enum for batch event type
CREATE TYPE batch_event_type AS ENUM ('refresher', 'quiz', 'training', 'meeting', 'other');

-- Create table for batch events
CREATE TABLE IF NOT EXISTS batch_events (
  id SERIAL PRIMARY KEY,
  batch_id INTEGER NOT NULL REFERENCES organization_batches(id),
  title TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  event_type batch_event_type NOT NULL DEFAULT 'other',
  status batch_event_status NOT NULL DEFAULT 'scheduled',
  organization_id INTEGER NOT NULL REFERENCES organizations(id),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);