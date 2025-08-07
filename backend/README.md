# Driven Devs Backend

Backend API for the Driven Devs housing platform, built with Express.js, Prisma ORM, and Supabase PostgreSQL.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: Supabase PostgreSQL
- **ORM**: Prisma
- **Language**: JavaScript (ES Modules)

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Copy the template and configure your environment variables:

```bash
cp config.template.env .env
```

Edit `.env` and fill in your Supabase credentials:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here

# Database URLs
DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
DIRECT_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
```

### 3. Database Setup

Pull the current schema from your database:

```bash
npm run db:pull
```

Generate the Prisma client:

```bash
npm run db:generate
```

Seed the database with sample data:

```bash
npm run db:seed
```

### 4. Start the Server

Development mode with hot reload:

```bash
npm run dev
```

Production mode:

```bash
npm start
```

## Available Scripts

- `npm run dev` - Start development server with nodemon
- `npm start` - Start production server
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema changes to database
- `npm run db:pull` - Pull schema from database
- `npm run db:migrate` - Create and run migrations
- `npm run db:reset` - Reset database and run migrations
- `npm run db:studio` - Open Prisma Studio (database GUI)
- `npm run db:seed` - Seed database with sample data

## API Endpoints

### Landlords

- `GET /api/landlords` - Get all landlords
- `GET /api/landlords/:id` - Get landlord by ID
- `POST /api/landlords` - Create new landlord
- `PUT /api/landlords/:id` - Update landlord
- `DELETE /api/landlords/:id` - Delete landlord
- `GET /api/landlords/:id/listings` - Get landlord's listings

### Tenants

- `GET /api/tenants` - Get all tenants
- `GET /api/tenants/:id` - Get tenant by ID
- `POST /api/tenants` - Create new tenant
- `PUT /api/tenants/:id` - Update tenant
- `DELETE /api/tenants/:id` - Delete tenant

### Listings

- `GET /api/listings` - Get all listings (with filtering and pagination)
- `GET /api/listings/:id` - Get listing by ID
- `POST /api/listings` - Create new listing
- `PUT /api/listings/:id` - Update listing
- `DELETE /api/listings/:id` - Delete listing
- `GET /api/listings/landlord/:landlordId` - Get landlord's listings
- `GET /api/listings/tenant/:tenantId` - Get tenant's listings

### Chats & Messages

- `GET /api/chats/user/:userId/:userType` - Get all chats for a user (userType: 'tenant' or 'landlord')
- `GET /api/chats/:id` - Get chat by ID with all messages
- `POST /api/chats` - Create new chat
- `DELETE /api/chats/:id` - Delete chat
- `GET /api/chats/:chatId/messages` - Get messages for a chat
- `POST /api/chats/messages` - Send a message

### Query Parameters for Listings

```
GET /api/listings?page=1&limit=10&city=San Francisco&minPrice=2000&maxPrice=5000&bedrooms=2&type=Apartment&available=true
```

- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)
- `city` - Filter by city
- `state` - Filter by state
- `type` - Filter by property type (Apartment, House, Studio, etc.)
- `minPrice` - Minimum price filter
- `maxPrice` - Maximum price filter
- `bedrooms` - Minimum bedrooms
- `bathrooms` - Minimum bathrooms
- `available` - Filter by availability (true/false, default: true)

### Health Check

- `GET /api/health` - Server health status

## Database Schema

The database includes the following models:

- **landlord_profiles** - Landlord accounts with profile information
- **tenant_profiles** - Tenant accounts with profile information
- **listings** - Property listings with details, pricing, and availability
- **chats** - Chat conversations between tenants and landlords
- **messages** - Individual messages within chats

## Request/Response Examples

### Create Landlord

```json
POST /api/landlords
{
  "id": "uuid-here",
  "full_name": "John Smith",
  "email": "john@example.com",
  "phone": "555-0123",
  "image_url": "https://example.com/photo.jpg",
  "address": "123 Main St, San Francisco, CA"
}
```

### Create Listing

```json
POST /api/listings
{
  "landlord_id": "uuid-here",
  "title": "Cozy 2BR Apartment",
  "type": "Apartment",
  "address": "123 Main St",
  "city": "San Francisco",
  "state": "CA",
  "zip_code": "94102",
  "bedrooms": 2,
  "bathrooms": 1,
  "area": 900.0,
  "price": 2500.0,
  "description": "Beautiful apartment with city views",
  "lease_type": "12 months",
  "amenities": ["In-unit laundry", "Gym", "Roof deck"],
  "requirements": "Good credit score, stable income",
  "house_rules": "No smoking, quiet hours after 10 PM",
  "images": "[\"url1\", \"url2\"]",
  "coordinates": "37.7749,-122.4194",
  "available": true
}
```

### Send Message

```json
POST /api/chats/messages
{
  "chat_id": "uuid-here",
  "sender_id": "uuid-here",
  "content": "Hi! Is this property still available?",
  "sender_type": "tenant"
}
```

## Architecture

- **Controllers** - Handle business logic and database operations using Prisma
- **Routes** - Define API endpoints and middleware
- **Config** - Database and service configurations (Prisma + Supabase)
- **Utils** - Helper functions and response formatters
- **Middleware** - Error handling and request processing

## Prisma Commands

You can also run Prisma commands directly:

```bash
# Export node_modules bin to PATH (for current session)
export PATH="$PATH:./node_modules/.bin"

# Then use Prisma CLI directly
prisma studio
prisma generate
prisma db push
prisma db pull
```

## Development

The server includes:

- CORS configuration for frontend integration
- Error handling middleware
- Request logging (in development)
- Graceful shutdown handling
- Connection pooling with Prisma
- BigInt to String conversion for JSON serialization

## Special Notes

- Listing IDs are BigInt in the database and converted to strings for JSON responses
- Images are stored as JSON strings in the database
- Chat messages support both 'tenant' and 'landlord' sender types
- The schema includes row-level security (RLS) for the listings table

## Deployment

For detailed deployment instructions to Railway, see [DEPLOYMENT.md](./DEPLOYMENT.md).

For local deployment, make sure to set the environment variables and run:

```bash
npm run db:generate
npm start
```
