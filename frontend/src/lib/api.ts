import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL as string;

// Creates an axios instance that automatically attaches the Asgardeo access token.
// Pass in the `getAccessToken` function from `useAuthContext()`.
export function createApi(getToken: () => Promise<string>) {
  const instance = axios.create({ baseURL: API_URL });

  instance.interceptors.request.use(async (config) => {
    try {
      const token = await getToken();
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch {
      // not authenticated yet — let the request proceed, server will 401
    }
    return config;
  });

  return instance;
}

// --- TypeScript types matching the Go models ---

export interface SalaryProfile {
  id: string;
  userId: string;
  salaryType: 'hourly' | 'fixed';
  hourlyRate: number;
  baseSalary: number;
  travelAllowance: number;
  travelAllowanceFixed: number;
  incentiveAllowance: number;
  eidBonus: number;
  hajBonus: number;
  poyaBonus: number;
  targetBonus: number;
  attendanceBonus: number;
  isLunchHourDeduction: boolean;
  additionalAllowances: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  employeeId: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
  department: string;
  position: string;
  isActive: boolean;
  phone?: string;
  nic?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  joinDate?: string;
  employmentType?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;
  emergencyContactEmail?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankBranch?: string;
  annualLeaveEntitlement: number;
  salaryProfile?: SalaryProfile;
  createdAt: string;
  updatedAt: string;
}

export interface DisciplinaryRecord {
  id: string;
  employeeId: string;
  type: 'warning' | 'incident' | 'letter';
  severity: 'low' | 'medium' | 'high';
  date: string;
  description: string;
  issuedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExitRecord {
  id: string;
  employeeId: string;
  employee?: User;
  exitType: 'resignation' | 'termination';
  noticeDate: string;
  lastWorkingDay: string;
  reason: string;
  status: 'pending' | 'approved' | 'completed';
  leaveRemainingDays: number;
  leavePayoutElected: boolean;
  leavePayoutAmount: number;
  outstandingLoans: number;
  gratuityAmount: number;
  totalSettlement: number;
  notes: string;
  approvedBy: string;
  approvedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExitSettlementPreview {
  leaveRemainingDays: number;
  dailyRate: number;
  leavePayoutAmount: number;
  outstandingLoans: number;
}

export interface LeaveRecord {
  id: string;
  employeeId: string;
  employee?: User;
  date: string;
  days: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason: string;
  reviewedBy: string;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveBalance {
  year: number;
  entitlement: number;
  used: number;
  remaining: number;
}

export interface Attendance {
  id: string;
  employeeId: string;
  date: string;
  timeIn: string | null;
  timeOut: string | null;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  isHalfDay: boolean;
}

export interface PublicHoliday {
  id: string;
  date: string;
  name: string;
  isWorkday: boolean;
  rateMultiplier: number;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface PerformanceReview {
  id: string;
  employeeId: string;
  employee?: User;
  reviewPeriod: string;
  reviewDate: string;
  rating: 'excellent' | 'good' | 'satisfactory' | 'needs_improvement' | 'unsatisfactory';
  strengths: string;
  areasForImprovement: string;
  goals: string;
  notes: string;
  reviewedBy: string;
  status: 'draft' | 'final';
  attendanceScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface Payroll {
  id: string;
  employeeId: string;
  employee?: User;
  month: string;
  workDays: number;
  regularHours: number;
  overtimeHours: number;
  overtime15Hours: number;
  overtime20Hours: number;
  baseSalary: number;
  regularPay: number;
  overtimePay: number;
  lunchIncentive: number;
  performanceAllowance: number;
  travelAllowance: number;
  eidBonus: number;
  hajBonus: number;
  poyaBonus: number;
  targetBonus: number;
  attendanceBonus: number;
  otherBonus: number;
  holidayWorkDays: number;
  holidayPay: number;
  grossSalary: number;
  epf8: number;
  epf12: number;
  etf3: number;
  salaryAdvance: number;
  loan: number;
  totalDeductions: number;
  netSalary: number;
  payslipUrl: string;
  generatedAt: string;
}
