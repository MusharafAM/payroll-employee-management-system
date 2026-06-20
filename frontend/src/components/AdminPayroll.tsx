import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/hooks/useApi';
import type { User, Payroll } from '@/lib/api';
import { 
  Calculator, FileSpreadsheet, Download, Save, CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { downloadPayslipPDF } from '@/lib/pdf';


export default function AdminPayroll() {
  const api = useApi();
  const [selectedMonth, setSelectedMonth] = useState('2026-06');
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [payrollSummary, setPayrollSummary] = useState<{
    totalGross: number;
    totalNet: number;
    totalEpfEmployer: number;
    totalEtfEmployer: number;
    payslips: Payroll[];
  } | null>(null);

  // Fetch employees (still useful to check if empty)
  const { data: empData, isLoading: empsLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const res = await api.get<{ employees: User[] }>('/employees');
      return res.data;
    },
  });

  const employees = empData?.employees || [];

  const handleCalculatePayroll = async () => {
    setProcessing(true);
    setSavedSuccess(false);
    try {
      const { data } = await api.get<{
        month: string;
        totalGross: number;
        totalNet: number;
        totalEpfEmployer: number;
        totalEtfEmployer: number;
        payslips: Payroll[];
      }>(`/payroll/calculate?month=${selectedMonth}`);

      setPayrollSummary(data);
    } catch (err) {
      console.error(err);
      alert('Error calculating payroll on the server. Please check if database is migrated.');
    } finally {
      setProcessing(false);
    }
  };

  const handleSavePayroll = async () => {
    if (!payrollSummary) return;
    setSaving(true);
    try {
      await api.post('/payroll/save', { month: selectedMonth });
      setSavedSuccess(true);
      alert(`Payroll for ${selectedMonth} processed and saved to database successfully!`);
    } catch (err) {
      console.error(err);
      alert('Error saving payroll to database.');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPayslip = async (ps: Payroll) => {
    const empName = ps.employee?.name || 'Employee';
    const empId = ps.employee?.employeeId || 'Unknown';
    const department = ps.employee?.department || 'Operations';
    const position = ps.employee?.position || 'Executive';
    await downloadPayslipPDF(ps, empName, empId, department, position);
  };

  return (
    <div className="space-y-6">
      {/* Month Selector Panel */}
      <Card className="p-6 border border-gray-100 shadow-sm rounded-xl bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Calculator className="w-5 h-5 text-purple-600" />
            Monthly Payroll Processing
          </h3>
          <p className="text-xs text-gray-500">
            Select target month to calculate employee overtime, allowances, EPF employee/employer rates, and ETF components.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="month"
            className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedMonth}
            onChange={(e) => {
              setSelectedMonth(e.target.value);
              setPayrollSummary(null);
              setSavedSuccess(false);
            }}
          />
          <Button
            className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2 rounded-lg"
            onClick={handleCalculatePayroll}
            disabled={processing || saving || empsLoading || employees.length === 0}
          >
            {processing ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-t-transparent border-white animate-spin" />
                Calculating...
              </>
            ) : (
              'Run Calculation'
            )}
          </Button>
        </div>
      </Card>

      {payrollSummary && (
        <div className="space-y-6 animate-fade-in">
          {/* Summary Dashboard Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <SummaryCard 
              title="Total Payroll Cost" 
              value={`LKR ${payrollSummary.totalGross.toLocaleString()}`} 
              desc="Total Gross Salaries calculated" 
              color="indigo" 
            />
            <SummaryCard 
              title="Net Disbursed" 
              value={`LKR ${payrollSummary.totalNet.toLocaleString()}`} 
              desc="Total salaries to bank accounts" 
              color="emerald" 
            />
            <SummaryCard 
              title="Employer EPF (12%)" 
              value={`LKR ${payrollSummary.totalEpfEmployer.toLocaleString()}`} 
              desc="Contributions to EPF Sri Lanka" 
              color="blue" 
            />
            <SummaryCard 
              title="Employer ETF (3%)" 
              value={`LKR ${payrollSummary.totalEtfEmployer.toLocaleString()}`} 
              desc="Contributions to ETF Sri Lanka" 
              color="amber" 
            />
          </div>

          {/* Payslip preview tables */}
          <Card className="border border-gray-100 shadow-sm rounded-xl overflow-hidden bg-white">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-gray-900 text-sm">Calculated Monthly Payslips</h4>
                <p className="text-xs text-gray-400">Review before saving to database</p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="flex items-center gap-1 text-xs">
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Export Report (CSV)
                </Button>
                {savedSuccess ? (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                    <CheckCircle2 className="w-4 h-4" /> Saved & Finalized
                  </div>
                ) : (
                  <Button 
                    size="sm" 
                    className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 text-xs rounded-lg"
                    onClick={handleSavePayroll}
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent border-white animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" /> Save & Finalize
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="px-6 py-3">Employee</th>
                    <th className="px-6 py-3 text-center">Days / OT Hours</th>
                    <th className="px-6 py-3 text-right">Base salary</th>
                    <th className="px-6 py-3 text-right">Overtime pay</th>
                    <th className="px-6 py-3 text-right">Allowances</th>
                    <th className="px-6 py-3 text-right text-rose-600">EPF 8% (Ded)</th>
                    <th className="px-6 py-3 text-right text-emerald-600 font-bold">Net Salary</th>
                    <th className="px-6 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
                  {payrollSummary.payslips.map((ps, index) => {
                    const totalBonuses = (ps.eidBonus || 0) + (ps.hajBonus || 0) + (ps.poyaBonus || 0) + 
                      (ps.targetBonus || 0) + (ps.attendanceBonus || 0) + (ps.otherBonus || 0);
                    const allowances = (ps.travelAllowance || 0) + (ps.performanceAllowance || 0) + totalBonuses;

                    return (
                      <tr key={index} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-3.5">
                          <div>
                            <p className="font-bold text-gray-900">{ps.employee?.name || 'Unknown'}</p>
                            <span className="text-[10px] text-gray-400 font-mono">{ps.employee?.employeeId || '—'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3.5 text-center">
                          <div>
                            <p className="font-semibold">{ps.workDays} days</p>
                            <p className="text-[10px] text-gray-400">{ps.overtimeHours} OT hrs</p>
                          </div>
                        </td>
                        <td className="px-6 py-3.5 text-right font-mono">
                          LKR {(ps.baseSalary || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-3.5 text-right font-mono text-purple-600">
                          LKR {(ps.overtimePay || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-3.5 text-right font-mono">
                          LKR {allowances.toLocaleString()}
                        </td>
                        <td className="px-6 py-3.5 text-right font-mono text-rose-600 font-medium">
                          LKR {(ps.epf8 || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-3.5 text-right font-mono text-emerald-600 font-bold">
                          LKR {(ps.netSalary || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-3.5 text-center">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-7 w-7 p-0 rounded-full hover:bg-gray-100 text-blue-600"
                            onClick={() => handleDownloadPayslip(ps)}
                            title="Generate PDF Payslip"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ title, value, desc, color }: { title: string; value: string; desc: string; color: 'indigo' | 'emerald' | 'blue' | 'amber' }) {
  const styles = {
    indigo: { bg: 'bg-indigo-50 border-indigo-100', text: 'text-indigo-600' },
    emerald: { bg: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-600' },
    blue: { bg: 'bg-blue-50 border-blue-100', text: 'text-blue-600' },
    amber: { bg: 'bg-amber-50 border-amber-100', text: 'text-amber-600' },
  };

  return (
    <Card className={`p-5 border ${styles[color].bg} flex flex-col gap-1.5`}>
      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{title}</span>
      <span className={`text-xl font-black ${styles[color].text}`}>{value}</span>
      <span className="text-[10px] text-gray-400">{desc}</span>
    </Card>
  );
}
