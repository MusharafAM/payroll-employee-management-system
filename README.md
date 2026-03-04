# Payroll Management System

A full-stack payroll management system that automates employee salary calculation, attendance tracking, and payslip generation for companies in Sri Lanka.

---

## Features

- **Role-based access** — Admin, Manager, and Employee roles with protected routes
- **Excel attendance upload** — Parses NGTimereport `.xlsx` timecards (32+ employees, split shifts, lunch-hour deduction logic)
- **Automated salary calculation** — Regular pay, overtime, EPF/ETF deductions, allowances, and bonuses
- **PDF payslip generation** — Downloadable payslips per employee per month
- **Employee management** — Full CRUD with salary profile configuration per employee
- **Admin-configurable payroll rules** — Overtime multiplier, holiday pay, EPF/ETF rates via settings panel
- **SSO authentication** — WSO2 Asgardeo (OIDC) with opaque token verification

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Go 1.21, Gin, GORM |
| Database | PostgreSQL (Supabase) via PgBouncer |
| Auth | WSO2 Asgardeo (OIDC / OAuth2) |
| Frontend | React 18, TypeScript, Vite |
| UI | TailwindCSS, shadcn/ui |
| HTTP Client | Axios with interceptors |

---

## Architecture

```
frontend/          React + TypeScript SPA
  src/
    pages/         Dashboard, Login
    hooks/         useApi (authenticated axios)
    lib/           api.ts (TypeScript interfaces + axios factory)
    components/    shadcn/ui components

backend/           Go REST API
  cmd/server/      Entry point
  handlers/        auth, employee, attendance, payroll_settings
  models/          User, SalaryProfile, PayrollSettings, Attendance, Payroll
  middleware/       AuthMiddleware (Asgardeo userinfo endpoint)
  database/        GORM + PgBouncer connection
  routes/          Gin router setup
  services/        Payroll calculation (in progress)
```

---

## Database Schema

| Table | Purpose |
|---|---|
| `users` | Identity: name, email, role, department |
| `salary_profiles` | Compensation: rates, allowances, bonuses per employee |
| `payroll_settings` | Admin-configurable rules: OT multiplier, EPF/ETF rates |
| `attendances` | Daily attendance with regular/overtime hours |
| `payrolls` | Monthly payslip records |

---

## Getting Started

### Prerequisites
- Go 1.21+
- Node.js 18+
- PostgreSQL (or a Supabase project)
- WSO2 Asgardeo account

### Backend

```bash
cd backend
cp .env.example .env
# Fill in your DATABASE_URL and ASGARDEO_BASE_URL
go run cmd/server/main.go
```

### Frontend

```bash
cd frontend
cp .env.example .env
# Fill in your VITE_ASGARDEO_CLIENT_ID and VITE_ASGARDEO_BASE_URL
npm install
npm run dev
```

---

## API Endpoints

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/auth/sync-user` | Authenticated | Create/sync user on login |
| GET | `/api/auth/me` | Authenticated | Current user with salary profile |
| GET | `/api/employees` | Manager+ | All employees with salary profiles |
| POST | `/api/employees` | Admin | Create employee + salary profile |
| PUT | `/api/employees/:id` | Admin | Update employee or salary profile |
| POST | `/api/attendance/upload` | Admin | Upload NGTimereport Excel file |
| GET | `/api/attendance/employee/:id` | Authenticated | Employee attendance by month |
| GET | `/api/payroll-settings` | Manager+ | Payroll configuration rules |
| PUT | `/api/payroll-settings/:key` | Admin | Update a payroll rule |

---

## Status

| Feature | Status |
|---|---|
| Auth (Asgardeo SSO) | Done |
| Employee management | Done |
| Attendance upload (Excel) | Done |
| Payroll calculation | In progress |
| PDF payslip generation | Planned |
| Admin dashboard UI | Planned |
| Employee dashboard UI | Planned |
| Deployment | Planned |

---

## License

MIT
