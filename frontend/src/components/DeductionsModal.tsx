import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/hooks/useApi';
import type { User } from '@/lib/api';
import { X, Plus, Trash2, Edit2, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

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

interface Props {
  employee: User;
  onClose: () => void;
}

export default function DeductionsModal({ employee, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'advances' | 'loans'>('advances');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Deductions — {employee.name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{employee.employeeId} · {employee.department || 'No Department'}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-6">
          {(['advances', 'loans'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 px-4 text-sm font-semibold border-b-2 transition-all capitalize ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'advances' ? 'Salary Advances' : 'Loans & Installments'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'advances'
            ? <AdvancesTab employeeId={employee.id} />
            : <LoansTab employeeId={employee.id} />
          }
        </div>
      </div>
    </div>
  );
}

// ─── Advances Tab ─────────────────────────────────────────────────────────────

function AdvancesTab({ employeeId }: { employeeId: string }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['advances', employeeId],
    queryFn: async () => {
      const res = await api.get<{ advances: SalaryAdvance[] }>(`/employees/${employeeId}/advances`);
      return res.data.advances ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/employees/${employeeId}/advances`, {
        month,
        amount: parseFloat(amount),
        note,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['advances', employeeId] });
      setMonth(''); setAmount(''); setNote(''); setFormError('');
    },
    onError: () => setFormError('Failed to save advance.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/advances/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['advances', employeeId] }),
  });

  const handleAdd = () => {
    if (!month || !amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      setFormError('Please enter a valid month and amount.');
      return;
    }
    createMutation.mutate();
  };

  return (
    <div className="space-y-5">
      <p className="text-xs text-gray-500">
        A salary advance is deducted once from the payslip of the selected month.
      </p>

      {/* Add form */}
      <Card className="p-4 border border-gray-100 space-y-3">
        <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">Record New Advance</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 font-medium">Month</label>
            <input
              type="month"
              className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={month}
              onChange={e => setMonth(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Amount (LKR)</label>
            <input
              type="number"
              min="0"
              placeholder="e.g. 5000"
              className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium">Note (optional)</label>
          <input
            type="text"
            placeholder="e.g. Emergency advance"
            className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={note}
            onChange={e => setNote(e.target.value)}
          />
        </div>
        {formError && (
          <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{formError}</p>
        )}
        <Button
          size="sm"
          className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 text-xs"
          onClick={handleAdd}
          disabled={createMutation.isPending}
        >
          <Plus className="w-3.5 h-3.5" />
          {createMutation.isPending ? 'Saving...' : 'Add Advance'}
        </Button>
      </Card>

      {/* List */}
      {isLoading ? (
        <p className="text-xs text-gray-400 text-center py-4">Loading...</p>
      ) : !data?.length ? (
        <p className="text-xs text-gray-400 text-center py-4">No advances recorded.</p>
      ) : (
        <div className="space-y-2">
          {data.map((adv) => (
            <div key={adv.id} className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg text-sm">
              <div>
                <span className="font-semibold text-gray-900">LKR {adv.amount.toLocaleString()}</span>
                <span className="ml-2 text-xs text-gray-500">{adv.month}</span>
                {adv.note && <span className="ml-2 text-xs text-gray-400">· {adv.note}</span>}
              </div>
              <button
                onClick={() => deleteMutation.mutate(adv.id)}
                className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Loans Tab ────────────────────────────────────────────────────────────────

function LoansTab({ employeeId }: { employeeId: string }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [totalAmount, setTotalAmount] = useState('');
  const [installment, setInstallment] = useState('');
  const [startMonth, setStartMonth] = useState('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editInstallment, setEditInstallment] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['loans', employeeId],
    queryFn: async () => {
      const res = await api.get<{ loans: Loan[] }>(`/employees/${employeeId}/loans`);
      return res.data.loans ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/employees/${employeeId}/loans`, {
        totalAmount: parseFloat(totalAmount),
        monthlyInstallment: parseFloat(installment),
        startMonth,
        note,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans', employeeId] });
      setTotalAmount(''); setInstallment(''); setStartMonth(''); setNote(''); setFormError('');
    },
    onError: () => setFormError('Failed to save loan.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      api.put(`/loans/${id}`, { monthlyInstallment: amount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans', employeeId] });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/loans/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['loans', employeeId] }),
  });

  const handleAdd = () => {
    const total = parseFloat(totalAmount);
    const inst = parseFloat(installment);
    if (!startMonth || isNaN(total) || total <= 0 || isNaN(inst) || inst <= 0) {
      setFormError('Please fill in all fields with valid amounts.');
      return;
    }
    if (inst > total) {
      setFormError('Monthly installment cannot exceed total loan amount.');
      return;
    }
    createMutation.mutate();
  };

  const progressPct = (loan: Loan) =>
    Math.round(((loan.totalAmount - loan.remainingBalance) / loan.totalAmount) * 100);

  return (
    <div className="space-y-5">
      <p className="text-xs text-gray-500">
        Loans are deducted automatically each month until the balance reaches zero.
      </p>

      {/* Add form */}
      <Card className="p-4 border border-gray-100 space-y-3">
        <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">Add New Loan</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 font-medium">Total Loan Amount (LKR)</label>
            <input
              type="number" min="0" placeholder="e.g. 60000"
              className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={totalAmount} onChange={e => setTotalAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Monthly Installment (LKR)</label>
            <input
              type="number" min="0" placeholder="e.g. 5000"
              className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={installment} onChange={e => setInstallment(e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 font-medium">Start Month</label>
            <input
              type="month"
              className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={startMonth} onChange={e => setStartMonth(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Note (optional)</label>
            <input
              type="text" placeholder="e.g. Medical loan"
              className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={note} onChange={e => setNote(e.target.value)}
            />
          </div>
        </div>
        {totalAmount && installment && !isNaN(parseFloat(totalAmount)) && !isNaN(parseFloat(installment)) && parseFloat(installment) > 0 && (
          <p className="text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">
            Estimated duration: {Math.ceil(parseFloat(totalAmount) / parseFloat(installment))} months
          </p>
        )}
        {formError && (
          <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{formError}</p>
        )}
        <Button
          size="sm"
          className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 text-xs"
          onClick={handleAdd}
          disabled={createMutation.isPending}
        >
          <Plus className="w-3.5 h-3.5" />
          {createMutation.isPending ? 'Saving...' : 'Add Loan'}
        </Button>
      </Card>

      {/* List */}
      {isLoading ? (
        <p className="text-xs text-gray-400 text-center py-4">Loading...</p>
      ) : !data?.length ? (
        <p className="text-xs text-gray-400 text-center py-4">No loans recorded.</p>
      ) : (
        <div className="space-y-3">
          {data.map((loan) => (
            <div key={loan.id} className={`border rounded-xl p-4 space-y-3 ${loan.status === 'paid_off' ? 'border-green-100 bg-green-50/50' : 'border-gray-100 bg-white'}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900 text-sm">LKR {loan.totalAmount.toLocaleString()}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${loan.status === 'paid_off' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {loan.status === 'paid_off' ? 'Paid Off' : 'Active'}
                    </span>
                  </div>
                  {loan.note && <p className="text-xs text-gray-400 mt-0.5">{loan.note}</p>}
                  <p className="text-xs text-gray-500 mt-1">Started: {loan.startMonth}</p>
                </div>
                {loan.status === 'active' && (
                  <button
                    onClick={() => deleteMutation.mutate(loan.id)}
                    className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                  <span>Paid: LKR {(loan.totalAmount - loan.remainingBalance).toLocaleString()}</span>
                  <span>Remaining: LKR {loan.remainingBalance.toLocaleString()}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${loan.status === 'paid_off' ? 'bg-green-500' : 'bg-blue-500'}`}
                    style={{ width: `${progressPct(loan)}%` }}
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1 text-right">{progressPct(loan)}% repaid</p>
              </div>

              {/* Installment edit */}
              {loan.status === 'active' && (
                <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                  <span className="text-xs text-gray-500">Monthly deduction:</span>
                  {editingId === loan.id ? (
                    <>
                      <input
                        type="number" min="0"
                        className="w-28 px-2 py-1 text-xs border border-blue-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={editInstallment}
                        onChange={e => setEditInstallment(e.target.value)}
                      />
                      <button
                        onClick={() => updateMutation.mutate({ id: loan.id, amount: parseFloat(editInstallment) })}
                        className="p-1 rounded hover:bg-green-50 text-green-600"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setEditingId(null)} className="p-1 rounded hover:bg-gray-100 text-gray-400">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-xs font-semibold text-gray-900 font-mono">
                        LKR {loan.monthlyInstallment.toLocaleString()}
                      </span>
                      <button
                        onClick={() => { setEditingId(loan.id); setEditInstallment(String(loan.monthlyInstallment)); }}
                        className="p-1 rounded hover:bg-gray-100 text-gray-400"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
