import { prisma } from "../config/prisma.js";
import { successResponse, errorResponse } from "../utils/response.js";

// Helper function to convert BigInt to string for JSON serialization
const convertBigIntToString = (obj) => {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'bigint') {
    return obj.toString();
  }
  
  // Handle Date objects
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  
  if (Array.isArray(obj)) {
    return obj.map(convertBigIntToString);
  }
  
  if (typeof obj === 'object') {
    const converted = {};
    for (const [key, value] of Object.entries(obj)) {
      converted[key] = convertBigIntToString(value);
    }
    return converted;
  }
  
  return obj;
};

// Get all tenants
export const getTenants = async (req, res) => {
  try {
    const tenants = await prisma.tenant_profiles.findMany({
      include: {
        listings: {
          select: {
            id: true,
            title: true,
            price: true,
            city: true,
            state: true,
            available: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    });

    // Convert BigInt to string for JSON serialization
    const responseData = convertBigIntToString(tenants);
    res.json(successResponse(responseData, "Tenants retrieved successfully"));
  } catch (error) {
    console.error("Error fetching tenants:", error);
    res.status(500).json(errorResponse(error));
  }
};

// Get tenant by ID
export const getTenantById = async (req, res) => {
  try {
    const { id } = req.params;

    const tenant = await prisma.tenant_profiles.findUnique({
      where: { id },
      include: {
        listings: {
          select: {
            id: true,
            title: true,
            price: true,
            city: true,
            state: true,
            bedrooms: true,
            bathrooms: true,
            available: true,
            created_at: true,
          },
          orderBy: { created_at: "desc" },
        },
      },
    });

    if (!tenant) {
      return res
        .status(404)
        .json(errorResponse(new Error("Tenant not found"), 404));
    }

    // Convert BigInt to string for JSON serialization
    const responseData = convertBigIntToString(tenant);
    res.json(successResponse(responseData, "Tenant retrieved successfully"));
  } catch (error) {
    console.error("Error fetching tenant:", error);
    res.status(500).json(errorResponse(error));
  }
};

// Create new tenant (with upsert functionality)
export const createTenant = async (req, res) => {
  try {
    const { id, full_name, email, phone, image_url, address } = req.body;

    // Use upsert to handle both create and update scenarios
    const tenant = await prisma.tenant_profiles.upsert({
      where: { id },
      update: {
        // Update existing profile with new data if provided
        ...(full_name && { full_name }),
        ...(email && { email }),
        ...(phone !== undefined && { phone }),
        ...(image_url !== undefined && { image_url }),
        ...(address !== undefined && { address }),
        updated_at: new Date(),
      },
      create: {
        id,
        full_name: full_name || email.split("@")[0], // Use email prefix as fallback
        email,
        phone,
        image_url,
        address,
      },
    });

    // Convert BigInt to string for JSON serialization
    const responseData = convertBigIntToString(tenant);
    res
      .status(201)
      .json(
        successResponse(responseData, "Tenant profile created/updated successfully")
      );
  } catch (error) {
    console.error("Error creating/updating tenant:", error);
    res.status(500).json(errorResponse(error));
  }
};

// Update tenant
export const updateTenant = async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, email, phone, image_url, address } = req.body;

    const tenant = await prisma.tenant_profiles.update({
      where: { id },
      data: {
        ...(full_name && { full_name }),
        ...(email && { email }),
        ...(phone !== undefined && { phone }),
        ...(image_url !== undefined && { image_url }),
        ...(address !== undefined && { address }),
        updated_at: new Date(),
      },
    });

    // Convert BigInt to string for JSON serialization
    const responseData = convertBigIntToString(tenant);
    res.json(successResponse(responseData, "Tenant updated successfully"));
  } catch (error) {
    console.error("Error updating tenant:", error);

    if (error.code === "P2025") {
      return res
        .status(404)
        .json(errorResponse(new Error("Tenant not found"), 404));
    }

    res.status(500).json(errorResponse(error));
  }
};

