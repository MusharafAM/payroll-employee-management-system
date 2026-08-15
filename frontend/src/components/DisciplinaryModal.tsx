import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/hooks/useApi';
import type { User, DisciplinaryRecord } from '@/lib/api';
import { X, Plus, Trash2, AlertTriangle, AlertCircle, FileWarning } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  employee: User;
  onClose: () => void;
}

const TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  warning:  { label: 'Warning',  icon: <AlertTriangle className="w-4 h-4" />, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  incident: { label: 'Incident', icon: <AlertCircle className="w-4 h-4" />,   color: 'text-red-600 bg-red-50 border-red-200' },
  letter:   { label: 'Letter',   icon: <FileWarning className="w-4 h-4" />,   color: 'text-blue-600 bg-blue-50 border-blue-200' },
};

const SEVERITY_COLOR: Record<string, string> = {
  low:    'bg-green-100 text-green-700',
  medium: 'bg-amber-100 text-amber-700',
  high:   'bg-red-100 text-red-700',
};

const EMPTY_FORM = { type: 'warning', severity: 'low', date: '', description: '' };

export default function DisciplinaryModal({ employee, onClose }: Props) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errorMsg, setErrorMsg] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['disciplinary', employee.id],
    queryFn: async () => {
      const res = await api.get<{ records: DisciplinaryRecord[] }>(`/employees/${employee.id}/disciplinary`);
      return res.data.records;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: typeof EMPTY_FORM) =>
      api.post(`/employees/${employee.id}/disciplinary`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disciplinary', employee.id] });
      setForm(EMPTY_FORM);
      setShowForm(false);
      setErrorMsg('');
    },
    onError: (err: any) => setErrorMsg(err.response?.data?.error || 'Failed to create record'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/disciplinary/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['disciplinary', employee.id] }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.date) { setErrorMsg('Date is required'); return; }
    createMutation.mutate(form);
  };

  const records = data ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[85vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-rose-600 to-red-600 text-white flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-lg font-bold">Disciplinary Records</h3>
            <p className="text-xs text-rose-100">{employee.name} · {employee.employeeId}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Add Record Form */}
          {showForm ? (
            <form onSubmit={handleSubmit} className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-800">New Record</h4>
              {errorMsg && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{errorMsg}</p>}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                  <select
                    className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                    value={form.type}
                    onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                  >
                    <option value="warning">Warning</option>
                    <option value="incident">Incident</option>
                    <option value="letter">Formal Letter</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Severity</label>
                  <select
                    className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                    value={form.severity}
                    onChange={e => setForm(p => ({ ...p, severity: e.target.value }))}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                    value={form.date}
                    onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <textarea
                  rows={3}
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
                  placeholder="Describe the incident or reason..."
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" className="bg-rose-600 hover:bg-rose-700 text-white" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Saving...' : 'Save Record'}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => { setShowForm(false); setErrorMsg(''); }}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <Button
              onClick={() => setShowForm(true)}
              size="sm"
              variant="outline"
              className="flex items-center gap-2 border-dashed border-rose-300 text-rose-600 hover:bg-rose-50"
            >
              <Plus className="w-4 h-4" />
              Add Record
            </Button>
          )}

          {/* Records List */}
          {isLoading ? (
            <div className="text-center py-8 text-gray-400 text-sm">Loading records...</div>
          ) : records.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">No disciplinary records for this employee.</div>
          ) : (
            <div className="space-y-3">
              {records.map(r => {
                const typeInfo = TYPE_LABELS[r.type] ?? TYPE_LABELS.warning;
                return (
                  <div key={r.id} className="bg-white border border-gray-100 rounded-xl p-4 flex gap-4 items-start shadow-sm">
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border shrink-0 ${typeInfo.color}`}>
                      {typeInfo.icon}
                      {typeInfo.label}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${SEVERITY_COLOR[r.severity]}`}>
                          {r.severity}
                        </span>
                        <span className="text-xs text-gray-400">{r.date}</span>
                        <span className="text-xs text-gray-400">· by {r.issuedBy}</span>
                      </div>
                      {r.description && (
                        <p className="text-sm text-gray-700 leading-relaxed">{r.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => { if (confirm('Delete this record?')) deleteMutation.mutate(r.id); }}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex justify-between items-center">
          <p className="text-xs text-gray-400">{records.length} record{records.length !== 1 ? 's' : ''} total</p>
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
