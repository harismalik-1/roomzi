// API Base Configuration
export const getApiBaseUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  console.log('🌐 getApiBaseUrl() - VITE_API_URL:', import.meta.env.VITE_API_URL);
  console.log('🌐 getApiBaseUrl() - Using URL:', apiUrl);
  return apiUrl;
};

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  maxRequests: 10,
  timeWindow: 60000, // 1 minute
  backoffMultiplier: 2,
  maxBackoff: 30000, // 30 seconds
};

// Request tracking
const requestTracker = {
  requests: [] as number[],
  lastBackoff: 0,
};

// Clean old requests
const cleanOldRequests = () => {
  const now = Date.now();
  requestTracker.requests = requestTracker.requests.filter(
    time => now - time < RATE_LIMIT_CONFIG.timeWindow
  );
};

// Check if we're rate limited
const isRateLimited = () => {
  cleanOldRequests();
  return requestTracker.requests.length >= RATE_LIMIT_CONFIG.maxRequests;
};

// Calculate backoff delay
const getBackoffDelay = () => {
  if (requestTracker.lastBackoff === 0) {
    requestTracker.lastBackoff = 1000; // Start with 1 second
  } else {
    requestTracker.lastBackoff = Math.min(
      requestTracker.lastBackoff * RATE_LIMIT_CONFIG.backoffMultiplier,
      RATE_LIMIT_CONFIG.maxBackoff
    );
  }
  return requestTracker.lastBackoff;
};

// Reset backoff on successful request
const resetBackoff = () => {
  requestTracker.lastBackoff = 0;
};

// Types
export interface ProfileData {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  image_url?: string | null;
  address?: string | null;
  viewingRequestNotifications?: boolean;
  rentReminderDays?: number;
  preferredHouseTypes?: string[];
  preferredRentMin?: number;
  preferredRentMax?: number;
  preferredDistance?: number;
}

export interface LandlordProfileData extends ProfileData {
  documents?: Array<{ path: string; displayName: string }>;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  alreadyExists?: boolean;
}

