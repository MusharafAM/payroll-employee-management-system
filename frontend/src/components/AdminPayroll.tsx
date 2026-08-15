import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/hooks/useApi';
import type { User, Payroll } from '@/lib/api';
import {
  Calculator, FileSpreadsheet, Download, Save, CheckCircle2, Mail,
  Pencil, History, ChevronDown, ChevronRight, DollarSign, Bell
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { downloadPayslipPDF, generatePayslipPDFBlob } from '@/lib/pdf';

const DEFAULT_EPF_RATE = 0.08;

function computeFixedRow(baseSalary: number, ps: Payroll): Payroll {
  const epf8 = Math.ceil((baseSalary * DEFAULT_EPF_RATE) / 10) * 10;
  const totalDeductions = epf8 + (ps.salaryAdvance || 0) + (ps.loan || 0);
  return {
    ...ps,
    baseSalary,
    regularPay: baseSalary,
    grossSalary: baseSalary,
    epf8,
    epf12: Math.ceil((baseSalary * 0.12) / 10) * 10,
    etf3: Math.ceil((baseSalary * 0.03) / 10) * 10,
    totalDeductions,
    netSalary: baseSalary - totalDeductions,
  };
}

export default function AdminPayroll() {
  const api = useApi();
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [emailingId, setEmailingId] = useState<string | null>(null);
  const [notifying, setNotifying] = useState(false);
  const [payrollSummary, setPayrollSummary] = useState<{
    totalGross: number;
    totalNet: number;
    totalEpfEmployer: number;
    totalEtfEmployer: number;
    payslips: Payroll[];
  } | null>(null);

  // fixedOverrides: employeeId → manually entered baseSalary for this month
  const [fixedOverrides, setFixedOverrides] = useState<Record<string, number>>({});
  const [historyOpen, setHistoryOpen] = useState(false);

  const { data: empData, isLoading: empsLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const res = await api.get<{ employees: User[] }>('/employees');
      return res.data;
    },
  });
  const employees = empData?.employees || [];

  // Saved payroll for selected month
  const { data: historyData, refetch: refetchHistory } = useQuery({
    queryKey: ['payroll-history', selectedMonth],
    queryFn: async () => {
      const res = await api.get<{ month: string; payrolls: Payroll[] }>(`/payroll/history?month=${selectedMonth}`);
      return res.data;
    },
    enabled: historyOpen,
  });
  const savedPayrolls = historyData?.payrolls || [];

  const handleCalculatePayroll = async () => {
    setProcessing(true);
    setSavedSuccess(false);
    setFixedOverrides({});
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
      alert('Error calculating payroll. Please check if backend is running.');
    } finally {
      setProcessing(false);
    }
  };

  // Returns effective payslip after applying any fixed override
  const effectivePayslip = (ps: Payroll): Payroll => {
    const isFixed = ps.employee?.salaryProfile?.salaryType === 'fixed';
    if (isFixed && fixedOverrides[ps.employeeId] !== undefined) {
      return computeFixedRow(fixedOverrides[ps.employeeId], ps);
    }
    return ps;
  };

  const effectivePayslips = payrollSummary
    ? payrollSummary.payslips.map(effectivePayslip)
    : [];

  const totalGross = effectivePayslips.reduce((s, p) => s + (p.grossSalary || 0), 0);
  const totalNet   = effectivePayslips.reduce((s, p) => s + (p.netSalary || 0), 0);
  const totalEpf12 = effectivePayslips.reduce((s, p) => s + (p.epf12 || 0), 0);
  const totalEtf3  = effectivePayslips.reduce((s, p) => s + (p.etf3 || 0), 0);

  const handleSavePayroll = async () => {
    if (!payrollSummary) return;
    setSaving(true);
    try {
      await api.post('/payroll/save', { month: selectedMonth, overrides: fixedOverrides });
      setSavedSuccess(true);
      if (historyOpen) refetchHistory();
      alert(`Payroll for ${selectedMonth} saved successfully!`);
    } catch (err) {
      console.error(err);
      alert('Error saving payroll to database.');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPayslip = async (ps: Payroll) => {
    const ep = effectivePayslip(ps);
    const empName = ep.employee?.name || 'Employee';
    const empId   = ep.employee?.employeeId || 'Unknown';
    const dept    = ep.employee?.department || 'Operations';
    const pos     = ep.employee?.position || 'Executive';
    await downloadPayslipPDF(ep, empName, empId, dept, pos);
  };

  const handleNotifyReady = async () => {
    setNotifying(true);
    try {
      const res = await api.post<{ message: string }>('/payroll/notify-ready', { month: selectedMonth });
      alert(res.data.message);
    } catch {
      alert('Failed to send notifications.');
    } finally {
      setNotifying(false);
    }
  };

  const handleEmailPayslip = async (ps: Payroll) => {
    const ep = effectivePayslip(ps);
    const toEmail = ep.employee?.email;
    if (!toEmail) { alert('No email address on file for this employee.'); return; }
    const empName = ep.employee?.name || 'Employee';
    const empId   = ep.employee?.employeeId || 'Unknown';
    const dept    = ep.employee?.department || 'Operations';
    const pos     = ep.employee?.position || 'Executive';

    setEmailingId(ps.employeeId);
    try {
      const blob = await generatePayslipPDFBlob(ep, empName, empId, dept, pos);
      const form = new FormData();
      form.append('payslip', blob, `Payslip_${empName}_${ep.month}.pdf`);
      form.append('email', toEmail);
      form.append('name', empName);
      form.append('month', ep.month);
      await api.post('/payroll/email-payslip', form);
      alert(`Payslip emailed to ${toEmail}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert('Failed to email payslip:\n\n' + msg);
    } finally {
      setEmailingId(null);
    }
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
            Select a month, run calculation, adjust any fixed-salary amounts, then save.
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
              setFixedOverrides({});
            }}
          />
          <Button
            className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2 rounded-lg"
            onClick={handleCalculatePayroll}
            disabled={processing || saving || empsLoading || employees.length === 0}
          >
            {processing ? (
              <><div className="w-4 h-4 rounded-full border-2 border-t-transparent border-white animate-spin" /> Calculating...</>
            ) : (
              'Run Calculation'
            )}
          </Button>
        </div>
      </Card>

      {payrollSummary && (
        <div className="space-y-6 animate-fade-in">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <SummaryCard title="Total Payroll Cost"  value={`LKR ${Math.round(totalGross).toLocaleString()}`}  desc="Total Gross Salaries" color="indigo" />
            <SummaryCard title="Net Disbursed"       value={`LKR ${Math.round(totalNet).toLocaleString()}`}    desc="Total to bank accounts"  color="emerald" />
            <SummaryCard title="Employer EPF (12%)"  value={`LKR ${Math.round(totalEpf12).toLocaleString()}`} desc="Contributions to EPF"    color="blue" />
            <SummaryCard title="Employer ETF (3%)"   value={`LKR ${Math.round(totalEtf3).toLocaleString()}`}  desc="Contributions to ETF"    color="amber" />
          </div>

          {/* Payslip Preview Table */}
          <Card className="border border-gray-100 shadow-sm rounded-xl overflow-hidden bg-white">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-gray-900 text-sm">Calculated Monthly Payslips</h4>
                <p className="text-xs text-gray-400">
                  Fixed-salary employees have an editable amount — adjust for this month before saving.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="flex items-center gap-1 text-xs">
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Export CSV
                </Button>
                {savedSuccess ? (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                      <CheckCircle2 className="w-4 h-4" /> Saved & Finalized
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex items-center gap-1.5 text-xs border-blue-200 text-blue-600 hover:bg-blue-50"
                      onClick={handleNotifyReady}
                      disabled={notifying}
                    >
                      {notifying ? (
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent border-blue-600 animate-spin" />
                      ) : (
                        <Bell className="w-3.5 h-3.5" />
                      )}
                      Notify Employees
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 text-xs rounded-lg"
                    onClick={handleSavePayroll}
                    disabled={saving}
                  >
                    {saving ? (
                      <><div className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent border-white animate-spin" /> Saving...</>
                    ) : (
                      <><Save className="w-3.5 h-3.5" /> Save & Finalize</>
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
                    <th className="px-6 py-3 text-center">Type</th>
                    <th className="px-6 py-3 text-center">Days / OT hrs</th>
                    <th className="px-6 py-3 text-right">Gross Salary</th>
                    <th className="px-6 py-3 text-right">Overtime Pay</th>
                    <th className="px-6 py-3 text-right text-rose-600">EPF 8% (Ded)</th>
                    <th className="px-6 py-3 text-right text-emerald-600 font-bold">Net Salary</th>
                    <th className="px-6 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
                  {payrollSummary.payslips.map((ps) => {
                    const isFixed = ps.employee?.salaryProfile?.salaryType === 'fixed';
                    const ep = effectivePayslip(ps);
                    const overrideVal = fixedOverrides[ps.employeeId];

                    return (
                      <tr key={ps.employeeId} className={`hover:bg-gray-50/50 transition-colors ${isFixed ? 'bg-emerald-50/20' : ''}`}>
                        <td className="px-6 py-3.5">
                          <p className="font-bold text-gray-900">{ps.employee?.name || 'Unknown'}</p>
                          <span className="text-[10px] text-gray-400 font-mono">{ps.employee?.employeeId || '—'}</span>
                        </td>
                        <td className="px-6 py-3.5 text-center">
                          {isFixed ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                              <DollarSign className="w-3 h-3" /> Fixed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                              Hourly
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-center">
                          <p className="font-semibold">{ep.workDays} days</p>
                          <p className="text-[10px] text-gray-400">{isFixed ? 'tracking only' : `${ep.overtimeHours} OT hrs`}</p>
                        </td>
                        <td className="px-6 py-3.5 text-right font-mono">
                          {isFixed ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <Pencil className="w-3 h-3 text-emerald-500 shrink-0" />
                              <input
                                type="number"
                                min={0}
                                className="w-28 px-2 py-1 text-xs text-right border border-emerald-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono font-semibold text-gray-900"
                                value={overrideVal !== undefined ? overrideVal : ep.grossSalary}
                                onChange={e => {
                                  const val = Number(e.target.value);
                                  setFixedOverrides(prev => ({ ...prev, [ps.employeeId]: val }));
                                }}
                              />
                            </div>
                          ) : (
                            <span>LKR {(ep.grossSalary || 0).toLocaleString()}</span>
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-right font-mono text-purple-600">
                          {isFixed ? <span className="text-gray-300">—</span> : `LKR ${(ep.overtimePay || 0).toLocaleString()}`}
                        </td>
                        <td className="px-6 py-3.5 text-right font-mono text-rose-600 font-medium">
                          LKR {(ep.epf8 || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-3.5 text-right font-mono text-emerald-700 font-bold">
                          LKR {(ep.netSalary || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-full hover:bg-gray-100 text-blue-600" onClick={() => handleDownloadPayslip(ps)} title="Download PDF">
                              <Download className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-full hover:bg-gray-100 text-emerald-600" onClick={() => handleEmailPayslip(ps)} disabled={emailingId === ps.employeeId} title={ps.employee?.email ? `Email to ${ps.employee.email}` : 'No email'}>
                              {emailingId === ps.employeeId
                                ? <div className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent border-emerald-600 animate-spin" />
                                : <Mail className="w-3.5 h-3.5" />}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {Object.keys(fixedOverrides).length > 0 && (
              <div className="px-6 py-3 bg-amber-50 border-t border-amber-100 text-xs text-amber-700 flex items-center gap-2">
                <Pencil className="w-3.5 h-3.5 shrink-0" />
                {Object.keys(fixedOverrides).length} fixed-salary amount(s) modified for this month. Click <strong className="mx-1">Save & Finalize</strong> to record them.
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Saved Payroll History for selected month */}
      <Card className="border border-gray-100 shadow-sm rounded-xl overflow-hidden bg-white">
        <button
          className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
          onClick={() => {
            setHistoryOpen(o => !o);
          }}
        >
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-gray-500" />
            <span className="font-semibold text-sm text-gray-900">Saved Payroll Records — {selectedMonth}</span>
            {savedPayrolls.length > 0 && (
              <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                {savedPayrolls.length} records
              </span>
            )}
          </div>
          {historyOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </button>

        {historyOpen && (
          savedPayrolls.length === 0 ? (
            <div className="px-6 py-10 text-center text-gray-400 text-sm border-t border-gray-100">
              No payroll has been saved for {selectedMonth} yet.
            </div>
          ) : (
            <div className="overflow-x-auto border-t border-gray-100">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="px-6 py-3">Employee</th>
                    <th className="px-6 py-3 text-center">Days</th>
                    <th className="px-6 py-3 text-right">Gross</th>
                    <th className="px-6 py-3 text-right">OT Pay</th>
                    <th className="px-6 py-3 text-right text-rose-600">EPF 8%</th>
                    <th className="px-6 py-3 text-right">Advance / Loan</th>
                    <th className="px-6 py-3 text-right text-emerald-600 font-bold">Net</th>
                    <th className="px-6 py-3 text-center">Payslip</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
                  {savedPayrolls.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-3">
                        <p className="font-semibold text-gray-900">{p.employee?.name || '—'}</p>
                        <span className="text-[10px] text-gray-400 font-mono">{p.employee?.employeeId || p.employeeId.slice(0, 8)}</span>
                      </td>
                      <td className="px-6 py-3 text-center">{p.workDays}</td>
                      <td className="px-6 py-3 text-right font-mono">LKR {(p.grossSalary || 0).toLocaleString()}</td>
                      <td className="px-6 py-3 text-right font-mono text-purple-600">LKR {(p.overtimePay || 0).toLocaleString()}</td>
                      <td className="px-6 py-3 text-right font-mono text-rose-600">LKR {(p.epf8 || 0).toLocaleString()}</td>
                      <td className="px-6 py-3 text-right font-mono text-amber-600">
                        LKR {((p.salaryAdvance || 0) + (p.loan || 0)).toLocaleString()}
                      </td>
                      <td className="px-6 py-3 text-right font-mono font-bold text-emerald-700">LKR {(p.netSalary || 0).toLocaleString()}</td>
                      <td className="px-6 py-3 text-center">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-full hover:bg-gray-100 text-blue-600" onClick={() => handleDownloadPayslip(p)} title="Download">
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </Card>
    </div>
  );
}

function SummaryCard({ title, value, desc, color }: { title: string; value: string; desc: string; color: 'indigo' | 'emerald' | 'blue' | 'amber' }) {
  const styles = {
    indigo:  { bg: 'bg-indigo-50 border-indigo-100',  text: 'text-indigo-600'  },
    emerald: { bg: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-600' },
    blue:    { bg: 'bg-blue-50 border-blue-100',       text: 'text-blue-600'    },
    amber:   { bg: 'bg-amber-50 border-amber-100',     text: 'text-amber-600'   },
  };
  return (
    <Card className={`p-5 border ${styles[color].bg} flex flex-col gap-1.5`}>
      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{title}</span>
      <span className={`text-xl font-black ${styles[color].text}`}>{value}</span>
      <span className="text-[10px] text-gray-400">{desc}</span>
    </Card>
  );
}
