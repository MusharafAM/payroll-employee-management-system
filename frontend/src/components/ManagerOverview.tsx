import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/hooks/useApi';
import type { User, Payroll } from '@/lib/api';
import {
  Users, Clock, DollarSign, BarChart2, PieChart as PieIcon, TrendingUp, Calendar, Info,
  CheckCircle2
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

// Build YYYY-MM string for the current month
const thisMonth = new Date().toISOString().slice(0, 7);

export default function ManagerOverview({ user }: { user: User }) {
  const api = useApi();
  const [selectedMonth, setSelectedMonth] = useState(thisMonth);

  const managerDept = user.department;
  const isManager = user.role === 'MANAGER';

  // 1. Fetch all active employees (for team size)
  const { data: empData, isLoading: empsLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const res = await api.get<{ employees: User[] }>('/employees');
      return res.data;
    },
  });

  // 2. Fetch list of months that have saved payroll
  const { data: monthsData } = useQuery({
    queryKey: ['payrollMonths'],
    queryFn: async () => {
      const res = await api.get<{ months: string[] }>('/payroll/months');
      return res.data;
    },
  });
  const savedMonths = monthsData?.months || [];

  // 3. Fetch SAVED payroll records for the selected month
  const { data: payrollData, isLoading: payrollLoading } = useQuery({
    queryKey: ['payrollHistory', selectedMonth],
    queryFn: async () => {
      const res = await api.get<{ month: string; payrolls: Payroll[] }>(`/payroll/history?month=${selectedMonth}`);
      return res.data;
    },
  });

  const employees = empData?.employees || [];
  const payslips = payrollData?.payrolls || [];

  // Filter based on manager's department (or show all for Admin)
  const teamEmployees = isManager && managerDept
    ? employees.filter(e => e.department === managerDept)
    : employees;

  const teamPayslips = isManager && managerDept
    ? payslips.filter(ps => ps.employee?.department === managerDept)
    : payslips;

  const isSavedMonth = payslips.length > 0;

  // --- Aggregate Stats ---
  const teamSize = teamEmployees.length;
  
  const totalRegularHours = teamPayslips.reduce((sum, ps) => sum + (ps.regularHours || 0), 0);
  const totalOvertimeHours = teamPayslips.reduce((sum, ps) => sum + (ps.overtimeHours || 0), 0);
  const totalHours = totalRegularHours + totalOvertimeHours;

  const totalPayrollCost = teamPayslips.reduce((sum, ps) => sum + (ps.grossSalary || 0), 0);
  const totalNetDisbursed = teamPayslips.reduce((sum, ps) => sum + (ps.netSalary || 0), 0);
  const totalEPFEmployer = teamPayslips.reduce((sum, ps) => sum + (ps.epf12 || 0), 0);
  const totalETFEmployer = teamPayslips.reduce((sum, ps) => sum + (ps.etf3 || 0), 0);

  // --- Recharts Chart 1: Salary Expenditures per Employee ---
  const salaryChartData = teamPayslips.map(ps => {
    const totalBonuses = 
      (ps.eidBonus || 0) + 
      (ps.hajBonus || 0) + 
      (ps.poyaBonus || 0) + 
      (ps.targetBonus || 0) + 
      (ps.attendanceBonus || 0) + 
      (ps.otherBonus || 0);

    const allowances = (ps.travelAllowance || 0) + (ps.performanceAllowance || 0) + totalBonuses;

    return {
      name: ps.employee?.name || 'Unknown',
      base: ps.baseSalary,
      overtime: ps.overtimePay,
      allowances: allowances,
      net: ps.netSalary,
    };
  });

  // --- Recharts Chart 2: Logged Hours Spread ---
  const hoursChartData = teamPayslips.map(ps => ({
    name: ps.employee?.name?.split(' ')[0] || 'Unknown', // Short name
    'Regular Hours': ps.regularHours,
    'Overtime Hours': ps.overtimeHours,
  }));

  // --- Recharts Chart 3: Cost Distribution Pie ---
  const costDistributionData = [
    { name: 'Net Salaries', value: totalNetDisbursed, color: '#10b981' },
    { name: 'Employee EPF (8%)', value: teamPayslips.reduce((sum, ps) => sum + (ps.epf8 || 0), 0), color: '#ef4444' },
    { name: 'Employer EPF (12%)', value: totalEPFEmployer, color: '#3b82f6' },
    { name: 'Employer ETF (3%)', value: totalETFEmployer, color: '#f59e0b' },
  ];

  const formatLKR = (num: number) => {
    return 'LKR ' + Math.round(num).toLocaleString();
  };

  const isLoading = empsLoading || payrollLoading;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        <p className="text-sm text-gray-500 font-medium">Loading payroll records for {selectedMonth}…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Month Selector Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-blue-600" />
              {isManager ? `${managerDept || 'Department'} Overview` : 'Company Payroll Overview'}
            </h2>
            <p className="text-xs text-gray-500">
              Select a month to view its finalized payroll summary, salary breakdown, and statutory contributions.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input
              type="month"
              className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
            />
            {isSavedMonth && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Finalized
              </div>
            )}
          </div>
        </div>

        {/* Quick-select: months that have saved payroll */}
        {savedMonths.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Finalized months:</span>
            {savedMonths.map(m => (
              <button
                key={m}
                onClick={() => setSelectedMonth(m)}
                className={`px-3 py-1 text-xs rounded-full font-semibold transition-all border ${
                  m === selectedMonth
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-400 hover:text-blue-600'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </div>

      {teamPayslips.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 space-y-4">
          <div className="flex items-start gap-4">
            <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <h4 className="font-bold text-amber-900 text-sm">No Finalized Payroll for {selectedMonth}</h4>
              <p className="text-xs text-amber-700 leading-relaxed">
                Payroll has not been saved for this month yet. Go to the <strong>Run Payroll</strong> tab,
                run the calculation, adjust any fixed-salary amounts, and click <strong>Save &amp; Finalize</strong>.
                Once saved, the overview for {selectedMonth} will appear here.
              </p>
            </div>
          </div>
          {savedMonths.length > 0 && (
            <div className="border-t border-amber-200 pt-3">
              <p className="text-[11px] font-semibold text-amber-700 mb-2">Jump to a month with saved payroll:</p>
              <div className="flex flex-wrap gap-2">
                {savedMonths.map(m => (
                  <button
                    key={m}
                    onClick={() => setSelectedMonth(m)}
                    className="px-3 py-1 text-xs rounded-full font-semibold bg-white text-amber-700 border border-amber-300 hover:bg-amber-100 transition-colors"
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Key Metric Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Active Team Size"
              value={`${teamSize} Employees`}
              desc="Direct department staff count"
              icon={<Users className="w-5 h-5 text-blue-600" />}
              bgColor="bg-blue-50/50"
            />
            <MetricCard
              title="Total Logged Hours"
              value={`${Math.round(totalHours * 100) / 100} Hrs`}
              desc={`OT: ${Math.round(totalOvertimeHours)} hrs included`}
              icon={<Clock className="w-5 h-5 text-indigo-600" />}
              bgColor="bg-indigo-50/50"
            />
            <MetricCard
              title="Total Payroll Cost"
              value={formatLKR(totalPayrollCost)}
              desc="Sum of Gross salaries"
              icon={<DollarSign className="w-5 h-5 text-emerald-600" />}
              bgColor="bg-emerald-50/50"
            />
            <MetricCard
              title="Employer Contributions"
              value={formatLKR(totalEPFEmployer + totalETFEmployer)}
              desc="12% EPF + 3% ETF statutory"
              icon={<TrendingUp className="w-5 h-5 text-amber-600" />}
              bgColor="bg-amber-50/50"
            />
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart 1: Salary Expenditures */}
            <Card className="lg:col-span-2 p-6 border border-gray-100 shadow-sm rounded-xl bg-white flex flex-col h-[400px]">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-gray-900">Compensation Breakdown</h3>
                <p className="text-[11px] text-gray-400">Monthly breakdown (Base salary vs. Overtime pay vs. Allowances) per employee</p>
              </div>
              <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={salaryChartData}
                    margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} />
                    <YAxis tickFormatter={(val) => `LKR ${val / 1000}k`} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip 
                      formatter={(value: any) => [formatLKR(Number(value)), '']}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '11px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                    <Bar dataKey="base" name="Base Salary" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="overtime" name="Overtime Pay" stackId="a" fill="#7c3aed" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="allowances" name="Allowances & Bonuses" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Chart 2: Cost Distribution Pie */}
            <Card className="p-6 border border-gray-100 shadow-sm rounded-xl bg-white flex flex-col h-[400px]">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-gray-900">Statutory Budget Share</h3>
                <p className="text-[11px] text-gray-400">Ratio of net payout to national statutory contributions</p>
              </div>
              <div className="flex-1 flex items-center justify-center min-h-0 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={costDistributionData}
                      cx="50%"
                      cy="45%"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {costDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatLKR(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2 border-t pt-4">
                {costDistributionData.map((item, index) => (
                  <div key={index} className="flex items-center gap-1.5 text-[10px] text-gray-600">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="truncate">{item.name}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart 3: Hours Spread */}
            <Card className="lg:col-span-2 p-6 border border-gray-100 shadow-sm rounded-xl bg-white flex flex-col h-[350px]">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-gray-900">Work Hours Distribution</h3>
                <p className="text-[11px] text-gray-400">Regular hours worked compared to overtime (OT) hours logged</p>
              </div>
              <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={hoursChartData}
                    margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '11px' }} />
                    <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                    <Bar dataKey="Regular Hours" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Overtime Hours" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Team Attendance Efficiency Card */}
            <Card className="p-6 border border-gray-100 shadow-sm rounded-xl bg-gradient-to-b from-white to-blue-50/10 flex flex-col justify-between h-[350px]">
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-1 flex items-center gap-2">
                  <PieIcon className="w-4 h-4 text-purple-600" />
                  Statutory Summary
                </h3>
                <p className="text-[11px] text-gray-400">
                  Estimated national fund calculations for {selectedMonth}.
                </p>
              </div>
              
              <div className="space-y-3.5 my-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500">Gross Salaries Total</span>
                  <span className="font-bold text-gray-900">{formatLKR(totalPayrollCost)}</span>
                </div>
                <div className="flex justify-between items-center text-xs border-b pb-2">
                  <span className="text-gray-500">Net Distributed Total</span>
                  <span className="font-bold text-emerald-600">{formatLKR(totalNetDisbursed)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    Employee EPF (8%)
                  </span>
                  <span className="font-mono text-gray-900 font-semibold">{formatLKR(teamPayslips.reduce((sum, ps) => sum + (ps.epf8 || 0), 0))}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    Employer EPF (12%)
                  </span>
                  <span className="font-mono text-gray-900 font-semibold">{formatLKR(totalEPFEmployer)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    Employer ETF (3%)
                  </span>
                  <span className="font-mono text-gray-900 font-semibold">{formatLKR(totalETFEmployer)}</span>
                </div>
              </div>

              <div className="bg-blue-50/50 rounded-lg p-3 border border-blue-100 flex items-start gap-2.5 text-[10px] text-blue-800 leading-normal">
                <Info className="w-3.5 h-3.5 text-blue-600 mt-0.5 shrink-0" />
                <span>
                  Figures are from the finalized payroll saved for {selectedMonth}.
                </span>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function MetricCard({ title, value, desc, icon, bgColor }: { title: string; value: string; desc: string; icon: React.ReactNode; bgColor: string }) {
  return (
    <Card className="p-5 border border-gray-100 shadow-sm rounded-xl bg-white flex items-center justify-between gap-4">
      <div className="space-y-1">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{title}</span>
        <span className="block text-lg font-black text-gray-900">{value}</span>
        <span className="block text-[10px] text-gray-500">{desc}</span>
      </div>
      <div className={`w-10 h-10 ${bgColor} rounded-xl flex items-center justify-center shrink-0`}>
        {icon}
      </div>
    </Card>
  );
}