// Generic API error handling
export class ApiError extends Error {
  status: number;
  data?: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

// Generic fetch wrapper with error handling and rate limiting
export const apiFetch = async (url: string, options: RequestInit = {}): Promise<any> => {
  if (isRateLimited()) {
    const delay = getBackoffDelay();
    console.warn(`Rate limited. Waiting ${delay}ms before retry...`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  try {
    requestTracker.requests.push(Date.now());

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : getBackoffDelay();
        console.warn(`Rate limited by server. Waiting ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return apiFetch(url, options);
      }
      throw new ApiError(data.message || 'API request failed', response.status, data);
    }

    resetBackoff();
    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ApiError('Network error: Unable to connect to server. Please check your connection.', 0);
    }
    throw new ApiError('Unexpected error occurred', 500);
  }
};

// Cached API responses
const cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

// Cached fetch with TTL
export const cachedApiFetch = async (
  url: string,
  options: RequestInit = {},
  ttl: number = 300000 // 5 minutes default
): Promise<any> => {
  const cacheKey = `${url}-${JSON.stringify(options)}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    console.log('Using cached response for:', url);
    return cached.data;
  }

  const data = await apiFetch(url, options);

  cache.set(cacheKey, {
    data,
    timestamp: Date.now(),
    ttl,
  });

  return data;
};

// Clear cache
export const clearApiCache = () => {
  cache.clear();
};

// Clear expired cache entries
export const cleanupCache = () => {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > value.ttl) {
      cache.delete(key);
    }
  }
};

// Run cache cleanup every 5 minutes
setInterval(cleanupCache, 300000);

// Profile creation helper
const createProfileData = (userId: string, email: string, userMetadata?: any): ProfileData => {
  // Use actual user data from auth if available
  const fullName = userMetadata?.full_name || 
                   userMetadata?.name || 
                   userMetadata?.display_name || 
                   email.split('@')[0];
  
  return {
    id: userId,
    full_name: fullName,
    email: email,
    phone: userMetadata?.phone || null,
    image_url: userMetadata?.avatar_url || userMetadata?.picture || null,
    address: userMetadata?.address || null,
    viewingRequestNotifications: true,
    rentReminderDays: 3,
  };
};

// Profile creation helper for landlords
const createLandlordProfileData = (userId: string, email: string, userMetadata?: any): LandlordProfileData => {
  // Use actual user data from auth if available
  const fullName = userMetadata?.full_name || 
                   userMetadata?.name || 
                   userMetadata?.display_name || 
                   email.split('@')[0];
  
  return {
    id: userId,
    full_name: fullName,
    email: email,
    phone: userMetadata?.phone || null,
    image_url: userMetadata?.avatar_url || userMetadata?.picture || null,
    address: userMetadata?.address || null,
    viewingRequestNotifications: true,
    rentReminderDays: 3,
    documents: [],
  };
};

// Profile synchronization utility functions
export const profileSyncUtils = {
  getOppositeProfileData: async (userId: string, currentRole: 'tenant' | 'landlord'): Promise<Partial<ProfileData> | null> => {
    try {
      const oppositeRole = currentRole === 'tenant' ? 'landlord' : 'tenant';
      const result = await profileUtils.getForRole(oppositeRole, userId);

      if (result.success && result.data?.data) {
        const oppositeProfile = result.data.data;
        return {
          full_name: oppositeProfile.full_name,
          phone: oppositeProfile.phone,
          image_url: oppositeProfile.image_url,
          address: oppositeProfile.address,
        };
      }
    } catch (error) {
      console.log('No opposite profile found or error fetching:', error);
    }
    return null;
  },

  syncProfiles: async (userId: string, updatedRole: 'tenant' | 'landlord', updatedData: Partial<ProfileData>): Promise<void> => {
    try {
      const oppositeRole = updatedRole === 'tenant' ? 'landlord' : 'tenant';
      const oppositeResult = await profileUtils.getForRole(oppositeRole, userId);

      if (oppositeResult.success && oppositeResult.data?.data) {
        const commonFields = {
          full_name: updatedData.full_name,
          phone: updatedData.phone,
          image_url: updatedData.image_url,
          address: updatedData.address,
        };

        const fieldsToUpdate = Object.fromEntries(
          Object.entries(commonFields).filter(([_, value]) => value !== undefined)
        );

        if (Object.keys(fieldsToUpdate).length > 0) {
          if (oppositeRole === 'tenant') {
            await tenantApi.update(userId, fieldsToUpdate, true);
          } else {
            await landlordApi.update(userId, fieldsToUpdate, true);
          }
          console.log(`✅ Synced profile data to ${oppositeRole} profile`);
        }
      }
    } catch (error) {
      console.warn('Failed to sync profiles:', error);
    }
  },
};

// Tenant API Functions
export const tenantApi = {
  create: async (userId: string, email: string, userMetadata?: any): Promise<ApiResponse> => {
    try {
      const landlordData = await profileSyncUtils.getOppositeProfileData(userId, 'tenant');
      const profileData = createProfileData(userId, email, userMetadata);

      if (landlordData) {
        Object.assign(profileData, {
          full_name: landlordData.full_name || profileData.full_name,
          phone: landlordData.phone || profileData.phone,
          image_url: landlordData.image_url || profileData.image_url,
          address: landlordData.address || profileData.address,
        });
        console.log('✅ Inherited profile data from landlord profile');
      }

      const url = `${getApiBaseUrl()}/api/tenants`;
      console.log('Creating tenant profile:', { userId, email });
      const response = await apiFetch(url, {
        method: 'POST',
        body: JSON.stringify(profileData),
      });

      console.log('Tenant profile created successfully:', response);
      return { success: true, data: response };
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 400 && error.data?.message?.includes('already exists')) {
          console.log('Tenant profile already exists - this is fine');
          return { success: true, alreadyExists: true };
        }
        if (error.status === 409) {
          console.log('Tenant profile already exists (409) - this is fine');
          return { success: true, alreadyExists: true };
        }
      }
      console.error('Error creating tenant profile:', error);
      throw error;
    }
  },

  getById: async (tenantId: string): Promise<ApiResponse> => {
    try {
      const url = `${getApiBaseUrl()}/api/tenants/${tenantId}`;
      const response = await cachedApiFetch(url, {}, 600000);
      return { success: true, data: response };
    } catch (error) {
      console.error('Error fetching tenant profile:', error);
      throw error;
    }
  },

  update: async (tenantId: string, profileData: Partial<ProfileData>, skipSync = false): Promise<ApiResponse> => {
    try {
      const url = `${getApiBaseUrl()}/api/tenants/${tenantId}`;
      console.log('Updating tenant profile:', { tenantId, profileData });
      const response = await apiFetch(url, {
        method: 'PUT',
        body: JSON.stringify(profileData),
      });

      cache.delete(`${getApiBaseUrl()}/api/tenants/${tenantId}-{}`);

      if (!skipSync) {
        await profileSyncUtils.syncProfiles(tenantId, 'tenant', profileData);
      }

      return { success: true, data: response };
    } catch (error) {
      console.error('Error updating tenant profile:', error);
      throw error;
    }
  },

  getListings: async (tenantId: string): Promise<ApiResponse> => {
    try {
      const url = `${getApiBaseUrl()}/api/tenants/${tenantId}/listings`;
      const response = await cachedApiFetch(url, {}, 300000);
      return { success: true, data: response };
    } catch (error) {
      console.error('Error fetching tenant listings:', error);
      throw error;
    }
  },

