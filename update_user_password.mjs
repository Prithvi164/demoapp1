import crypto from 'crypto';
import pg from 'pg';
import { promisify } from 'util';

const { Client } = pg;
const scryptAsync = promisify(crypto.scrypt);

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString('hex')}.${salt}`;
}

async function updatePassword() {
  // Connect to the database
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    await client.connect();
    console.log('Connected to database');

    const username = 'qatest';
    const newPassword = 'password123';
    
    // Generate hashed password
    const hashedPassword = await hashPassword(newPassword);
    console.log(`Generated password hash: ${hashedPassword}`);
    
    // Update user
    const result = await client.query(
      'UPDATE users SET password = $1 WHERE username = $2 RETURNING id, username',
      [hashedPassword, username]
    );
    
    if (result.rows.length > 0) {
      console.log(`Updated password for user: ${result.rows[0].username} (ID: ${result.rows[0].id})`);
    } else {
      console.log(`User ${username} not found`);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
    console.log('Database connection closed');
  }
}

updatePassword();
