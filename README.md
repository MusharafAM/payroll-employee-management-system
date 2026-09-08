# Payroll & Employee Management System

A full-stack payroll and HR management system that automates employee salary calculation, attendance tracking, payslip generation, and HR workflows for companies in Sri Lanka.

---

## Features

- **Role-based access** — Admin, Manager, and Employee roles with protected routes
- **Excel / XML attendance upload** — Parses NGTimereport `.xlsx` and biometric XML SpreadsheetML timecards (32+ employees, split shifts, lunch-hour deduction logic)
- **Automated payroll calculation** — Regular pay, overtime, EPF/ETF, allowances, bonuses, advances/loans, holiday pay — fully configuration-driven per company rules
- **PDF payslip generation** — Downloadable payslips per employee per month
- **Email payslip delivery** — Send payslips directly to employees via email
- **Employee management** — Full CRUD with salary profile configuration per employee
- **Advance & loan deductions** — Track salary advances and loans with automatic monthly deductions
- **Leave management** — Employee leave requests with admin approval workflow
- **Public holidays** — Admin-managed holiday calendar affecting payroll
- **Performance reviews** — Record and track employee performance evaluations
- **Disciplinary records** — Log and manage disciplinary actions
- **Exit management** — Handle employee offboarding and exit records
- **Company profile** — Configurable company details used across payslips and reports
- **Admin-configurable payroll rules** — Overtime multiplier, holiday pay, EPF/ETF rates, and more via settings panel
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
| Email | SMTP (Go `net/smtp`) |

---

## Architecture

```
frontend/          React + TypeScript SPA
  src/
    pages/         Dashboard, Login
    components/    AdminAttendance, AdminEmployees, AdminPayroll,
                   AdminLeaveRequests, AdminHolidays, AdminPerformanceReviews,
                   AdminExitManagement, AdminSettings, EmployeeDashboard,
                   ManagerOverview, DeductionsModal, DisciplinaryModal,
                   LeaveModal
    hooks/         useApi (authenticated axios)
    lib/           api.ts (TypeScript interfaces + axios factory)

backend/           Go REST API
  cmd/server/      Entry point
  handlers/        auth, employee, attendance, payroll, payroll_settings,
                   advance_loan, leave, holiday, disciplinary, performance,
                   exit, company
  models/          User, SalaryProfile, PayrollSettings, CompanyProfile,
                   Attendance, SalaryAdvance, Loan, LeaveRecord,
                   PublicHoliday, DisciplinaryRecord, PerformanceReview,
                   ExitRecord, Payroll
  middleware/      AuthMiddleware (Asgardeo userinfo endpoint)
  database/        GORM + PgBouncer connection
  routes/          Gin router setup
  services/        Payroll calculation, Asgardeo SSO, Email delivery
```

---

## Database Schema

| Table | Purpose |
|---|---|
| `users` | Identity: name, email, role, department |
| `salary_profiles` | Compensation: rates, allowances, bonuses per employee |
| `payroll_settings` | Admin-configurable rules: OT multiplier, EPF/ETF rates |
| `company_profiles` | Company name, address, registration details |
| `attendances` | Daily attendance with regular/overtime hours |
| `salary_advances` | One-off salary advances with deduction tracking |
| `loans` | Employee loans with instalment schedules |
| `leave_records` | Leave requests and approval status |
| `public_holidays` | Holiday calendar used in payroll calculation |
| `disciplinary_records` | Disciplinary actions and outcomes |
| `performance_reviews` | Employee performance evaluations |
| `exit_records` | Offboarding and exit details |
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
# Fill in your DATABASE_URL, ASGARDEO_BASE_URL, and SMTP settings
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

### Auth
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/auth/sync-user` | Authenticated | Create/sync user on login |
| GET | `/api/auth/me` | Authenticated | Current user with salary profile |

### Employees
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/employees` | Manager+ | All employees with salary profiles |
| POST | `/api/employees` | Admin | Create employee + salary profile |
| PUT | `/api/employees/:id` | Admin | Update employee or salary profile |

### Attendance
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/attendance/upload` | Admin | Upload NGTimereport Excel/XML file |
| GET | `/api/attendance/employee/:id` | Authenticated | Employee attendance by month |

### Payroll
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/payroll` | Manager+ | Payroll records |
| POST | `/api/payroll/calculate` | Admin | Run payroll calculation for a month |
| POST | `/api/payroll/:id/email` | Admin | Email payslip to employee |

### Payroll Settings
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/payroll-settings` | Manager+ | Payroll configuration rules |
| PUT | `/api/payroll-settings/:key` | Admin | Update a payroll rule |

### Advances & Loans
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET/POST | `/api/advances` | Admin | List / create salary advances |
| GET/POST | `/api/loans` | Admin | List / create loans |

### HR Modules
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET/POST | `/api/leave-requests` | Authenticated | Submit / list leave requests |
| PUT | `/api/leaves/:id` | Admin | Approve or reject leave |
| GET/POST | `/api/holidays` | Admin | Manage public holidays |
| GET/POST | `/api/disciplinary` | Admin | Disciplinary records |
| GET/POST | `/api/performance-reviews` | Manager+ | Performance reviews |
| GET/POST | `/api/exits` | Admin | Exit records |
| GET/PUT | `/api/company-profile` | Admin | Company profile |

---

## Status

| Feature | Status |
|---|---|
| Auth (Asgardeo SSO) | Done |
| Employee management | Done |
| Attendance upload (Excel + XML) | Done |
| Payroll calculation | Done |
| PDF payslip generation | Done |
| Email payslip delivery | Done |
| Advance & loan deductions | Done |
| Leave management | Done |
| Public holidays | Done |
| Performance reviews | Done |
| Disciplinary records | Done |
| Exit management | Done |
| Company profile | Done |
| Admin dashboard UI | Done |
| Employee dashboard UI | Done |
| Deployment | Planned |

---

## License

MIT
