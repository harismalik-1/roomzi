# Backend Deployment Guide

## Environment Variables Required

Set these environment variables in your Railway backend service:

### Database (Required)
- `DATABASE_URL` - PostgreSQL connection string from Supabase
  - Format: `postgresql://postgres.[pool_mode]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`
  - Get from Supabase Dashboard → Settings → Database → Connection string → URI (pooled)
- `DIRECT_URL` - Direct PostgreSQL connection string from Supabase (for migrations)
  - Format: `postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres`
  - Get from Supabase Dashboard → Settings → Database → Connection string → URI (direct)

### Supabase (Required)
- `SUPABASE_URL` - Your Supabase project URL
  - Format: `https://[project-ref].supabase.co`
  - Get from Supabase Dashboard → Settings → API → Project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (has admin privileges)
  - Get from Supabase Dashboard → Settings → API → Project API keys → service_role (secret)
  - ⚠️ **Important**: Use service_role key, NOT anon key (backend needs admin access)

### Application (Required)
- `NODE_ENV` - Set to "production"
- `PORT` - Port number (Railway will set this automatically to 3001)
- `FRONTEND_URL` - URL of your deployed frontend service (for CORS)
  - Format: `https://your-frontend-service.railway.app`
  - Get from Railway dashboard after frontend deployment

### Optional Services
- `OPENAI_API_KEY` - OpenAI API key for AI chat features (optional)
  - Get from OpenAI Dashboard → API Keys
  - Format: `sk-...`

## Deployment Steps

1. **Create a new Railway service** for the backend
   - Go to Railway dashboard → New Project → Deploy from GitHub repo
   - Select your repository

2. **Configure service settings**
   - Set **Root Directory** to `backend/` in service settings
   - Railway will automatically detect the Dockerfile

3. **Add all required environment variables** in Railway dashboard
   - Go to service → Variables tab
   - Add each environment variable listed above
   - ⚠️ **Critical**: Make sure to use the correct Supabase keys (service_role, not anon)

4. **Set up database connection**
   - Use Supabase PostgreSQL (not Railway's built-in Postgres)
   - Copy connection strings exactly from Supabase dashboard
   - Use pooled connection for `DATABASE_URL` and direct for `DIRECT_URL`

5. **Deploy and monitor**
   - Railway will automatically build and deploy
   - Monitor deployment logs for any errors
   - Check health endpoint: `https://your-backend-service.railway.app/api/health`

## Database Setup

After deployment, you may need to run Prisma migrations:

```bash
# In Railway service dashboard, go to "Variables" and add a deployment script
npx prisma migrate deploy
```

Or run manually via Railway CLI:
```bash
railway run npx prisma migrate deploy
```

## Health Check

The service includes a health check endpoint at `/api/health` that verifies:
- Database connectivity
- Environment configuration
- Service status

## CORS Configuration

The backend is configured to accept requests from:
- Your production frontend URL (`FRONTEND_URL` environment variable)
- Local development URLs (localhost:8080-8099)

Make sure to set `FRONTEND_URL` to your deployed frontend URL for proper CORS handling.