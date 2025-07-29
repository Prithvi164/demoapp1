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
  // Get username and password from command line arguments
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node update_specific_user_password.mjs <username> <password>');
    process.exit(1);
  }

  const username = args[0];
  const newPassword = args[1];

  // Connect to the database
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    await client.connect();
    console.log('Connected to database');
    
    // Generate hashed password
    const hashedPassword = await hashPassword(newPassword);
    console.log(`Generated password hash: ${hashedPassword}`);
    
    // Update user by username
    let result = await client.query(
      'UPDATE users SET password = $1 WHERE username = $2 RETURNING id, username',
      [hashedPassword, username]
    );
    
    if (result.rows.length > 0) {
      console.log(`Updated password for user: ${result.rows[0].username} (ID: ${result.rows[0].id})`);
    } else {
      // Try by email if username not found
      console.log(`User ${username} not found by username, trying email...`);
      result = await client.query(
        'UPDATE users SET password = $1 WHERE email = $2 RETURNING id, username',
        [hashedPassword, username]
      );
      
      if (result.rows.length > 0) {
        console.log(`Updated password for user: ${result.rows[0].username} (ID: ${result.rows[0].id})`);
      } else {
        console.log(`User ${username} not found by username or email`);
      }
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
    console.log('Database connection closed');
  }
}

updatePassword();