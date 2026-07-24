# ARALert — Student Performance Monitoring & Early Academic Risk Detection

Sprint 1: Authentication Foundation

## Tech Stack

| Layer    | Technology                                      |
| -------- | ----------------------------------------------- |
| Backend  | Django 6, Django REST Framework, SimpleJWT       |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4     |
| Database | PostgreSQL 18                                   |

## Prerequisites

- Python 3.12+
- Node.js 20+
- PostgreSQL 18 running locally
- A database named `aralert` (or update `.env`)

## Quick Start

### 1. Backend

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate (Windows)
.\venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy env template and configure
# Edit backend/.env with your PostgreSQL credentials

# Run migrations
python manage.py makemigrations accounts
python manage.py migrate

# Seed initial users
python manage.py seed

# Start the server
python manage.py runserver 8000
```

### 2. Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start dev server (proxies /api → localhost:8000)
npm run dev
```

The frontend runs on **http://localhost:5173** and the backend on **http://localhost:8000**.

## Seed Credentials

| Role        | Username         | Password          |
| ----------- | ---------------- | ----------------- |
| SuperAdmin  | `superadmin`     | `SuperAdmin@123!` |
| Admin       | `admin_user`     | `Admin@123!`      |
| Principal   | `principal_user` | `Principal@123!`  |
| Faculty     | `faculty_user`   | `Faculty@123!`    |
| Tutor       | `tutor_user`     | `Tutor@123!`      |
| Student     | `student_user`   | `Student@123!`    |

## API Endpoints

### Auth

| Method | Endpoint              | Description               |
| ------ | --------------------- | ------------------------- |
| POST   | `/api/auth/login/`    | Login (JWT)               |
| POST   | `/api/auth/logout/`   | Logout (blacklist token)  |
| POST   | `/api/auth/refresh/`  | Refresh access token      |
| GET    | `/api/profile/`       | Get authenticated profile |

### User Management (SuperAdmin only)

| Method | Endpoint                           | Description          |
| ------ | ---------------------------------- | -------------------- |
| GET    | `/api/users/`                      | List users           |
| POST   | `/api/users/`                      | Create user          |
| GET    | `/api/users/{id}/`                 | Get user             |
| PATCH  | `/api/users/{id}/`                 | Update user          |
| PATCH  | `/api/users/{id}/activate/`        | Activate user        |
| PATCH  | `/api/users/{id}/deactivate/`      | Deactivate user      |
| POST   | `/api/users/{id}/reset-password/`  | Reset password       |
| GET    | `/api/users/stats/`                | Dashboard statistics |

## Frontend Routes

| Path                          | Access      | Description              |
| ----------------------------- | ----------- | ------------------------ |
| `/`                           | Public      | Landing page             |
| `/login`                      | Public      | Login                    |
| `/superadmin`                 | SuperAdmin  | Dashboard                |
| `/superadmin/users`           | SuperAdmin  | User management          |
| `/superadmin/users/create`    | SuperAdmin  | Create user              |
| `/superadmin/users/edit/:id`  | SuperAdmin  | Edit user                |
| `/superadmin/profile`         | SuperAdmin  | Profile                  |
| `/superadmin/settings`        | SuperAdmin  | Settings                 |
| `/admin`                      | Admin       | Placeholder              |
| `/principal`                  | Principal   | Placeholder              |
| `/faculty`                    | Faculty     | Placeholder              |
| `/tutor`                      | Tutor       | Placeholder              |
| `/student`                    | Student     | Placeholder              |
| `/403`                        | Any         | Forbidden                |
| `/404`                        | Any         | Not found                |

## Project Structure

```
ARALert/
├── backend/
│   ├── config/             # Django settings, urls
│   ├── apps/accounts/      # Custom User model
│   ├── api/auth/           # Auth endpoints
│   ├── api/users/          # User CRUD endpoints
│   ├── middleware/          # Role middleware
│   ├── permissions/        # RBAC permission classes
│   ├── services/           # Business logic layer
│   └── utilities/          # Helpers, exception handler
├── frontend/
│   └── src/
│       ├── api/            # Axios instance
│       ├── context/        # AuthContext
│       ├── hooks/          # useAuth
│       ├── layouts/        # Public, Auth, Dashboard
│       ├── pages/          # All page components
│       ├── routes/         # AppRouter, ProtectedRoute
│       ├── services/       # authService, userService
│       └── types/          # TypeScript interfaces
├── .env.example
└── README.md
```
