import express from "express";
import {
  getTenants,
  getTenantById,
  createTenant,
  updateTenant,
  deleteTenant,
  getTenantListings,
  getTenantLeases,
} from "../controllers/tenantController.js";
import { autoCreateTenantProfile } from "../middleware/autoCreateProfile.js";

const router = express.Router();

// GET /api/tenants - Get all tenants
router.get("/", getTenants);

// GET /api/tenants/:id - Get tenant by ID
router.get("/:id", autoCreateTenantProfile, getTenantById);

// GET /api/tenants/:id/listings - Get tenant's listings
router.get("/:id/listings", autoCreateTenantProfile, getTenantListings);

// GET /api/tenants/:id/leases - Get tenant's leases
router.get("/:id/leases", autoCreateTenantProfile, getTenantLeases);

// POST /api/tenants - Create new tenant
router.post("/", createTenant);

// PUT /api/tenants/:id - Update tenant
router.put("/:id", autoCreateTenantProfile, updateTenant);

// DELETE /api/tenants/:id - Delete tenant
router.delete("/:id", autoCreateTenantProfile, deleteTenant);

export default router;
