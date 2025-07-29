import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response } from "express";
import session from "express-session";
import memorystore from "memorystore";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser, permissionEnum } from "@shared/schema";
import connectPg from "connect-pg-simple";
import { z } from "zod";
import { and, gt } from "drizzle-orm";
import { initializeEmailService, sendPasswordResetEmail } from "./email-service";

const PostgresSessionStore = connectPg(session);
const scryptAsync = promisify(scrypt);

// Registration validation schema
const registrationSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  organizationName: z.string().min(2, "Organization name must be at least 2 characters"),
});

// Forgot password validation schema
const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email format"),
});

// Reset password validation schema
const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Confirm password is required"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

// Generate a password reset token
function generateResetToken(): string {
  return randomBytes(32).toString("hex");
}

async function comparePasswords(supplied: string, stored: string) {
  try {
    if (!stored || !stored.includes(".")) {
      console.error("Invalid stored password format:", stored);
      return false;
    }
    const [hashed, salt] = stored.split(".");
    console.log("Password comparison details:");
    console.log("- Salt:", salt);
    console.log("- Stored hash length:", hashed.length);
    console.log("- Stored hash:", hashed);

    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    const suppliedHex = suppliedBuf.toString("hex");

    console.log("- Supplied password length:", supplied.length);
    console.log("- Generated hash:", suppliedHex);
    console.log("- Generated hash length:", suppliedBuf.length);

    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error("Password comparison error:", error);
    return false;
  }
}

