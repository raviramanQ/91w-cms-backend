# 91Wheels CMS Backend

Node.js/Express backend API for 91Wheels Content Management System.

## Features

- RESTful API architecture
- JWT-based authentication
- Role-based access control (RBAC)
- MySQL database integration
- AWS S3 file upload support
- PHP password compatibility for legacy system migration

## Prerequisites

- Node.js 16+ and npm
- MySQL database
- AWS S3 account (for file uploads)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
   - Copy `.env` file and update with your credentials
   - Update database connection details
   - Set JWT secret key
   - Configure AWS S3 credentials

3. Start the server:

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will start on `http://localhost:5000` by default.

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user info

### Vehicle Makes
- `GET /api/vehicle-makes` - Get all vehicle makes (paginated)
- `GET /api/vehicle-makes/:id` - Get single vehicle make
- `POST /api/vehicle-makes` - Create vehicle make
- `PUT /api/vehicle-makes/:id` - Update vehicle make
- `DELETE /api/vehicle-makes/:id` - Delete vehicle make

### Vehicle Types
- `GET /api/vehicle-types` - Get all vehicle types
- `GET /api/vehicle-types/public` - Get vehicle types (public, for dropdowns)
- `GET /api/vehicle-types/:id` - Get single vehicle type
- `POST /api/vehicle-types` - Create vehicle type
- `PUT /api/vehicle-types/:id` - Update vehicle type
- `DELETE /api/vehicle-types/:id` - Delete vehicle type

### Users
- `GET /api/users` - Get all users (paginated)
- `GET /api/users/:id` - Get single user
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Roles
- `GET /api/roles` - Get all roles

### Upload
- `POST /api/upload` - Upload file to S3

## Authentication

All protected endpoints require authentication via JWT token. The token can be sent in two ways:

1. **Cookie**: `auth-token` cookie (set automatically on login)
2. **Header**: `Authorization: Bearer <token>`

## Permissions

Most endpoints require specific permissions based on the user's role:
- Format: `module:action`
- Example: `vehicle-makes:read`, `users:create`

Admin and superadmin roles bypass permission checks.

## Project Structure

```
91w-cms-backend/
├── config/
│   └── database.js          # Database configuration
├── middleware/
│   └── auth.js              # Authentication & authorization middleware
├── routes/
│   ├── auth.js              # Authentication routes
│   ├── vehicleMakes.js      # Vehicle makes CRUD
│   ├── vehicleTypes.js      # Vehicle types CRUD
│   ├── users.js             # User management
│   ├── roles.js             # Roles endpoints
│   └── upload.js            # File upload
├── utils/
│   ├── jwt.js               # JWT utilities
│   └── phpPasswordCompat.js # PHP password compatibility
├── .env                     # Environment variables
├── .gitignore
├── package.json
├── server.js                # Main server file
└── README.md
```

## Environment Variables

```env
PORT=5000
NODE_ENV=development

# Database
DB_HOST=your-db-host
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_NAME=your-db-name

# JWT
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=7d

# AWS S3
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=your-region
AWS_S3_BUCKET=your-bucket-name

# CORS
FRONTEND_URL=http://localhost:3001
```

## Development

The backend uses:
- **Express.js** - Web framework
- **MySQL2** - Database driver
- **JWT** - Authentication tokens
- **Multer** - File upload handling
- **AWS SDK** - S3 integration
- **CORS** - Cross-origin resource sharing

## Security

- Passwords are encrypted using PHP-compatible AES-256-CBC encryption
- JWT tokens expire after 7 days (configurable)
- CORS is configured to only allow requests from the frontend URL
- All sensitive routes require authentication
- Role-based permissions control access to resources
