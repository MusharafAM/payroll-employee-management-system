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
  salaryProfile?: SalaryProfile;
  createdAt: string;
  updatedAt: string;
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

export interface Payroll {
  id: string;
  employeeId: string;
  month: string;
  workDays: number;
  regularHours: number;
  overtimeHours: number;
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
