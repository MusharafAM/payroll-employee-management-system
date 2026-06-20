import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/hooks/useApi';
import type { User, Attendance, Payroll } from '@/lib/api';
import { 
  Calendar, DollarSign, Clock, Download, FileText, UserCheck, 
  TrendingUp, Info, CheckCircle2
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { downloadPayslipPDF } from '@/lib/pdf';

interface PayrollSetting {
  key: string;
  value: number;
}

export default function EmployeeDashboard({ user }: { user: User }) {
  const api = useApi();
  const [selectedMonth, setSelectedMonth] = useState('2026-06');
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

  const attendance = attData?.attendance || [];
  const settings = settingsData?.settings || [];
  const officialPayroll = payrollData?.payroll || null;

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

  return (
    <div className="space-y-6">
      {/* Official Status Indicator Banner */}
      {isOfficial ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3 text-emerald-800 text-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <span className="font-bold">Official Payroll Stub Available:</span> The payroll metrics below have been finalized and verified by the finance department.
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 text-amber-800 text-xs">
          <Info className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <span className="font-bold">Estimated Statement:</span> Official payroll for {selectedMonth} has not been finalized yet. The values shown below are live simulations based on your current attendance logs and salary setup.
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Log Table */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-6 border border-gray-100 shadow-sm rounded-xl bg-white flex flex-col h-full">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  My Shift Attendance History
                </h3>
                <p className="text-xs text-gray-500">Daily entry-exit logs from fingerprint readers.</p>
              </div>
              <input
                type="month"
                className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
              />
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
