import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/hooks/useApi';
import type { User, Attendance, Payroll, LeaveRecord, LeaveBalance, PerformanceReview } from '@/lib/api';
import {
  Calendar, DollarSign, Clock, Download, FileText, UserCheck,
  TrendingUp, Info, CheckCircle2, CalendarDays, Wallet, CreditCard,
  Plus, AlertCircle, Trash2, Star, ChevronDown, ChevronUp
} from 'lucide-react';

interface SalaryAdvance {
  id: string;
  employeeId: string;
  month: string;
  amount: number;
  note: string;
  createdAt: string;
}

interface Loan {
  id: string;
  employeeId: string;
  totalAmount: number;
  monthlyInstallment: number;
  remainingBalance: number;
  startMonth: string;
  status: 'active' | 'paid_off';
  note: string;
  createdAt: string;
}
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { downloadPayslipPDF } from '@/lib/pdf';

interface PayrollSetting {
  key: string;
  value: number;
}

export default function EmployeeDashboard({ user }: { user: User }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const currentYear = new Date().getFullYear();

  // Leave request form state
  const [leaveDate, setLeaveDate] = useState('');
  const [leaveDays, setLeaveDays] = useState('1');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveFormError, setLeaveFormError] = useState('');
  const profile = user.salaryProfile;

  // Fetch employee attendance
  const { data: attData, isLoading: attLoading } = useQuery({
    queryKey: ['employeeAttendance', user.id, selectedMonth],
    queryFn: async () => {
      const res = await api.get<{ attendance: Attendance[] }>(
        `/attendance/employee/${user.id}?month=${selectedMonth}`
      );
      return res.data;
    },
  });

  // Fetch settings for payroll calculations (fallback)
  const { data: settingsData } = useQuery({
    queryKey: ['payrollSettings'],
    queryFn: async () => {
      const res = await api.get<{ settings: PayrollSetting[] }>('/payroll-settings');
      return res.data;
    },
  });

  // Fetch official payroll from backend
  const { data: payrollData, isLoading: payrollLoading } = useQuery({
    queryKey: ['employeePayroll', user.id, selectedMonth],
    queryFn: async () => {
      try {
        const res = await api.get<{ payroll: Payroll }>(
          `/payroll/employee/${user.id}?month=${selectedMonth}`
        );
        return res.data;
      } catch {
        return null;
      }
    },
  });

  // Fetch list of months that have finalized payslips for this employee
  const { data: payrollHistoryData } = useQuery({
    queryKey: ['employeePayrollHistory', user.id],
    queryFn: async () => {
      const res = await api.get<{ payrolls: Payroll[] }>(`/payroll/employee/${user.id}/history`);
      return res.data.payrolls ?? [];
    },
  });

  const { data: advances } = useQuery({
    queryKey: ['advances', user.id],
    queryFn: async () => {
      const res = await api.get<{ advances: SalaryAdvance[] }>(`/employees/${user.id}/advances`);
      return res.data.advances ?? [];
    },
  });

  const { data: loans } = useQuery({
    queryKey: ['loans', user.id],
    queryFn: async () => {
      const res = await api.get<{ loans: Loan[] }>(`/employees/${user.id}/loans`);
      return res.data.loans ?? [];
    },
  });

  const { data: leaveBalance } = useQuery({
    queryKey: ['leave-balance', user.id, currentYear],
    queryFn: async () => {
      const res = await api.get<LeaveBalance>(`/employees/${user.id}/leave-balance?year=${currentYear}`);
      return res.data;
    },
  });

  const { data: leaveRecords } = useQuery({
    queryKey: ['leaves', user.id, currentYear],
    queryFn: async () => {
      const res = await api.get<{ leaves: LeaveRecord[] }>(`/employees/${user.id}/leaves?year=${currentYear}`);
      return res.data.leaves ?? [];
    },
  });

  const requestLeaveMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/employees/${user.id}/leave-requests`, {
        date: leaveDate,
        days: parseFloat(leaveDays),
        reason: leaveReason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaves', user.id, currentYear] });
      setLeaveDate(''); setLeaveDays('1'); setLeaveReason(''); setLeaveFormError('');
    },
    onError: () => setLeaveFormError('Failed to submit request. Please try again.'),
  });

  const deleteLeaveMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/leaves/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaves', user.id, currentYear] });
      queryClient.invalidateQueries({ queryKey: ['leave-balance', user.id, currentYear] });
    },
  });

  const [expandedReviewId, setExpandedReviewId] = useState<string | null>(null);

  const { data: reviewsData } = useQuery({
    queryKey: ['my-performance-reviews', user.id],
    queryFn: async () => {
      const res = await api.get<{ reviews: PerformanceReview[] }>(`/employees/${user.id}/performance-reviews`);
      return res.data.reviews ?? [];
    },
  });

  const handleLeaveRequest = () => {
    if (!leaveDate || isNaN(parseFloat(leaveDays)) || parseFloat(leaveDays) <= 0) {
      setLeaveFormError('Please select a date.');
      return;
    }
    requestLeaveMutation.mutate();
  };

  const attendance = attData?.attendance || [];
  const settings = settingsData?.settings || [];
  const officialPayroll = payrollData?.payroll || null;
  const payrollHistory = payrollHistoryData ?? [];

  // --- Values mapping ---
  const isOfficial = !!officialPayroll;

  const totalDays = isOfficial ? officialPayroll.workDays : attendance.length;
  const regularHours = isOfficial 
    ? officialPayroll.regularHours 
    : attendance.reduce((sum, r) => sum + (r.regularHours || 0), 0);
  const overtimeHours = isOfficial 
    ? officialPayroll.overtimeHours 
    : attendance.reduce((sum, r) => sum + (r.overtimeHours || 0), 0);

  // Fallback calculation variables
  const epfEmployeeRate = settings.find(s => s.key === 'epf_employee_rate')?.value ?? 8.0;
  const baseSalaryFallback = profile?.baseSalary ?? 0;
  const hourlyRate = profile?.hourlyRate ?? 0;

  // Calculate simulated overtime hours dynamically based on PODUR policy
  const lunchDeductionActive = profile?.isLunchHourDeduction ?? true;
  let simOT15 = 0;
  let simOT20 = 0;
  attendance.forEach(a => {
    if (lunchDeductionActive) {
      if (a.totalHours > 11) {
        simOT15 += 2.0;
        simOT20 += (a.totalHours - 11);
      } else if (a.totalHours > 9) {
        simOT15 += (a.totalHours - 9);
      }
    } else {
      if (a.totalHours > 10) {
        simOT15 += 2.0;
        simOT20 += (a.totalHours - 10);
      } else if (a.totalHours > 8) {
        simOT15 += (a.totalHours - 8);
      }
    }
  });

  const overtimePayFallback = (simOT15 * 1.5 * hourlyRate) + (simOT20 * 2.0 * hourlyRate);
  const travelAllowanceFallback = (profile?.travelAllowance ?? 0) * attendance.length + (profile?.travelAllowanceFixed ?? 0);
  const incentiveAllowanceFallback = profile?.incentiveAllowance ?? 0;
  const bonusesFallback = 
    (profile?.eidBonus ?? 0) + 
    (profile?.hajBonus ?? 0) + 
    (profile?.poyaBonus ?? 0) + 
    (profile?.targetBonus ?? 0) + 
    (profile?.attendanceBonus ?? 0);
  const grossSalaryFallback = baseSalaryFallback + overtimePayFallback + travelAllowanceFallback + incentiveAllowanceFallback + bonusesFallback;
  const epfDeductionFallback = grossSalaryFallback * (epfEmployeeRate / 100);
  const netSalaryFallback = grossSalaryFallback - epfDeductionFallback;

  // Final display variables
  const baseSalary = isOfficial ? officialPayroll.baseSalary : baseSalaryFallback;
  const overtimePay = isOfficial ? officialPayroll.overtimePay : overtimePayFallback;
  const travelAllowance = isOfficial ? officialPayroll.travelAllowance : travelAllowanceFallback;
  const incentiveAllowance = isOfficial ? officialPayroll.performanceAllowance : incentiveAllowanceFallback;
  const bonuses = isOfficial 
    ? (officialPayroll.eidBonus + officialPayroll.hajBonus + officialPayroll.poyaBonus + officialPayroll.targetBonus + officialPayroll.attendanceBonus + officialPayroll.otherBonus) 
    : bonusesFallback;
  const grossSalary = isOfficial ? officialPayroll.grossSalary : grossSalaryFallback;
  const epfDeduction = isOfficial ? officialPayroll.epf8 : epfDeductionFallback;
  const netSalary = isOfficial ? officialPayroll.netSalary : netSalaryFallback;

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '—';
    try {
      const d = new Date(timeStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return timeStr;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString([], { weekday: 'short', day: '2-digit', month: 'short' });
    } catch {
      return dateStr;
    }
  };

  const downloadPayslip = async () => {
    let payrollToDownload: Payroll;

    if (isOfficial && officialPayroll) {
      payrollToDownload = officialPayroll;
    } else {
      const epfEmployerRate = settings.find(s => s.key === 'epf_employer_rate')?.value ?? 12.0;
      const etfRate = settings.find(s => s.key === 'etf_rate')?.value ?? 3.0;

      payrollToDownload = {
        id: 'simulated',
        employeeId: user.id,
        month: selectedMonth,
        workDays: totalDays,
        regularHours: regularHours,
        overtimeHours: overtimeHours,
        overtime15Hours: simOT15,
        overtime20Hours: simOT20,
        baseSalary: baseSalaryFallback,
        regularPay: regularHours * (profile?.hourlyRate ?? 0),
        overtimePay: overtimePayFallback,
        lunchIncentive: 0,
        performanceAllowance: incentiveAllowanceFallback,
        travelAllowance: travelAllowanceFallback,
        eidBonus: profile?.eidBonus ?? 0,
        hajBonus: profile?.hajBonus ?? 0,
        poyaBonus: profile?.poyaBonus ?? 0,
        targetBonus: profile?.targetBonus ?? 0,
        attendanceBonus: profile?.attendanceBonus ?? 0,
        otherBonus: 0,
        holidayWorkDays: 0,
        holidayPay: 0,
        grossSalary: grossSalaryFallback,
        epf8: epfDeductionFallback,
        epf12: grossSalaryFallback * (epfEmployerRate / 100),
        etf3: grossSalaryFallback * (etfRate / 100),
        salaryAdvance: 0,
        loan: 0,
        totalDeductions: epfDeductionFallback,
        netSalary: netSalaryFallback,
        payslipUrl: '',
        generatedAt: new Date().toISOString(),
      };
    }

    await downloadPayslipPDF(
      payrollToDownload,
      user.name,
      user.employeeId,
      user.department || 'Operations',
      user.position || 'Executive'
    );
  };

  const selectedMonthLabel = (() => {
    const [yr, mo] = selectedMonth.split('-');
    return new Date(parseInt(yr), parseInt(mo) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  })();

  return (
    <div className="space-y-6">
      {/* Global Month Selector */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Viewing period</p>
          <p className="text-base font-black text-gray-900">{selectedMonthLabel}</p>
          {payrollHistory.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[10px] text-gray-400 font-medium">Finalized:</span>
              {payrollHistory.map((p) => {
                const [yr, mo] = p.month.split('-');
                const chip = new Date(parseInt(yr), parseInt(mo) - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                return (
                  <button
                    key={p.month}
                    onClick={() => setSelectedMonth(p.month)}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                      p.month === selectedMonth
                        ? 'bg-emerald-600 text-white border-emerald-700'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    {chip}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <input
          type="month"
          className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shrink-0"
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
        />
      </div>

      {/* Official Status Indicator Banner */}
      {isOfficial ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3 text-emerald-800 text-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <span className="font-bold">Official Payroll — {selectedMonthLabel}:</span> Finalized and verified by the finance department.
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 text-amber-800 text-xs">
          <Info className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <span className="font-bold">Estimated Statement — {selectedMonthLabel}:</span> Official payroll has not been finalized yet. Values are live simulations based on your attendance and salary setup.
          </div>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <OverviewCard
          title="Days Worked"
          value={`${totalDays} Days`}
          desc="Monthly attendance count"
          icon={<UserCheck className="w-5 h-5 text-blue-600" />}
        />
        <OverviewCard
          title="Regular Work Hours"
          value={`${Math.round(regularHours * 100) / 100} hrs`}
          desc="Logged regular shift time"
          icon={<Clock className="w-5 h-5 text-indigo-600" />}
        />
        <OverviewCard
          title="Overtime Hours"
          value={`${Math.round(overtimeHours * 100) / 100} hrs`}
          desc="Calculated overtime (OT)"
          icon={<TrendingUp className="w-5 h-5 text-purple-600" />}
        />
        <OverviewCard
          title="Net Take Home"
          value={`LKR ${(Math.round(netSalary * 100) / 100).toLocaleString()}`}
          desc={isOfficial ? "Verified Net Salary" : "Estimated Net Pay (Gross - EPF)"}
          icon={<DollarSign className="w-5 h-5 text-emerald-600" />}
        />
      </div>

      {/* Leave Balance Banner */}
      {leaveBalance && (
        <div className="grid grid-cols-3 gap-4">
          <Card className="col-span-3 p-5 border border-green-100 bg-gradient-to-r from-green-50/60 to-white rounded-xl shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-green-600" />
                Leave Balance — {currentYear}
              </h3>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-3">
              <div className="text-center p-3 bg-white border border-gray-100 rounded-xl">
                <p className="text-2xl font-black text-gray-900">{leaveBalance.entitlement}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mt-0.5">Entitled</p>
              </div>
              <div className="text-center p-3 bg-amber-50 border border-amber-100 rounded-xl">
                <p className="text-2xl font-black text-amber-600">{leaveBalance.used}</p>
                <p className="text-[10px] text-amber-500 uppercase tracking-wide mt-0.5">Used</p>
              </div>
              <div className={`text-center p-3 border rounded-xl ${leaveBalance.remaining < 0 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                <p className={`text-2xl font-black ${leaveBalance.remaining < 0 ? 'text-red-600' : 'text-green-600'}`}>{leaveBalance.remaining}</p>
                <p className={`text-[10px] uppercase tracking-wide mt-0.5 ${leaveBalance.remaining < 0 ? 'text-red-400' : 'text-green-500'}`}>Remaining</p>
              </div>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${leaveBalance.remaining < 0 ? 'bg-red-500' : 'bg-green-500'}`}
                style={{ width: `${Math.min(100, Math.round((leaveBalance.used / (leaveBalance.entitlement || 1)) * 100))}%` }}
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1 text-right">
              {Math.round((leaveBalance.used / (leaveBalance.entitlement || 1)) * 100)}% used
            </p>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Log Table */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-6 border border-gray-100 shadow-sm rounded-xl bg-white flex flex-col h-full">
            <div className="mb-6">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                Shift Attendance — {selectedMonthLabel}
              </h3>
              <p className="text-xs text-gray-500">Daily entry-exit logs from fingerprint readers.</p>
            </div>

            {attLoading || payrollLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 space-y-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                <p className="text-xs text-gray-400">Loading daily attendance records...</p>
              </div>
            ) : attendance.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-center text-gray-400 border border-dashed rounded-lg">
                <Calendar className="w-10 h-10 mb-2 stroke-[1.5]" />
                <p className="text-xs font-semibold">No attendance records found</p>
                <p className="text-[10px] max-w-[200px] mt-1 text-gray-400">There are no shift entry logs imported for the selected month.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-gray-100 rounded-lg">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">In</th>
                      <th className="px-4 py-3">Out</th>
                      <th className="px-4 py-3 text-center">Regular Hours</th>
                      <th className="px-4 py-3 text-center">Overtime Hours</th>
                      <th className="px-4 py-3 text-center">Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs text-gray-700 font-medium">
                    {attendance.map((record) => (
                      <tr key={record.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3 text-gray-900">{formatDate(record.date)}</td>
                        <td className="px-4 py-3 font-mono text-gray-500">{formatTime(record.timeIn)}</td>
                        <td className="px-4 py-3 font-mono text-gray-500">{formatTime(record.timeOut)}</td>
                        <td className="px-4 py-3 text-center font-mono">{record.regularHours}</td>
                        <td className="px-4 py-3 text-center font-mono text-purple-600">
                          {record.overtimeHours > 0 ? `+${record.overtimeHours}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {record.isHalfDay ? (
                            <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-[10px] font-semibold border border-amber-100">Half Day</span>
                          ) : (
                            <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-semibold border border-emerald-100">Full Shift</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Payslip Details Column */}
        <div className="space-y-6">
          {/* Compensation Breakdown Card */}
          <Card className="p-6 border border-gray-100 shadow-sm rounded-xl bg-white">
            <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              Salary & Allowance Setup
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-xs text-gray-500">Hourly Rate</span>
                <span className="text-sm font-bold text-gray-900">LKR {(profile?.hourlyRate ?? 0).toLocaleString()} /hr</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-xs text-gray-500">Travel Allowance</span>
                <span className="text-sm font-bold text-gray-900">LKR {(profile?.travelAllowance ?? 0).toLocaleString()} /day</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-xs text-gray-500">Travel Allowance (Fixed)</span>
                <span className="text-sm font-bold text-gray-900">LKR {(profile?.travelAllowanceFixed ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-xs text-gray-500">Incentive Allowance</span>
                <span className="text-sm font-bold text-gray-900">LKR {(profile?.incentiveAllowance ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Lunch Hour Deduction</span>
                <span className="text-xs font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">
                  {profile?.isLunchHourDeduction ? 'Active' : 'Bypassed'}
                </span>
              </div>
            </div>
          </Card>

          {/* Payslip Card */}
          <Card className="p-6 border border-purple-100 shadow-sm rounded-xl bg-gradient-to-b from-white to-purple-50/20">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-600" />
                  Monthly Statement
                </h3>
                <p className="text-[10px] text-gray-500">
                  {isOfficial ? "Finalized payslip stub." : "Simulated payslip breakdown."}
                </p>
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={downloadPayslip}
                className="h-8 text-xs font-bold text-blue-600 hover:bg-blue-50 border-blue-200"
                disabled={!isOfficial && attendance.length === 0}
              >
                <Download className="w-3.5 h-3.5 mr-1" /> PDF
              </Button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Base Salary</span>
                <span className="font-semibold text-gray-900">LKR {baseSalary.toLocaleString()}</span>
              </div>
              <div className="flex justify-between flex-col gap-0.5">
                <div className="flex justify-between">
                  <span className="text-gray-500">Overtime Pay ({Math.round(overtimeHours * 100) / 100} hrs)</span>
                  <span className="font-semibold text-gray-900">LKR {Math.round(overtimePay).toLocaleString()}</span>
                </div>
                <div className="text-[10px] text-gray-400 font-mono text-right">
                  1.5x: {isOfficial ? (officialPayroll.overtime15Hours || 0) : simOT15}h | 2x: {isOfficial ? (officialPayroll.overtime20Hours || 0) : simOT20}h
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Travel Allowances</span>
                <span className="font-semibold text-gray-900">LKR {travelAllowance.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Performance Bonuses</span>
                <span className="font-semibold text-gray-900">LKR {(incentiveAllowance + bonuses).toLocaleString()}</span>
              </div>
              <div className="flex justify-between pt-2 border-t font-semibold text-gray-900">
                <span>Gross Salary</span>
                <span>LKR {Math.round(grossSalary).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-rose-600">
                <span>EPF Contribution (8%)</span>
                <span>- LKR {Math.round(epfDeduction).toLocaleString()}</span>
              </div>
              <div className="flex justify-between pt-3 border-t text-sm font-black text-emerald-600">
                <span>Net Pay</span>
                <span>LKR {Math.round(netSalary).toLocaleString()}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
      {/* Advances & Loans */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Salary Advances */}
        <Card className="p-6 border border-gray-100 shadow-sm rounded-xl bg-white">
          <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-amber-500" />
            Salary Advances
          </h3>
          {!advances?.length ? (
            <p className="text-xs text-gray-400 text-center py-6 border border-dashed rounded-lg">No salary advances on record.</p>
          ) : (
            <div className="space-y-2">
              {advances.map((adv) => (
                <div key={adv.id} className="flex items-center justify-between px-4 py-3 bg-amber-50/50 border border-amber-100 rounded-lg">
                  <div>
                    <span className="text-sm font-bold text-gray-900">LKR {adv.amount.toLocaleString()}</span>
                    <span className="ml-2 text-xs text-gray-500">{adv.month}</span>
                    {adv.note && <p className="text-xs text-gray-400 mt-0.5">{adv.note}</p>}
                  </div>
                  <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Advance</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Loans */}
        <Card className="p-6 border border-gray-100 shadow-sm rounded-xl bg-white">
          <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-rose-500" />
            Loans
          </h3>
          {!loans?.length ? (
            <p className="text-xs text-gray-400 text-center py-6 border border-dashed rounded-lg">No loans on record.</p>
          ) : (
            <div className="space-y-4">
              {loans.map((loan) => {
                const paidPct = Math.round(((loan.totalAmount - loan.remainingBalance) / loan.totalAmount) * 100);
                return (
                  <div key={loan.id} className={`border rounded-xl p-4 space-y-3 ${loan.status === 'paid_off' ? 'border-green-100 bg-green-50/40' : 'border-rose-100 bg-rose-50/20'}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-sm font-bold text-gray-900">LKR {loan.totalAmount.toLocaleString()}</span>
                        <span className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${loan.status === 'paid_off' ? 'bg-green-100 text-green-700' : 'bg-rose-100 text-rose-700'}`}>
                          {loan.status === 'paid_off' ? 'Paid Off' : 'Active'}
                        </span>
                        {loan.note && <p className="text-xs text-gray-400 mt-0.5">{loan.note}</p>}
                        <p className="text-xs text-gray-500 mt-1">Started: {loan.startMonth} · LKR {loan.monthlyInstallment.toLocaleString()}/mo</p>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                        <span>Paid: LKR {(loan.totalAmount - loan.remainingBalance).toLocaleString()}</span>
                        <span>Remaining: LKR {loan.remainingBalance.toLocaleString()}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${loan.status === 'paid_off' ? 'bg-green-500' : 'bg-rose-500'}`}
                          style={{ width: `${paidPct}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1 text-right">{paidPct}% repaid</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Performance Reviews */}
      <Card className="p-6 border border-gray-100 shadow-sm rounded-xl bg-white space-y-4">
        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
          <Star className="w-5 h-5 text-blue-600" />
          My Performance Reviews
        </h3>
        {!reviewsData?.length ? (
          <p className="text-xs text-gray-400 text-center py-6 border border-dashed rounded-lg">
            No performance reviews on record yet.
          </p>
        ) : (
          <div className="space-y-2">
            {reviewsData.map((review) => {
              const isExpanded = expandedReviewId === review.id;
              const ratingColors: Record<string, string> = {
                excellent:         'bg-emerald-100 text-emerald-700',
                good:              'bg-blue-100 text-blue-700',
                satisfactory:      'bg-gray-100 text-gray-700',
                needs_improvement: 'bg-amber-100 text-amber-700',
                unsatisfactory:    'bg-red-100 text-red-700',
              };
              const ratingLabels: Record<string, string> = {
                excellent:         'Excellent',
                good:              'Good',
                satisfactory:      'Satisfactory',
                needs_improvement: 'Needs Improvement',
                unsatisfactory:    'Unsatisfactory',
              };
              return (
                <div key={review.id} className="border border-gray-100 rounded-xl overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                    onClick={() => setExpandedReviewId(isExpanded ? null : review.id)}
                  >
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm font-semibold text-gray-800">{review.reviewPeriod}</span>
                      <span className="text-xs text-gray-400">{review.reviewDate}</span>
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${ratingColors[review.rating] ?? 'bg-gray-100 text-gray-700'}`}>
                        {ratingLabels[review.rating] ?? review.rating}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${review.status === 'final' ? 'border-emerald-200 text-emerald-600 bg-emerald-50' : 'border-gray-200 text-gray-500 bg-gray-50'}`}>
                        {review.status}
                      </span>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-gray-50 pt-3 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        {review.strengths && (
                          <div className="p-3 bg-emerald-50 rounded-lg">
                            <p className="font-semibold text-emerald-700 mb-1">Strengths</p>
                            <p className="text-gray-700 whitespace-pre-line">{review.strengths}</p>
                          </div>
                        )}
                        {review.areasForImprovement && (
                          <div className="p-3 bg-amber-50 rounded-lg">
                            <p className="font-semibold text-amber-700 mb-1">Areas for Improvement</p>
                            <p className="text-gray-700 whitespace-pre-line">{review.areasForImprovement}</p>
                          </div>
                        )}
                        {review.goals && (
                          <div className="p-3 bg-blue-50 rounded-lg">
                            <p className="font-semibold text-blue-700 mb-1">Goals</p>
                            <p className="text-gray-700 whitespace-pre-line">{review.goals}</p>
                          </div>
                        )}
                        {review.notes && (
                          <div className="p-3 bg-gray-50 rounded-lg sm:col-span-3">
                            <p className="font-semibold text-gray-600 mb-1">Notes</p>
                            <p className="text-gray-700 whitespace-pre-line">{review.notes}</p>
                          </div>
                        )}
                        {review.attendanceScore > 0 && (
                          <div className="p-3 bg-blue-50 rounded-lg sm:col-span-3 flex items-center gap-3">
                            <div>
                              <p className="font-semibold text-blue-700 mb-0.5">Punctuality Score</p>
                              <p className="text-gray-500 text-[10px]">Based on your attendance for this review period</p>
                            </div>
                            <span className="ml-auto text-2xl font-black text-blue-700">{review.attendanceScore}%</span>
                          </div>
                        )}
                      </div>
                      {review.reviewedBy && (
                        <p className="text-xs text-gray-400">Reviewed by {review.reviewedBy}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Leave Request & History */}
      <Card className="p-6 border border-gray-100 shadow-sm rounded-xl bg-white space-y-5">
        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-green-600" />
          My Leaves — {currentYear}
        </h3>

        {/* Request form */}
        <div className="p-4 border border-green-100 bg-green-50/30 rounded-xl space-y-3">
          <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">Request Leave</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-gray-500 font-medium">Date</label>
              <input
                type="date"
                className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                value={leaveDate}
                onChange={e => setLeaveDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Days</label>
              <select
                className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                value={leaveDays}
                onChange={e => setLeaveDays(e.target.value)}
              >
                <option value="0.5">Half day</option>
                <option value="1">Full day</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Reason (optional)</label>
            <input
              type="text"
              placeholder="e.g. Medical appointment, Family event"
              className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              value={leaveReason}
              onChange={e => setLeaveReason(e.target.value)}
            />
          </div>
          {leaveFormError && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />{leaveFormError}
            </p>
          )}
          <button
            onClick={handleLeaveRequest}
            disabled={requestLeaveMutation.isPending}
            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60"
          >
            <Plus className="w-3.5 h-3.5" />
            {requestLeaveMutation.isPending ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>

        {/* Leave list */}
        {!leaveRecords?.length ? (
          <p className="text-xs text-gray-400 text-center py-4 border border-dashed rounded-lg">
            No leave records for {currentYear}.
          </p>
        ) : (
          <div className="space-y-2">
            {leaveRecords.map((leave) => (
              <div key={leave.id} className={`flex items-center justify-between px-4 py-3 rounded-lg text-sm border ${
                leave.status === 'pending'  ? 'bg-amber-50 border-amber-100' :
                leave.status === 'rejected' ? 'bg-red-50 border-red-100' :
                'bg-gray-50 border-gray-100'
              }`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-gray-900">
                    {new Date(leave.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${leave.days === 0.5 ? 'bg-blue-100 text-blue-700' : 'bg-indigo-100 text-indigo-700'}`}>
                    {leave.days === 0.5 ? 'Half day' : 'Full day'}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    leave.status === 'pending'  ? 'bg-amber-100 text-amber-700' :
                    leave.status === 'rejected' ? 'bg-red-100 text-red-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {leave.status === 'pending' ? 'Pending' : leave.status === 'rejected' ? 'Rejected' : 'Approved'}
                  </span>
                  {leave.reason && <span className="text-xs text-gray-400">· {leave.reason}</span>}
                  {leave.status === 'rejected' && leave.rejectionReason && (
                    <span className="text-xs text-red-500">· {leave.rejectionReason}</span>
                  )}
                </div>
                {leave.status === 'pending' && (
                  <button
                    onClick={() => deleteLeaveMutation.mutate(leave.id)}
                    className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600 shrink-0"
                    title="Cancel request"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function OverviewCard({ title, value, desc, icon }: { title: string; value: string; desc: string; icon: React.ReactNode }) {
  return (
    <Card className="p-5 border border-gray-100 shadow-sm rounded-xl bg-white flex items-center justify-between gap-4">
      <div className="space-y-1">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{title}</span>
        <span className="block text-lg font-black text-gray-900">{value}</span>
        <span className="block text-[10px] text-gray-500">{desc}</span>
      </div>
      <div className="w-10 h-10 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-center shrink-0">
        {icon}
      </div>
    </Card>
  );
}
