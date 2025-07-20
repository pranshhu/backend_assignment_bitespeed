# Bitespeed Identity Reconciliation

Simple identity reconciliation service for linking customer contacts based on shared email or phone number.

## 🌐 Live Demo

**API Base URL:** https://bitespeed-identity-service-i9oa.onrender.com

**Quick Test:**
```bash
curl -X POST https://bitespeed-identity-service-i9oa.onrender.com/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "phoneNumber": "123456"}'
```

## Quick Start

```bash
# Using Docker (Recommended)
docker-compose up --build

# Test the API
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "phoneNumber": "123456"}'
```

## API Endpoints

### POST `/identify`

Main endpoint for identity reconciliation. Links contacts based on shared email or phone number.

**Request:**
```json
{
  "email": "customer@example.com",     // optional
  "phoneNumber": "1234567890"          // optional
}
```

**Response:**
```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["customer@example.com"],
    "phoneNumbers": ["1234567890"],
    "secondaryContactIds": []
  }
}
```

**Status Codes:**
- `200` - Success
- `400` - Validation Error (missing email and phoneNumber)
- `500` - Internal Server Error

### GET `/health`

Health check endpoint.

**Response:**
```json
{
  "status": "OK"
}
```

## Test Scenarios

### Scenario 1: Create New Primary Contact

```bash
# Local
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "lorraine@hillvalley.edu", "phoneNumber": "123456"}'

# Live Demo
curl -X POST https://bitespeed-identity-service-i9oa.onrender.com/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "lorraine@hillvalley.edu", "phoneNumber": "123456"}'
```

**Expected Response:**
```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["lorraine@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": []
  }
}
```

### Scenario 2: Link Contact with Same Phone, Different Email

```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "mcfly@hillvalley.edu", "phoneNumber": "123456"}'
```

**Expected Response:**
```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["lorraine@hillvalley.edu", "mcfly@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [2]
  }
}
```

### Scenario 3: Query with Existing Email Only

```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "lorraine@hillvalley.edu"}'
```

**Expected Response:**
```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["lorraine@hillvalley.edu", "mcfly@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [2]
  }
}
```

### Scenario 4: Query with Existing Phone Only

```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "123456"}'
```

**Expected Response:** Same as Scenario 3

### Scenario 5: Create Another Primary Contact

```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "george@hillvalley.edu", "phoneNumber": "919191"}'
```

**Expected Response:**
```json
{
  "contact": {
    "primaryContatctId": 3,
    "emails": ["george@hillvalley.edu"],
    "phoneNumbers": ["919191"],
    "secondaryContactIds": []
  }
}
```

### Scenario 6: Create Yet Another Primary Contact

```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "biffsucks@hillvalley.edu", "phoneNumber": "717171"}'
```

**Expected Response:**
```json
{
  "contact": {
    "primaryContatctId": 4,
    "emails": ["biffsucks@hillvalley.edu"],
    "phoneNumbers": ["717171"],
    "secondaryContactIds": []
  }
}
```

### Scenario 7: Merge Two Primary Contacts

This request links the two separate primary contacts created above:

```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "george@hillvalley.edu", "phoneNumber": "717171"}'
```

**Expected Response:**
```json
{
  "contact": {
    "primaryContatctId": 3,
    "emails": ["george@hillvalley.edu", "biffsucks@hillvalley.edu"],
    "phoneNumbers": ["919191", "717171"],
    "secondaryContactIds": [4]
  }
}
```

### Scenario 8: Error Cases

**No email or phone provided:**
```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected Response:**
```json
{
  "error": "Either email or phoneNumber is required"
}
```

## Automated Testing

### Option 1: Simple Test Script

```bash
# Start the server first
node app.js

# In another terminal, run the test
node test.js
```

### Option 2: In-Memory Test (No Database Required)

```bash
# Run the in-memory test server
node simple-test.js

# Test all scenarios manually or run:
curl -X POST http://localhost:3001/identify -H "Content-Type: application/json" -d '{"email": "test@example.com", "phoneNumber": "123456"}'
curl -X POST http://localhost:3001/identify -H "Content-Type: application/json" -d '{"email": "test2@example.com", "phoneNumber": "123456"}'
curl http://localhost:3001/debug  # See all contacts
```

## Local Development

### Prerequisites
- Node.js 18+
- PostgreSQL 12+ (or use Docker)

### Setup

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Start the server
node app.js
```

### Database Schema

The system uses a PostgreSQL table with the following structure:

```sql
CREATE TABLE "contacts" (
    "id" SERIAL PRIMARY KEY,
    "phone_number" TEXT,
    "email" TEXT,
    "linked_id" INTEGER REFERENCES "contacts"("id"),
    "link_precedence" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3)
);
```

**Indexes:**
- `contacts_email_idx` on `email`
- `contacts_phone_number_idx` on `phone_number`
- `contacts_linked_id_idx` on `linked_id`

## How It Works

1. **New Contact**: If no existing contacts match email/phone → create primary contact
2. **Link Existing**: If contact shares email/phone with existing → create secondary contact
3. **Merge Primaries**: If request links two primary contacts → convert newer to secondary
4. **Consolidate**: Return all linked emails, phones, and secondary contact IDs

## Verification

### Health Check
```bash
# Local
curl http://localhost:3000/health

# Live Demo
curl https://bitespeed-identity-service-i9oa.onrender.com/health

# Expected: {"status":"OK"}
```

### Complete Test Flow
```bash
# 1. Create first contact
curl -X POST http://localhost:3000/identify -H "Content-Type: application/json" -d '{"email":"test1@example.com","phoneNumber":"123"}'

# 2. Link with same phone
curl -X POST http://localhost:3000/identify -H "Content-Type: application/json" -d '{"email":"test2@example.com","phoneNumber":"123"}'

# 3. Verify linking worked
curl -X POST http://localhost:3000/identify -H "Content-Type: application/json" -d '{"phoneNumber":"123"}'
# Should return both emails linked to primary contact
```

## Docker Deployment

```bash
# Build and start services
docker-compose up --build

# View logs
docker-compose logs app
docker-compose logs postgres

# Stop services
docker-compose down
```

The Docker setup includes:
- PostgreSQL database with persistent volume
- Node.js application with automatic migration
- Proper service dependencies and networking
