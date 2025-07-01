import "dotenv/config";
import express from "express";
import cors from "cors";
import { errorHandler } from "./middleware/errorHandler.js";
import { successResponse } from "./utils/response.js";
import { supabase, initializeStorageBuckets } from "./config/supabase.js";
import { landlordRouter } from "./routes/index.js";
import { prisma } from "./config/prisma.js";
import apiRoutes from "./routes/index.js";
import chatRoutes from "./routes/chat.js";

const app = express();
const port = process.env.PORT || 3001;

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:8080",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Routes
app.use("/api/landlord", landlordRouter);

// API routes
app.use("/api", apiRoutes);
app.use("/api/chat", chatRoutes);

// Routes
app.use("/api/landlord", landlordRouter);

// Basic health check route
app.get("/api/health", (req, res) => {
  res.json(
    successResponse(
      {
        environment: process.env.NODE_ENV,
        frontendUrl: process.env.FRONTEND_URL,
        database: "Connected",
      },
      "Server is running"
    )
  );
});

// Error handling middleware
app.use(errorHandler);

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🔄 Gracefully shutting down...");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n🔄 Gracefully shutting down...");
  await prisma.$disconnect();
  process.exit(0);
});

// Start server
app.listen(port, async () => {
  console.log(`
🚀 Server is running!
📡 Port: ${port}
🌍 Environment: ${process.env.NODE_ENV || "development"}
🔗 Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:8080"}
🗄️  Database: Prisma + Supabase PostgreSQL
📋 API Routes: 
   • /api/landlords - Landlord management
   • /api/tenants - Tenant management  
   • /api/listings - Property listings
   • /api/chats - Messaging system
  `);

  // Initialize storage buckets
  await initializeStorageBuckets();
});
