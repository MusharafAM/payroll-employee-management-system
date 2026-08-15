import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/hooks/useApi';
import type { PublicHoliday } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  CalendarDays, Plus, Pencil, Trash2, ChevronLeft, ChevronRight,
  AlertCircle, X, Briefcase, Ban,
} from 'lucide-react';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

interface HolidayForm {
  date: string;
  name: string;
  isWorkday: boolean;
  rateMultiplier: number;
  description: string;
}

const emptyForm = (): HolidayForm => ({
  date: '',
  name: '',
  isWorkday: false,
  rateMultiplier: 2.0,
  description: '',
});

export default function AdminHolidays() {
  const api = useApi();
  const queryClient = useQueryClient();

  const [year, setYear] = useState(new Date().getFullYear());
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<HolidayForm>(emptyForm());
  const [formError, setFormError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['holidays', year],
    queryFn: async () => {
      const res = await api.get<{ holidays: PublicHoliday[] }>(`/holidays?year=${year}`);
      return res.data.holidays ?? [];
    },
  });

  const holidays = data ?? [];

  // Group holidays by month
  const byMonth = useMemo(() => {
    const map: Record<number, PublicHoliday[]> = {};
    for (const h of holidays) {
      const m = new Date(h.date).getMonth();
      if (!map[m]) map[m] = [];
      map[m].push(h);
    }
    return map;
  }, [holidays]);

  const createMutation = useMutation({
    mutationFn: async (payload: HolidayForm) => api.post('/holidays', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays', year] });
      closeModal();
    },
    onError: (err: any) => setFormError(err.response?.data?.error || 'Failed to create holiday.'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: HolidayForm }) =>
      api.put(`/holidays/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays', year] });
      closeModal();
    },
    onError: (err: any) => setFormError(err.response?.data?.error || 'Failed to update holiday.'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/holidays/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays', year] });
      setDeleteConfirm(null);
    },
  });

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (h: PublicHoliday) => {
    setEditingId(h.id);
    setForm({
      date: h.date.slice(0, 10),
      name: h.name,
      isWorkday: h.isWorkday,
      rateMultiplier: h.rateMultiplier,
      description: h.description,
    });
    setFormError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm(emptyForm());
    setFormError('');
  };

  const handleSubmit = () => {
    if (!form.date) { setFormError('Date is required.'); return; }
    if (!form.name.trim()) { setFormError('Name is required.'); return; }
    if (form.isWorkday && form.rateMultiplier <= 0) {
      setFormError('Rate multiplier must be greater than 0.'); return;
    }
    setFormError('');
    if (editingId) {
      updateMutation.mutate({ id: editingId, payload: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center">
            <CalendarDays className="w-5 h-5 text-rose-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Public Holiday Calendar</h2>
            <p className="text-xs text-gray-500">Holidays are auto-excluded from payroll. Working holidays are paid at the configured rate.</p>
          </div>
        </div>
        <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Holiday
        </Button>
      </div>

      {/* Year Navigator */}
      <div className="flex items-center justify-center gap-4">
        <button onClick={() => setYear(y => y - 1)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <span className="text-xl font-bold text-gray-900 w-16 text-center">{year}</span>
        <button onClick={() => setYear(y => y + 1)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" /> Public Holiday (excluded from payroll)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" /> Working Holiday (paid at multiplied rate)
        </span>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-gray-400 text-sm">Loading holidays...</div>
      ) : isError ? (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm text-center">
          Failed to load holidays.
        </div>
      ) : holidays.length === 0 ? (
        <Card className="p-12 text-center border border-dashed border-gray-200 bg-gray-50">
          <CalendarDays className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No holidays configured for {year}</p>
          <p className="text-xs text-gray-400 mt-1">Click "Add Holiday" to get started.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {MONTHS.map((monthName, monthIdx) => {
            const monthHolidays = byMonth[monthIdx];
            if (!monthHolidays?.length) return null;
            return (
              <div key={monthIdx}>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{monthName}</h3>
                <Card className="divide-y divide-gray-100 border border-gray-100 shadow-sm rounded-xl overflow-hidden bg-white">
                  {monthHolidays.map((h) => {
                    const d = new Date(h.date);
                    const dayNum = d.getUTCDate();
                    const dayName = d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });

                    return (
                      <div key={h.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/50 transition-colors">
                        {/* Date bubble */}
                        <div className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center shrink-0 ${h.isWorkday ? 'bg-amber-50 border border-amber-100' : 'bg-rose-50 border border-rose-100'}`}>
                          <span className={`text-xs font-semibold ${h.isWorkday ? 'text-amber-600' : 'text-rose-600'}`}>{dayName}</span>
                          <span className={`text-lg font-bold leading-none ${h.isWorkday ? 'text-amber-700' : 'text-rose-700'}`}>{dayNum}</span>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate">{h.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {h.isWorkday ? (
                              <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                                <Briefcase className="w-3 h-3" /> Working Holiday · {h.rateMultiplier}× rate
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-full px-2 py-0.5">
                                <Ban className="w-3 h-3" /> Public Holiday
                              </span>
                            )}
                            {h.description && (
                              <span className="text-xs text-gray-400 truncate">{h.description}</span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => openEdit(h)}
                            className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {deleteConfirm === h.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => deleteMutation.mutate(h.id)}
                                className="text-xs px-2 py-1 bg-rose-600 text-white rounded-lg hover:bg-rose-700"
                                disabled={deleteMutation.isPending}
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="text-xs px-2 py-1 border border-gray-200 rounded-lg hover:bg-gray-50"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(h.id)}
                              className="p-2 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </Card>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">{editingId ? 'Edit Holiday' : 'Add Holiday'}</h3>
              <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Date + Name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Date</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Holiday Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Eid Al-Adha"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>
              </div>

              {/* Type selector */}
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-2 block">How should this date be treated?</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, isWorkday: false }))}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                      !form.isWorkday
                        ? 'border-rose-500 bg-rose-50 text-rose-700'
                        : 'border-gray-200 text-gray-400 hover:border-gray-300'
                    }`}
                  >
                    <Ban className="w-5 h-5" />
                    Public Holiday
                    <span className="text-xs font-normal text-center leading-tight">
                      {!form.isWorkday ? 'Excluded from payroll' : 'Employees don\'t work'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, isWorkday: true }))}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                      form.isWorkday
                        ? 'border-amber-500 bg-amber-50 text-amber-700'
                        : 'border-gray-200 text-gray-400 hover:border-gray-300'
                    }`}
                  >
                    <Briefcase className="w-5 h-5" />
                    Working Holiday
                    <span className="text-xs font-normal text-center leading-tight">
                      {form.isWorkday ? 'Paid at multiplied rate' : 'Employees work this day'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Rate multiplier (only for working holidays) */}
              {form.isWorkday && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                  <label className="text-xs font-semibold text-amber-800 block">
                    Hourly rate multiplier for this day
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      step="0.25"
                      min="1"
                      className="w-28 px-3 py-2 text-sm border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white text-center font-bold text-amber-800"
                      value={form.rateMultiplier}
                      onChange={e => setForm(f => ({ ...f, rateMultiplier: Number(e.target.value) }))}
                    />
                    <span className="text-sm text-amber-700 font-semibold">× hourly rate</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[1.5, 2.0, 2.5, 3.0].map(v => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, rateMultiplier: v }))}
                        className={`text-xs px-2.5 py-1 rounded-full border font-semibold transition-colors ${
                          form.rateMultiplier === v
                            ? 'bg-amber-500 border-amber-500 text-white'
                            : 'border-amber-300 text-amber-700 hover:bg-amber-100'
                        }`}
                      >
                        {v}×
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-amber-600">
                    Example: at {form.rateMultiplier}×, an employee earning LKR 200/hr will earn LKR {(200 * form.rateMultiplier).toFixed(0)}/hr for hours worked on this day.
                  </p>
                </div>
              )}

              {/* Description */}
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Description <span className="font-normal text-gray-400">(optional)</span></label>
                <input
                  type="text"
                  placeholder="Any notes about this holiday"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>

              {formError && (
                <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-lg">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {formError}
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex justify-end gap-2 px-6 pb-5">
              <Button variant="outline" onClick={closeModal} disabled={isPending}>Cancel</Button>
              <Button
                onClick={handleSubmit}
                disabled={isPending}
                className={form.isWorkday ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-rose-600 hover:bg-rose-700 text-white'}
              >
                {isPending ? 'Saving...' : editingId ? 'Save Changes' : 'Add Holiday'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
