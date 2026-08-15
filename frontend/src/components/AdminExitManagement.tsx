import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/hooks/useApi';
import type { User, ExitRecord, ExitSettlementPreview } from '@/lib/api';
import {
  LogOut, Plus, X, CheckCircle, Clock, Flag, Trash2,
  DollarSign, CalendarDays, AlertTriangle, ChevronDown, ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const STATUS_STYLE: Record<string, string> = {
  pending:   'bg-amber-50 text-amber-700 border-amber-200',
  approved:  'bg-blue-50 text-blue-700 border-blue-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  pending:   <Clock className="w-3.5 h-3.5" />,
  approved:  <CheckCircle className="w-3.5 h-3.5" />,
  completed: <Flag className="w-3.5 h-3.5" />,
};

const EMPTY_FORM = {
  employeeId: '',
  exitType: 'resignation' as 'resignation' | 'termination',
  noticeDate: '',
  lastWorkingDay: '',
  reason: '',
  leavePayoutElected: false,
  gratuityAmount: 0,
  notes: '',
};

export default function AdminExitManagement() {
  const api = useApi();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errorMsg, setErrorMsg] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: exitsData, isLoading } = useQuery({
    queryKey: ['exits'],
    queryFn: async () => {
      const res = await api.get<{ exits: ExitRecord[] }>('/exits');
      return res.data.exits;
    },
  });

  const { data: employeesData } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const res = await api.get<{ employees: User[] }>('/employees');
      return res.data.employees;
    },
  });

  const { data: preview, refetch: refetchPreview } = useQuery({
    queryKey: ['exit-settlement', form.employeeId],
    queryFn: async () => {
      if (!form.employeeId) return null;
      const res = await api.get<ExitSettlementPreview>(`/employees/${form.employeeId}/exit-settlement`);
      return res.data;
    },
    enabled: !!form.employeeId,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: typeof EMPTY_FORM) =>
      api.post(`/employees/${payload.employeeId}/exit`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exits'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setForm(EMPTY_FORM);
      setShowForm(false);
      setErrorMsg('');
    },
    onError: (err: any) => setErrorMsg(err.response?.data?.error || 'Failed to create exit record'),
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => api.put(`/exits/${id}/approve`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exits'] }),
  });

  const completeMutation = useMutation({
    mutationFn: async (id: string) => api.put(`/exits/${id}/complete`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exits'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/exits/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exits'] }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employeeId) { setErrorMsg('Please select an employee'); return; }
    createMutation.mutate(form);
  };

  const exits = exitsData ?? [];
  const employees = (employeesData ?? []).filter(e => e.isActive);

  const leavePayout = form.leavePayoutElected && preview
    ? preview.leavePayoutAmount
    : 0;

  const estimatedTotal = leavePayout + form.gratuityAmount - (preview?.outstandingLoans ?? 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <LogOut className="w-5 h-5 text-red-600" />
            Exit Management
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">Track resignations and terminations with final settlements.</p>
        </div>
        <Button
          onClick={() => { setForm(EMPTY_FORM); setShowForm(true); setErrorMsg(''); }}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white"
        >
          <Plus className="w-4 h-4" />
          New Exit
        </Button>
      </div>

      {/* New Exit Form */}
      {showForm && (
        <Card className="border border-red-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-red-600 to-rose-600 text-white flex justify-between items-center">
            <h3 className="font-bold">Initiate Exit Process</h3>
            <button onClick={() => setShowForm(false)} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {errorMsg && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">
                {errorMsg}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Employee *</label>
                <select
                  required
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  value={form.employeeId}
                  onChange={e => {
                    setForm(p => ({ ...p, employeeId: e.target.value }));
                    setTimeout(() => refetchPreview(), 100);
                  }}
                >
                  <option value="">Select employee...</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.employeeId})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Exit Type *</label>
                <select
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  value={form.exitType}
                  onChange={e => setForm(p => ({ ...p, exitType: e.target.value as any }))}
                >
                  <option value="resignation">Resignation</option>
                  <option value="termination">Termination</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Notice Date</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  value={form.noticeDate}
                  onChange={e => setForm(p => ({ ...p, noticeDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Last Working Day</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  value={form.lastWorkingDay}
                  onChange={e => setForm(p => ({ ...p, lastWorkingDay: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Reason</label>
              <textarea
                rows={2}
                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                placeholder="Reason for exit..."
                value={form.reason}
                onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
              />
            </div>

            {/* Settlement Section */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  Final Settlement
                </h4>
              </div>
              <div className="p-4 space-y-4">
                {preview && form.employeeId && (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-xs text-blue-600 font-medium">Leave Remaining</p>
                      <p className="text-lg font-bold text-blue-900">{preview.leaveRemainingDays} days</p>
                      <p className="text-xs text-blue-500">Daily rate: LKR {preview.dailyRate.toLocaleString()}</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-3">
                      <p className="text-xs text-red-600 font-medium">Outstanding Loans</p>
                      <p className="text-lg font-bold text-red-900">LKR {preview.outstandingLoans.toLocaleString()}</p>
                      <p className="text-xs text-red-500">Deducted from settlement</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <input
                    type="checkbox"
                    id="leavePayoutElected"
                    className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                    checked={form.leavePayoutElected}
                    onChange={e => setForm(p => ({ ...p, leavePayoutElected: e.target.checked }))}
                  />
                  <label htmlFor="leavePayoutElected" className="text-sm text-gray-700 flex-1 cursor-pointer">
                    Pay out remaining annual leave days as cash
                    {form.leavePayoutElected && preview && (
                      <span className="ml-2 font-semibold text-green-700">
                        → LKR {preview.leavePayoutAmount.toLocaleString()}
                      </span>
                    )}
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Gratuity Amount (LKR)</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    value={form.gratuityAmount || ''}
                    onChange={e => setForm(p => ({ ...p, gratuityAmount: Number(e.target.value) || 0 }))}
                    placeholder="0"
                  />
                </div>

                {form.employeeId && (
                  <div className={`p-3 rounded-lg border text-sm font-semibold flex justify-between items-center ${
                    estimatedTotal >= 0 ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
                  }`}>
                    <span>Estimated Net Settlement</span>
                    <span>LKR {estimatedTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Notes</label>
                  <textarea
                    rows={2}
                    className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                    placeholder="Additional notes..."
                    value={form.notes}
                    onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button type="submit" className="bg-red-600 hover:bg-red-700 text-white" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Exit Record'}
              </Button>
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); setErrorMsg(''); }}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Exits List */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading exit records...</div>
      ) : exits.length === 0 ? (
        <Card className="p-12 text-center">
          <LogOut className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No exit records yet</p>
          <p className="text-gray-400 text-sm mt-1">Exit records will appear here when an employee leaves.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {exits.map(exit => (
            <Card key={exit.id} className="border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-rose-600 text-white flex items-center justify-center font-bold text-sm shadow-inner shrink-0">
                    {(exit.employee?.name ?? 'U').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{exit.employee?.name ?? exit.employeeId}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
                      <span className="capitalize font-medium text-gray-600">{exit.exitType}</span>
                      {exit.lastWorkingDay && (
                        <>
                          <span>·</span>
                          <CalendarDays className="w-3 h-3" />
                          <span>Last day: {exit.lastWorkingDay}</span>
                        </>
                      )}
                      <span>·</span>
                      <span>Settlement: LKR {exit.totalSettlement.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_STYLE[exit.status]}`}>
                    {STATUS_ICON[exit.status]}
                    {exit.status.charAt(0).toUpperCase() + exit.status.slice(1)}
                  </span>

                  {exit.status === 'pending' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-blue-600 border-blue-200 hover:bg-blue-50 text-xs"
                      onClick={() => { if (confirm('Approve this exit?')) approveMutation.mutate(exit.id); }}
                      disabled={approveMutation.isPending}
                    >
                      Approve
                    </Button>
                  )}
                  {exit.status === 'approved' && (
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white text-xs"
                      onClick={() => { if (confirm('Complete exit and deactivate employee?')) completeMutation.mutate(exit.id); }}
                      disabled={completeMutation.isPending}
                    >
                      Complete
                    </Button>
                  )}

                  <button
                    onClick={() => setExpandedId(expandedId === exit.id ? null : exit.id)}
                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    {expandedId === exit.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {exit.status !== 'completed' && (
                    <button
                      onClick={() => { if (confirm('Delete this exit record?')) deleteMutation.mutate(exit.id); }}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {expandedId === exit.id && (
                <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 space-y-4">
                  {exit.reason && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Reason</p>
                      <p className="text-sm text-gray-700">{exit.reason}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <SettlementCell label="Leave Remaining" value={`${exit.leaveRemainingDays} days`} />
                    <SettlementCell
                      label="Leave Payout"
                      value={exit.leavePayoutElected ? `LKR ${exit.leavePayoutAmount.toLocaleString()}` : 'Not elected'}
                      positive={exit.leavePayoutElected}
                    />
                    <SettlementCell
                      label="Outstanding Loans"
                      value={`LKR ${exit.outstandingLoans.toLocaleString()}`}
                      negative={exit.outstandingLoans > 0}
                    />
                    <SettlementCell
                      label="Gratuity"
                      value={`LKR ${exit.gratuityAmount.toLocaleString()}`}
                      positive={exit.gratuityAmount > 0}
                    />
                  </div>

                  <div className={`flex justify-between items-center px-4 py-3 rounded-lg font-semibold text-sm ${
                    exit.totalSettlement >= 0 ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
                  }`}>
                    <span>Net Final Settlement</span>
                    <span>LKR {exit.totalSettlement.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>

                  {exit.notes && (
                    <div className="flex gap-2 text-sm text-gray-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <p>{exit.notes}</p>
                    </div>
                  )}

                  <div className="flex gap-4 text-xs text-gray-400">
                    {exit.approvedBy && <span>Approved by {exit.approvedBy}</span>}
                    {exit.completedAt && <span>· Completed {new Date(exit.completedAt).toLocaleDateString()}</span>}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function SettlementCell({ label, value, positive, negative }: {
  label: string; value: string; positive?: boolean; negative?: boolean;
}) {
  return (
    <div className={`rounded-lg p-3 border ${positive ? 'bg-green-50 border-green-100' : negative ? 'bg-red-50 border-red-100' : 'bg-white border-gray-200'}`}>
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`text-sm font-bold ${positive ? 'text-green-700' : negative ? 'text-red-700' : 'text-gray-800'}`}>{value}</p>
    </div>
  );
}