  getPreferences: async (tenantId: string): Promise<ApiResponse> => {
    try {
      const url = `${getApiBaseUrl()}/api/tenants/${tenantId}/preferences`;
      const response = await cachedApiFetch(url, {}, 300000);
      return { success: true, data: response };
    } catch (error) {
      console.error('Error fetching tenant preferences:', error);
      throw error;
    }
  },

  updatePreferences: async (tenantId: string, preferences: {
    preferredHouseTypes?: string[];
    preferredRentMin?: number;
    preferredRentMax?: number;
    preferredDistance?: number;
  }): Promise<ApiResponse> => {
    try {
      const url = `${getApiBaseUrl()}/api/tenants/${tenantId}/preferences`;
      const response = await apiFetch(url, {
        method: 'PUT',
        body: JSON.stringify(preferences),
      });

      // Clear cache for this tenant's preferences
      cache.delete(`${getApiBaseUrl()}/api/tenants/${tenantId}/preferences-{}`);

      return { success: true, data: response };
    } catch (error) {
      console.error('Error updating tenant preferences:', error);
      throw error;
    }
  },
};

// Landlord API Functions
export const landlordApi = {
  create: async (userId: string, email: string, userMetadata?: any): Promise<ApiResponse> => {
    try {
      const tenantData = await profileSyncUtils.getOppositeProfileData(userId, 'landlord');
      const profileData = createLandlordProfileData(userId, email, userMetadata);

      if (tenantData) {
        Object.assign(profileData, {
          full_name: tenantData.full_name || profileData.full_name,
          phone: tenantData.phone || profileData.phone,
          image_url: tenantData.image_url || profileData.image_url,
          address: tenantData.address || profileData.address,
        });
        console.log('✅ Inherited profile data from tenant profile');
      }

      const url = `${getApiBaseUrl()}/api/landlords`;
      console.log('Creating landlord profile:', { userId, email });
      const response = await apiFetch(url, {
        method: 'POST',
        body: JSON.stringify(profileData),
      });

      console.log('Landlord profile created successfully:', response);
      return { success: true, data: response };
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 400 && error.data?.message?.includes('already exists')) {
          console.log('Landlord profile already exists - this is fine');
          return { success: true, alreadyExists: true };
        }
        if (error.status === 409) {
          console.log('Landlord profile already exists (409) - this is fine');
          return { success: true, alreadyExists: true };
        }
      }
      console.error('Error creating landlord profile:', error);
      throw error;
    }
  },

  getById: async (landlordId: string): Promise<ApiResponse> => {
    try {
      const url = `${getApiBaseUrl()}/api/landlords/${landlordId}`;
      const response = await cachedApiFetch(url, {}, 600000);
      return { success: true, data: response };
    } catch (error) {
      console.error('Error fetching landlord profile:', error);
      throw error;
    }
  },

  update: async (landlordId: string, profileData: Partial<LandlordProfileData>, skipSync = false): Promise<ApiResponse> => {
    try {
      const url = `${getApiBaseUrl()}/api/landlords/${landlordId}`;
      const response = await apiFetch(url, {
        method: 'PUT',
        body: JSON.stringify(profileData),
      });

      cache.delete(`${getApiBaseUrl()}/api/landlords/${landlordId}-{}`);

      if (!skipSync) {
        const { documents, ...commonFields } = profileData;
        await profileSyncUtils.syncProfiles(landlordId, 'landlord', commonFields);
      }

      return { success: true, data: response };
    } catch (error) {
      console.error('Error updating landlord profile:', error);
      throw error;
    }
  },

  getListings: async (landlordId: string): Promise<ApiResponse> => {
    try {
      const url = `${getApiBaseUrl()}/api/landlords/${landlordId}/listings`;
      const response = await cachedApiFetch(url, {}, 300000);
      return { success: true, data: response };
    } catch (error) {
      console.error('Error fetching landlord listings:', error);
      throw error;
    }
  },
};

// Profile utility functions
export const profileUtils = {
  createForRole: async (role: 'tenant' | 'landlord', userId: string, email: string, userMetadata?: any): Promise<ApiResponse> => {
    if (role === 'tenant') {
      return tenantApi.create(userId, email, userMetadata);
    } else if (role === 'landlord') {
      return landlordApi.create(userId, email, userMetadata);
    } else {
      throw new Error(`Invalid role: ${role}`);
    }
  },

  getForRole: async (role: 'tenant' | 'landlord', userId: string): Promise<ApiResponse> => {
    if (role === 'tenant') {
      return tenantApi.getById(userId);
    } else if (role === 'landlord') {
      return landlordApi.getById(userId);
    } else {
      throw new Error(`Invalid role: ${role}`);
    }
  },
};