export function setupAuth(app: Express) {
  const sessionSecret = randomBytes(32).toString("hex");
  
  // Initialize email service
  initializeEmailService()
    .then(success => {
      if (success) {
        console.log("Email service initialized successfully");
      } else {
        console.warn("Email service initialization failed, emails will not be sent");
      }
    })
    .catch(error => {
      console.error("Error initializing email service:", error);
    });
  
  // Use a memory store initially to allow the app to start even if DB connection fails
  const MemoryStore = memorystore(session);
  let sessionStore: any = new MemoryStore({
    checkPeriod: 86400000 // prune expired entries every 24h
  });
  
  console.log("Using memory session store initially");
  
  // Try to create a PostgreSQL session store, but don't fail if it doesn't work
  try {
    if (process.env.DATABASE_URL) {
      console.log("Attempting to create PostgreSQL session store");
      const pgStore = new PostgresSessionStore({
        conObject: {
          connectionString: process.env.DATABASE_URL,
        },
        createTableIfMissing: true,
      });
      
      // Check if the store is valid before using it
      if (pgStore) {
        console.log("Successfully created PostgreSQL session store");
        sessionStore = pgStore;
      }
    }
  } catch (error) {
    console.error("Failed to create PostgreSQL session store:", error);
    console.log("Continuing with memory session store");
  }

  app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }));

  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        console.log("Attempting login for:", username);
        let user = await storage.getUserByUsername(username);

        if (!user) {
          console.log("User not found by username, trying email...");
          user = await storage.getUserByEmail(username);
        }

        if (!user) {
          console.log("User not found");
          return done(null, false, { message: "Invalid username or password" });
        }

        // Check if user is active
        if (!user.active) {
          console.log("User account is inactive");
          return done(null, false, { message: "Account is inactive. Please contact your administrator." });
        }

        console.log("Found user:", user.username, "role:", user.role);
        console.log("Stored password format:", user.password);

        const isValidPassword = await comparePasswords(password, user.password);
        console.log("Password validation result:", isValidPassword);

        if (!isValidPassword) {
          return done(null, false, { message: "Invalid username or password" });
        }

        return done(null, user);
      } catch (err) {
        console.error("Login error:", err);
        return done(err);
      }
    })
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return done(null, false);
      }
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  // Add registration endpoint
  app.post("/api/register", async (req, res) => {
    try {
      // Validate registration data
      const data = registrationSchema.parse(req.body);

      // Check if username already exists
      const existingUser = await storage.getUserByUsername(data.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Check if email already exists
      const existingEmail = await storage.getUserByEmail(data.email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already exists" });
      }

      // Create organization first
      const organization = await storage.createOrganization({
        name: data.organizationName,
      });

      // Create owner user
      const hashedPassword = await hashPassword(data.password);
      const user = await storage.createUser({
        username: data.username,
        email: data.email,
        password: hashedPassword,
        organizationId: organization.id,
        role: "owner" as const,
        fullName: data.username,
        employeeId: `EMP${Date.now()}`,
        phoneNumber: "",
        active: true,
        category: "active" as const
      });

      // Set up initial permissions for owner
      await storage.updateRolePermissions(
        organization.id,
        'owner',
        permissionEnum.enumValues
      );

      // Log the user in
      req.login(user, (err) => {
        if (err) {
          console.error("Login error after registration:", err);
          return res.status(500).json({ message: "Error logging in after registration" });
        }
        return res.status(201).json(user);
      });
    } catch (error) {
      console.error("Registration error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      return res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: Express.User | false, info: any) => {
      if (err) {
        console.error("Login error:", err);
        return res.status(500).json({ message: "Internal server error" });
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }
      req.login(user, (err) => {
        if (err) {
          console.error("Login session error:", err);
          return res.status(500).json({ message: "Session error" });
        }
        return res.json(user);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res) => {
    try {
      if (!req.session) {
        return res.status(200).json({ message: "Already logged out" });
      }

      if (!req.isAuthenticated()) {
        req.logout(() => {
          res.clearCookie('connect.sid');
          return res.status(200).json({ message: "Already logged out" });
        });
        return;
      }

      req.logout((err) => {
        if (err) {
          console.error("Logout error during req.logout:", err);
          return res.status(500).json({ message: `Logout failed: ${err.message}` });
        }
        
        if (req.session) {
          req.session.destroy((err) => {
            if (err) {
              console.error("Logout error during session.destroy:", err);
              return res.status(500).json({ message: `Logout failed: ${err.message}` });
            }
            res.clearCookie('connect.sid');
            return res.status(200).json({ message: "Logged out successfully" });
          });
        } else {
          res.clearCookie('connect.sid');
          return res.status(200).json({ message: "Logged out successfully" });
        }
      });
    } catch (error) {
      console.error("Unexpected error during logout:", error);
      return res.status(500).json({ message: `Logout failed: ${error instanceof Error ? error.message : 'Unknown error'}` });
    }
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json(req.user);
  });
  
  // Forgot Password route
  app.post("/api/forgot-password", async (req, res) => {
    try {
      // Validate the request data
      const data = forgotPasswordSchema.parse(req.body);
      const { email } = data;
      
      console.log(`Forgot password request for email: ${email}`);
      
      // Check if user exists
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // For security reasons, don't reveal that the email doesn't exist
        return res.status(200).json({
          message: "If your email exists in our system, you will receive a password reset link."
        });
      }
      
      // Generate a reset token
      const resetToken = generateResetToken();
      
      // Save the reset token and expiration in the database
      await storage.createPasswordResetToken(email, resetToken);
      
      // Generate reset URL for the frontend
      const resetUrl = `${req.protocol}://${req.get("host")}/reset-password?token=${resetToken}`;
      
      console.log(`Password reset link for ${email}: ${resetUrl}`);
      
      // Send the password reset email
      const emailResult = await sendPasswordResetEmail(email, resetUrl, user.username);
      console.log("Email sending result:", emailResult);
      
      if (emailResult.previewUrl) {
        console.log("Preview URL for email:", emailResult.previewUrl);
      }
      
      return res.status(200).json({
        message: "If your email exists in our system, you will receive a password reset link.",
        // For testing purposes only - would be removed in production:
        resetUrl: resetUrl,
        emailPreviewUrl: emailResult.previewUrl
      });
    } catch (error) {
      console.error("Forgot password error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      return res.status(500).json({ message: "Failed to process request" });
    }
  });
  
  // Reset Password route
  app.post("/api/reset-password", async (req, res) => {
    try {
      // Validate the request data
      const data = resetPasswordSchema.parse(req.body);
      const { token, password } = data;
      
      console.log(`Password reset attempt for token: ${token.substring(0, 10)}...`);
      
      // Find user by reset token
      const user = await storage.getUserByResetToken(token);
      
      if (!user) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }
      
      // Hash the new password
      const hashedPassword = await hashPassword(password);
      
      // Update the user's password and clear the reset token
      const success = await storage.resetPassword(token, hashedPassword);
      
      if (!success) {
        return res.status(400).json({ message: "Password reset failed" });
      }
      
      console.log(`Password reset successful for user: ${user.username}`);
      
      return res.status(200).json({ message: "Password has been reset successfully" });
    } catch (error) {
      console.error("Password reset error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      return res.status(500).json({ message: "Failed to reset password" });
    }
  });
  
  // Validate Reset Token route
  app.get("/api/validate-reset-token/:token", async (req, res) => {
    try {
      const { token } = req.params;
      
      if (!token) {
        return res.status(400).json({ message: "No token provided" });
      }
      
      // Check if token exists and is valid
      const user = await storage.getUserByResetToken(token);
      
      if (!user) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }
      
      return res.status(200).json({ message: "Token is valid", valid: true });
    } catch (error) {
      console.error("Token validation error:", error);
      return res.status(500).json({ message: "Failed to validate token" });
    }
  });
}