// Delete tenant
export const deleteTenant = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.tenant_profiles.delete({
      where: { id },
    });

    res.json(successResponse(null, "Tenant deleted successfully"));
  } catch (error) {
    console.error("Error deleting tenant:", error);

    if (error.code === "P2025") {
      return res
        .status(404)
        .json(errorResponse(new Error("Tenant not found"), 404));
    }

    res.status(500).json(errorResponse(error));
  }
};

// Get tenant's listings (properties they're renting)
export const getTenantListings = async (req, res) => {
  try {
    const { id } = req.params;
    


    // Fetch all listings for the tenant where tenant_id matches
    const listings = await prisma.listings.findMany({
      where: { 
        tenant_id: id
      },
      include: {
        landlord_profiles: {
          select: {
            full_name: true,
            email: true,
            phone: true,
          },
        },
        leases: {
          where: {
            tenant_id: id,
          },
          orderBy: { created_at: "desc" },
          take: 1, // Get the most recent lease
        },
      },
      orderBy: { created_at: "desc" },
    });

    // Process listings with lease data and landlord contact info
    const listingsWithLeaseDates = listings.map((listing) => {
      // Get the most recent lease (already included in the query)
      const lease = listing.leases[0];
      
      // Parse JSON fields if they're strings
      const images = Array.isArray(listing.images)
        ? listing.images
        : (typeof listing.images === 'string' && listing.images.trim().startsWith('[')
            ? JSON.parse(listing.images)
            : []);
            
      const amenities = Array.isArray(listing.amenities)
        ? listing.amenities
        : (typeof listing.amenities === 'string' && listing.amenities.trim().startsWith('[')
            ? JSON.parse(listing.amenities)
            : []);
            
      const house_rules = Array.isArray(listing.house_rules)
        ? listing.house_rules
        : (typeof listing.house_rules === 'string' && listing.house_rules.trim().startsWith('[')
            ? JSON.parse(listing.house_rules)
            : (listing.house_rules ? [listing.house_rules] : []));
      
      return {
        ...listing,
        id: listing.id.toString(),
        images,
        amenities,
        house_rules,
        lease_start: lease?.start_date ? lease.start_date.toISOString().split('T')[0] : "N/A",
        lease_end: lease?.end_date ? lease.end_date.toISOString().split('T')[0] : "N/A",
        landlord_name: listing.landlord_profiles?.full_name || listing.landlord_name || "N/A",
        landlord_email: listing.landlord_profiles?.email || "N/A",
        landlord_phone: listing.landlord_profiles?.phone || listing.landlord_phone || "N/A",
      };
    });

    // Convert BigInt to string for JSON serialization
    const responseData = convertBigIntToString(listingsWithLeaseDates);
    
    res.json(
      successResponse(responseData, "Tenant listings retrieved successfully")
    );
  } catch (error) {
    console.error("Error fetching tenant listings:", error);
    res.status(500).json(errorResponse(error));
  }
};

// Get tenant's lease data
export const getTenantLeases = async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch all leases for the tenant
    const leases = await prisma.leases.findMany({
      where: { 
        tenant_id: id 
      },
      include: {
        listings: {
          select: {
            id: true,
            title: true,
            address: true,
            city: true,
            state: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    });

    // Process leases with listing info
    const leasesWithListingInfo = leases.map((lease) => ({
      id: lease.id,
      start_date: lease.start_date ? lease.start_date.toISOString().split('T')[0] : null,
      end_date: lease.end_date ? lease.end_date.toISOString().split('T')[0] : null,
      rent: lease.rent,
      signed: lease.signed,
      listing: lease.listings ? {
        id: lease.listings.id.toString(),
        title: lease.listings.title,
        address: lease.listings.address,
        city: lease.listings.city,
        state: lease.listings.state,
      } : null,
    }));

    // Convert BigInt to string for JSON serialization
    const responseData = convertBigIntToString(leasesWithListingInfo);
    
    res.json(
      successResponse(responseData, "Tenant leases retrieved successfully")
    );
  } catch (error) {
    console.error("Error fetching tenant leases:", error);
    res.status(500).json(errorResponse(error));
  }
};
