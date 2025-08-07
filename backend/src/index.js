import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { errorHandler } from "./middleware/errorHandler.js";
import { successResponse } from "./utils/response.js";
import { supabase, initializeStorageBuckets } from "./config/supabase.js";
import { prisma } from "./config/prisma.js";
import apiRoutes from "./routes/index.js";
import chatRoutes from "./routes/chatRoutes.js";
import { initializeSocket } from "./config/socket.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import multer from 'multer';
import path from 'path';
import maintenanceRoutes from './routes/maintenanceRoutes.js';

const app = express();
const server = createServer(app);
const port = process.env.PORT || 3001;

// Initialize WebSocket
const io = initializeSocket(server);

// CORS configuration
const corsOptions = {
  origin: [
    process.env.FRONTEND_URL || "http://localhost:8080",
    "https://roomzi.up.railway.app",
    "https://balanced-forgiveness-production2.up.railway.app",
    "http://localhost:8081","http://localhost:8082",
    "http://localhost:8083",
    "http://localhost:8084",
    "http://localhost:8085",
    "http://localhost:8086",
    "http://localhost:8087",
    "http://localhost:8088",
    "http://localhost:8089",
    "http://localhost:8090",
    "http://localhost:8091","http://localhost:8092",
    "http://localhost:8093",
    "http://localhost:8094",
    "http://localhost:8095",
    "http://localhost:8096",
    "http://localhost:8097",
    "http://localhost:8098",
    "http://localhost:8099",
    "http://127.0.0.1:8080",
    "http://127.0.0.1:8081",
    "http://127.0.0.1:8082",
    "http://127.0.0.1:8083",
    "http://127.0.0.1:8084",
    "http://127.0.0.1:8085",
    "http://127.0.0.1:8086",
    "http://127.0.0.1:8087",
    "http://127.0.0.1:8088",
    "http://127.0.0.1:8089",
    "http://127.0.0.1:8090",
    "http://127.0.0.1:8091",
    "http://127.0.0.1:8092",
    "http://127.0.0.1:8093",
    "http://127.0.0.1:8094",
    "http://127.0.0.1:8095",
    "http://127.0.0.1:8096",
    "http://127.0.0.1:8097",
    "http://127.0.0.1:8098",
    "http://127.0.0.1:8099"
  ],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Accept",
    "X-Requested-With",
  ],
  credentials: true,
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

app.use('/uploads', express.static('uploads'));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    // Save with original extension
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + Date.now() + ext);
  }
});
const upload = multer({ storage });

// Routes
app.use("/api/payments", paymentRoutes);

// API routes
app.use("/api", apiRoutes);
app.use("/api/chat", chatRoutes);
app.use('/api/maintenance-requests', maintenanceRoutes);

// Basic health check route
app.get("/api/health", (req, res) => {
  res.json(
    successResponse(
      {
        environment: process.env.NODE_ENV,
        frontendUrl: process.env.FRONTEND_URL,
        database: "Connected",
        websocket: "Active",
      },
      "Server is running"
    )
  );
});

// Error handling middleware
app.use(errorHandler);

// Catch-all JSON error handler for unknown routes
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

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
server.listen(port, async () => {
  console.log(`
🚀 Server is running!
📡 Port: ${port}
🌍 Environment: ${process.env.NODE_ENV || "development"}
🔗 Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:8080"}
🗄️  Database: Prisma + Supabase PostgreSQL
🔌 WebSocket: Socket.io Active
📋 API Routes: 
   • /api/landlords - Landlord management
   • /api/tenants - Tenant management  
   • /api/listings - Property listings
   • /api/chats - Messaging system
  `);

  // Initialize storage buckets
  await initializeStorageBuckets();
});
