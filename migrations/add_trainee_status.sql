-- Create the trainee_phase_status enum type if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trainee_phase_status') THEN
        CREATE TYPE trainee_phase_status AS ENUM (
            'planned',
            'induction',
            'training',
            'certification',
            'ojt',
            'ojt_certification',
            'completed',
            'refresher',
            'refer_to_hr'
        );
    END IF;
END $$;

-- Add traineeStatus and isManualStatus columns to user_batch_processes table
ALTER TABLE user_batch_processes 
ADD COLUMN IF NOT EXISTS trainee_status trainee_phase_status,
ADD COLUMN IF NOT EXISTS is_manual_status BOOLEAN DEFAULT FALSE;

-- Add an index on trainee_status for faster queries
CREATE INDEX IF NOT EXISTS idx_user_batch_processes_trainee_status ON user_batch_processes(trainee_status);