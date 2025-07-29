// Import dependencies
import * as schema from "@shared/schema";

console.log("Starting database connection setup...");

// Flag to track if we have a real database connection
let hasRealDatabaseConnection = false;

// Generic mock function for database operations
const mockDbOperation = async (...args: any[]) => {
  console.log(`Mock DB operation called with:`, args);
  return [];
};

// Create a basic mock DB object that won't crash the app
const createMockDb = () => {
  console.log("Creating mock database interface");
  
  // Create a proxy that logs operations but doesn't fail
  const mockQueryHandler = {
    get: function(target: any, prop: string) {
      if (prop === 'query') {
        return target.query;
      }
      
      // Return a function for any called method
      return async (...args: any[]) => {
        console.warn(`Mock DB method ${prop} called - database is not connected`);
        return [];
      };
    }
  };
  
  // Create base mock object with query namespace
  const mockDb = {
    query: new Proxy({}, {
      get: function(target, tableName: string) {
        return {
          findMany: mockDbOperation,
          findFirst: mockDbOperation,
          count: async () => 0
        };
      }
    }),
    insert: mockDbOperation,
    select: mockDbOperation,
    update: mockDbOperation,
    delete: mockDbOperation,
  };
  
  return new Proxy(mockDb, mockQueryHandler);
};

// Initialize with mock database first to allow app to start
let db = createMockDb();

// Try to set up a real database connection asynchronously
const initializeRealDatabase = async () => {
  try {
    console.log("Attempting to connect to real database...");
    
    // Dynamically import dependencies to prevent startup failures
    const { Pool, neonConfig } = await import('@neondatabase/serverless');
    const { drizzle } = await import('drizzle-orm/neon-serverless');
    const ws = await import('ws').then(m => m.default);
    
    // Set WebSocket constructor
    neonConfig.webSocketConstructor = ws;
    
    // Check DATABASE_URL
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    
    // Create connection pool
    const pool = new Pool({ 
      connectionString: process.env.DATABASE_URL,
      max: 10, 
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });
    
    // Test connection
    const client = await pool.connect();
    client.release();
    
    // Create real Drizzle instance
    const realDb = drizzle({ client: pool, schema });
    console.log("🟢 Successfully connected to real database!");
    
    // Replace mock with real implementation
    db = realDb;
    hasRealDatabaseConnection = true;
    
    return true;
  } catch (error) {
    console.error("❌ Failed to initialize real database:", error);
    console.warn("Application will continue with limited database functionality");
    return false;
  }
};

// Start async initialization
initializeRealDatabase().then(success => {
  if (success) {
    console.log("Database ready for operations");
  } else {
    console.warn("Application is running without database access");
  }
});

// Export the db object - it will be a mock first and then replaced with real implementation if connection succeeds
export { db };