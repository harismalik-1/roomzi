import { http, HttpResponse } from 'msw';

const API_BASE = `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api`;

export const handlers = [
  // Landlord endpoints
  http.get(`${API_BASE}/landlords/:id`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        id: 'test-landlord-id',
        full_name: 'Test Landlord',
        email: 'landlord@test.com',
        phone: '+1234567890',
        image_url: 'https://test.com/image.jpg',
        address: '123 Test St',
        documents: [],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    });
  }),

  http.post(`${API_BASE}/landlords`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        id: 'test-landlord-id',
        full_name: 'Test Landlord',
        email: 'landlord@test.com',
      },
    }, { status: 201 });
  }),

  http.put(`${API_BASE}/landlords/:id`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        id: 'test-landlord-id',
        full_name: 'Updated Landlord',
        email: 'landlord@test.com',
      },
    });
  }),

  // Tenant endpoints
  http.get(`${API_BASE}/tenants/:id`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        id: 'test-tenant-id',
        full_name: 'Test Tenant',
        email: 'tenant@test.com',
        phone: '+1234567890',
        image_url: 'https://test.com/image.jpg',
        address: '456 Test Ave',
        documents: [],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    });
  }),

  http.post(`${API_BASE}/tenants`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        id: 'test-tenant-id',
        full_name: 'Test Tenant',
        email: 'tenant@test.com',
      },
    }, { status: 201 });
  }),

  // Listings endpoints
  http.get(`${API_BASE}/listings`, () => {
    return HttpResponse.json({
      success: true,
      data: [
        {
          id: '1',
          title: 'Test Listing',
          type: 'Apartment',
          address: '789 Test Blvd',
          city: 'Test City',
          state: 'TS',
          zip_code: '12345',
          bedrooms: 2,
          bathrooms: 1,
          area: 900,
          price: 2500,
          description: 'Test description',
          amenities: ['Parking', 'Gym'],
          landlord_name: 'Test Landlord',
          available: true,
        },
      ],
      pagination: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      },
    });
  }),

  http.get(`${API_BASE}/listings/:id`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        id: '1',
        title: 'Test Listing',
        type: 'Apartment',
        address: '789 Test Blvd',
        city: 'Test City',
        state: 'TS',
        zip_code: '12345',
        bedrooms: 2,
        bathrooms: 1,
        area: 900,
        price: 2500,
        description: 'Test description',
        amenities: ['Parking', 'Gym'],
        landlord_name: 'Test Landlord',
        available: true,
      },
    });
  }),

  http.post(`${API_BASE}/listings`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        id: '2',
        title: 'New Test Listing',
        type: 'House',
        price: 3000,
      },
    }, { status: 201 });
  }),

  // Chat endpoints
  http.get(`${API_BASE}/chats/user/:userId/:userType`, () => {
    return HttpResponse.json({
      success: true,
      data: [
        {
          id: 'chat-1',
          tenant_id: 'test-tenant-id',
          landlord_id: 'test-landlord-id',
          property_id: '1',
          tenantName: 'Test Tenant',
          landlordName: 'Test Landlord',
          propertyTitle: 'Test Property',
          messages: [
            {
              id: 'msg-1',
              content: 'Hello!',
              sender_type: 'tenant',
              created_at: '2024-01-01T00:00:00Z',
            },
          ],
        },
      ],
    });
  }),

  http.post(`${API_BASE}/chats`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        id: 'new-chat-id',
        tenant_id: 'test-tenant-id',
        landlord_id: 'test-landlord-id',
        property_id: '1',
      },
    }, { status: 201 });
  }),

  http.post(`${API_BASE}/chats/messages`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        id: 'new-message-id',
        chat_id: 'chat-1',
        sender_id: 'test-tenant-id',
        content: 'New message',
        sender_type: 'tenant',
        created_at: '2024-01-01T00:00:00Z',
      },
    }, { status: 201 });
  }),

  // Payment endpoints
  http.get(`${API_BASE}/payments/tenant/:tenantId`, () => {
    return HttpResponse.json({
      success: true,
      data: [
        {
          id: 1,
          amount: 2500,
          status: 'Approved',
          date: '2024-01-01T00:00:00Z',
          tenantId: 'test-tenant-id',
          listingId: '1',
        },
      ],
    });
  }),

  http.post(`${API_BASE}/payments`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        id: 2,
        amount: 2500,
        status: 'Pending',
        date: '2024-01-01T00:00:00Z',
      },
    }, { status: 201 });
  }),

  // Error handlers
  http.get(`${API_BASE}/error`, () => {
    return HttpResponse.json({
      success: false,
      message: 'Test error',
    }, { status: 500 });
  }),
]; 