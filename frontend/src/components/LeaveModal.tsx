import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/hooks/useApi';
import type { User, LeaveRecord, LeaveBalance } from '@/lib/api';
import { X, Plus, Trash2, AlertCircle, CalendarDays, Edit2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface Props {
  employee: User;
  onClose: () => void;
}

export default function LeaveModal({ employee, onClose }: Props) {
  const api = useApi();
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [date, setDate] = useState('');
  const [days, setDays] = useState('1');
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState('');
  const [editingEntitlement, setEditingEntitlement] = useState(false);
  const [entitlementInput, setEntitlementInput] = useState(String(employee.annualLeaveEntitlement ?? 14));

  const { data: balance, isLoading: balanceLoading } = useQuery({
    queryKey: ['leave-balance', employee.id, year],
    queryFn: async () => {
      const res = await api.get<LeaveBalance>(`/employees/${employee.id}/leave-balance?year=${year}`);
      return res.data;
    },
  });

  const { data: leaves, isLoading: leavesLoading } = useQuery({
    queryKey: ['leaves', employee.id, year],
    queryFn: async () => {
      const res = await api.get<{ leaves: LeaveRecord[] }>(`/employees/${employee.id}/leaves?year=${year}`);
      return res.data.leaves ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/employees/${employee.id}/leaves`, {
        date,
        days: parseFloat(days),
        reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaves', employee.id, year] });
      queryClient.invalidateQueries({ queryKey: ['leave-balance', employee.id, year] });
      setDate(''); setDays('1'); setReason(''); setFormError('');
    },
    onError: () => setFormError('Failed to record leave.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/leaves/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaves', employee.id, year] });
      queryClient.invalidateQueries({ queryKey: ['leave-balance', employee.id, year] });
    },
  });

  const entitlementMutation = useMutation({
    mutationFn: (val: number) =>
      api.put(`/employees/${employee.id}/leave-entitlement`, { annualLeaveEntitlement: val }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-balance', employee.id, year] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setEditingEntitlement(false);
    },
  });

  const handleAdd = () => {
    const d = parseFloat(days);
    if (!date || isNaN(d) || d <= 0) {
      setFormError('Please enter a valid date and number of days.');
      return;
    }
    createMutation.mutate();
  };

  const remainingPct = balance
    ? Math.max(0, Math.round((balance.remaining / (balance.entitlement || 1)) * 100))
    : 0;

  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Leave Management — {employee.name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{employee.employeeId} · {employee.department || 'No Department'}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Year selector */}
        <div className="flex items-center gap-2 px-6 pt-4">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Year</span>
          <div className="flex gap-1">
            {yearOptions.map((y) => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className={`px-3 py-1 text-xs font-semibold rounded-full transition-all ${
                  year === y
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Balance card */}
          <Card className="p-4 border border-gray-100 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-blue-600" />
                Leave Balance {year}
              </p>
              {/* Edit entitlement */}
              <div className="flex items-center gap-1.5">
                {editingEntitlement ? (
                  <>
                    <span className="text-xs text-gray-500">Entitlement:</span>
                    <input
                      type="number"
                      min="0"
                      className="w-16 px-2 py-1 text-xs border border-blue-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                      value={entitlementInput}
                      onChange={e => setEntitlementInput(e.target.value)}
                    />
                    <span className="text-xs text-gray-500">days</span>
                    <button
                      onClick={() => entitlementMutation.mutate(parseInt(entitlementInput))}
                      disabled={entitlementMutation.isPending}
                      className="p-1 rounded hover:bg-green-50 text-green-600"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setEditingEntitlement(false)} className="p-1 rounded hover:bg-gray-100 text-gray-400">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => { setEditingEntitlement(true); setEntitlementInput(String(balance?.entitlement ?? employee.annualLeaveEntitlement ?? 14)); }}
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <Edit2 className="w-3 h-3" /> Edit entitlement
                  </button>
                )}
              </div>
            </div>

            {balanceLoading ? (
              <p className="text-xs text-gray-400 text-center py-2">Loading...</p>
            ) : balance ? (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-gray-50 rounded-xl">
                    <p className="text-2xl font-bold text-gray-900">{balance.entitlement}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-wide">Entitled</p>
                  </div>
                  <div className="text-center p-3 bg-amber-50 rounded-xl">
                    <p className="text-2xl font-bold text-amber-600">{balance.used}</p>
                    <p className="text-[10px] text-amber-500 mt-0.5 uppercase tracking-wide">Used</p>
                  </div>
                  <div className={`text-center p-3 rounded-xl ${balance.remaining < 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                    <p className={`text-2xl font-bold ${balance.remaining < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {balance.remaining}
                    </p>
                    <p className={`text-[10px] mt-0.5 uppercase tracking-wide ${balance.remaining < 0 ? 'text-red-400' : 'text-green-500'}`}>
                      Remaining
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                    <span>{balance.used} days used</span>
                    <span>{remainingPct}% remaining</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        balance.remaining < 0 ? 'bg-red-500' : balance.remaining === 0 ? 'bg-amber-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${Math.min(100, 100 - remainingPct)}%` }}
                    />
                  </div>
                </div>
              </>
            ) : null}
          </Card>

          {/* Add leave form */}
          <Card className="p-4 border border-gray-100 space-y-3">
            <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">Record Leave</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-gray-500 font-medium">Date</label>
                <input
                  type="date"
                  className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium">Days</label>
                <select
                  className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={days}
                  onChange={e => setDays(e.target.value)}
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
                placeholder="e.g. Medical, Personal"
                className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={reason}
                onChange={e => setReason(e.target.value)}
              />
            </div>
            {formError && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />{formError}
              </p>
            )}
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 text-xs"
              onClick={handleAdd}
              disabled={createMutation.isPending}
            >
              <Plus className="w-3.5 h-3.5" />
              {createMutation.isPending ? 'Saving...' : 'Record Leave'}
            </Button>
          </Card>

          {/* Leave history */}
          <div>
            <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">Leave History {year}</p>
            {leavesLoading ? (
              <p className="text-xs text-gray-400 text-center py-4">Loading...</p>
            ) : !leaves?.length ? (
              <p className="text-xs text-gray-400 text-center py-4 border border-dashed rounded-lg">No leave records for {year}.</p>
            ) : (
              <div className="space-y-2">
                {leaves.map((leave) => (
                  <div key={leave.id} className={`flex items-center justify-between px-4 py-3 rounded-lg text-sm border ${
                    leave.status === 'pending'  ? 'bg-amber-50 border-amber-100' :
                    leave.status === 'rejected' ? 'bg-red-50 border-red-100' :
                    'bg-gray-50 border-gray-100'
                  }`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-gray-900">
                        {new Date(leave.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        leave.days === 0.5 ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {leave.days === 0.5 ? 'Half day' : 'Full day'}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                        leave.status === 'pending'  ? 'bg-amber-100 text-amber-700' :
                        leave.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {leave.status === 'pending' ? 'Pending' : leave.status === 'rejected' ? 'Rejected' : 'Approved'}
                      </span>
                      {leave.reason && (
                        <span className="text-xs text-gray-400">· {leave.reason}</span>
                      )}
                    </div>
                    <button
                      onClick={() => deleteMutation.mutate(leave.id)}
                      className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