// Health check
export const healthApi = {
  check: async (): Promise<ApiResponse> => {
    try {
      const url = `${getApiBaseUrl()}/api/health`;
      const response = await apiFetch(url);
      return { success: true, data: response };
    } catch (error) {
      console.error('Health check failed:', error);
      throw error;
    }
  },
};

// Image upload utility functions
export const imageUtils = {
  uploadProfileImage: async (file: File, userId: string): Promise<string> => {
    const { supabase } = await import('@/lib/supabaseClient');

    if (!file.type.startsWith('image/')) {
      throw new Error('Please upload an image file.');
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Please upload an image smaller than 5MB.');
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}_${Date.now()}.${fileExt}`;
    const filePath = `profile-images/${fileName}`;

    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

    if (bucketsError) {
      throw new Error("Failed to check storage buckets");
    }

    const profileBucket = buckets.find(b => b.name === 'profile-images');
    if (!profileBucket) {
      const { error: createBucketError } = await supabase.storage.createBucket('profile-images', {
        public: true,
        allowedMimeTypes: ['image/*'],
        fileSizeLimit: 5242880,
      });

      if (createBucketError) {
        console.error('Error creating profile-images bucket:', createBucketError);
        throw new Error("Failed to create storage bucket for profile images");
      }
    }

    const { error: uploadError } = await supabase.storage
      .from('profile-images')
      .upload(filePath, file, { cacheControl: '3600', upsert: true });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage.from('profile-images').getPublicUrl(filePath);

    return data.publicUrl;
  },

  deleteProfileImage: async (imageUrl: string): Promise<void> => {
    const { supabase } = await import('@/lib/supabaseClient');

    const urlParts = imageUrl.split('/');
    const bucketIndex = urlParts.findIndex(part => part === 'profile-images');
    if (bucketIndex === -1) return;

    const filePath = urlParts.slice(bucketIndex + 1).join('/');

    const { error } = await supabase.storage.from('profile-images').remove([`profile-images/${filePath}`]);

    if (error) {
      console.error('Error deleting image:', error);
    }
  },
};

// Document upload utility functions
export const documentUtils = {
  uploadDocument: async (file: File, userId: string, documentType: string): Promise<string> => {
    const { supabase } = await import('@/lib/supabaseClient');

    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (!allowedTypes.includes(file.type)) {
      throw new Error('Please upload a PDF, image, or Word document.');
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new Error('Please upload a document smaller than 10MB.');
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}_${documentType}_${Date.now()}.${fileExt}`;
    const filePath = `documents/${fileName}`;

const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

    if (bucketsError) {
      throw new Error("Failed to check storage buckets");
    }

    const documentsBucket = buckets.find(b => b.name === 'documents');
    if (!documentsBucket) {
      const { error: createBucketError } = await supabase.storage.createBucket('documents', {
        public: false,
      });

      if (createBucketError) {
        console.error('Error creating documents bucket:', createBucketError);
        throw new Error("Failed to create storage bucket for documents");
      }
    }

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file, { cacheControl: '3600', upsert: true });

    if (uploadError) {
      throw uploadError;
    }

    return filePath;
  },

  deleteDocument: async (filePath: string): Promise<void> => {
    const { supabase } = await import('@/lib/supabaseClient');

    const { error } = await supabase.storage.from('documents').remove([filePath]);

    if (error) {
      console.error('Error deleting document:', error);
    }
  },
};

// Lease API
export const getLeasesForTenant = async (tenantId: string) => {
  const url = `${getApiBaseUrl()}/api/leases/tenant/${tenantId}`;
  return apiFetch(url);
};

export const getLeaseById = async (leaseId: string) => {
  const url = `${getApiBaseUrl()}/api/leases/${leaseId}`;
  return apiFetch(url);
};

export const uploadSignedLease = async (leaseId: string, file: File) => {
  const url = `${getApiBaseUrl()}/api/leases/${leaseId}/upload`;
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.message || 'Failed to upload signed lease');
  }
  return response.json();
};

export const getListingById = async (listingId: string) => {
  const url = `${getApiBaseUrl()}/api/listings/${listingId}`;
  return apiFetch(url);
};

// Fetch lease history for a tenant and a property
export const getLeaseHistoryForTenantAndListing = async (tenantId: string, listingId: string | number) => {
  const url = `${getApiBaseUrl()}/api/leases/history?tenantId=${tenantId}&listingId=${listingId}`;
  return apiFetch(url);
};

// Get notification summary (all notifications in one request)
export const getNotificationSummary = async (userId: string, userType: 'tenant' | 'landlord') => {
  try {
    const response = await apiFetch(`${getApiBaseUrl()}/api/notifications/summary/${userId}/${userType}`);
    return response;
  } catch (error) {
    console.error('Error fetching notification summary:', error);
    throw error;
  }
};