import { pool, db } from './db';
import { sql } from 'drizzle-orm';
import type { QueryResult } from '@neondatabase/serverless';

interface TimezoneResult {
  timezone: string;
}

interface TimeResult {
  now: Date;
}

async function setTimezone() {
  try {
    console.log('Current timezone configuration:');
    const currentTimezone = await db.execute<TimezoneResult>(sql.raw('SHOW timezone;'));
    console.log('Current timezone:', currentTimezone.rows[0]?.timezone ?? 'unknown');

    // Set timezone to IST
    await db.execute(sql.raw("SET timezone='Asia/Kolkata';"));
    console.log('Timezone changed to Asia/Kolkata (IST)');

    // Verify the change
    const newTimezone = await db.execute<TimezoneResult>(sql.raw('SHOW timezone;'));
    console.log('New timezone:', newTimezone.rows[0]?.timezone ?? 'unknown');

    // Show current time in this timezone
    const currentTime = await db.execute<TimeResult>(sql.raw('SELECT NOW();'));
    console.log('Current time in IST:', currentTime.rows[0]?.now ?? new Date());
  } catch (error) {
    console.error('Error setting timezone:', error);
  } finally {
    // Close the database connection
    await pool.end();
  }
}

// Run the timezone setting function
setTimezone();