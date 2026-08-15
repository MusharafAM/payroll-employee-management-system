import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/hooks/useApi';
import type { PerformanceReview, User } from '@/lib/api';
import { Star, Plus, Pencil, Trash2, ChevronDown, ChevronUp, User as UserIcon, Calculator } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const RATINGS = [
  { value: 'excellent',         label: 'Excellent',           color: 'bg-emerald-100 text-emerald-700' },
  { value: 'good',              label: 'Good',                color: 'bg-blue-100 text-blue-700' },
  { value: 'satisfactory',      label: 'Satisfactory',        color: 'bg-gray-100 text-gray-700' },
  { value: 'needs_improvement', label: 'Needs Improvement',   color: 'bg-amber-100 text-amber-700' },
  { value: 'unsatisfactory',    label: 'Unsatisfactory',      color: 'bg-red-100 text-red-700' },
] as const;

function ratingStyle(rating: string) {
  return RATINGS.find(r => r.value === rating)?.color ?? 'bg-gray-100 text-gray-700';
}

function ratingLabel(rating: string) {
  return RATINGS.find(r => r.value === rating)?.label ?? rating;
}

interface ScoreResult {
  totalDays: number;
  onTimeDays: number;
  lateDays: number;
  noTimeIn: number;
  punctualityPct: number;
  shiftStartTime: string;
}

interface FormState {
  employeeId: string;
  reviewPeriod: string;
  reviewDate: string;
  rating: string;
  strengths: string;
  areasForImprovement: string;
  goals: string;
  notes: string;
  status: string;
  attendanceScore: number | null;
}

const defaultForm: FormState = {
  employeeId: '',
  reviewPeriod: '',
  reviewDate: new Date().toISOString().slice(0, 10),
  rating: 'satisfactory',
  strengths: '',
  areasForImprovement: '',
  goals: '',
  notes: '',
  status: 'draft',
  attendanceScore: null,
};

export default function AdminPerformanceReviews() {
  const api = useApi();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null);

  const [scoreFrom, setScoreFrom] = useState('');
  const [scoreTo, setScoreTo] = useState('');
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);
  const [scoreFetching, setScoreFetching] = useState(false);

  const handleCalculateScore = async () => {
    if (!form.employeeId || !scoreFrom || !scoreTo) return;
    setScoreFetching(true);
    setScoreResult(null);
    try {
      const res = await api.get<ScoreResult>(
        `/employees/${form.employeeId}/attendance-score?from=${scoreFrom}&to=${scoreTo}`
      );
      setScoreResult(res.data);
      setForm(f => ({ ...f, attendanceScore: res.data.punctualityPct }));
    } catch {
      // silently fail — admin can enter manually
    } finally {
      setScoreFetching(false);
    }
  };

  const { data: reviewsData, isLoading } = useQuery({
    queryKey: ['performance-reviews'],
    queryFn: async () => {
      const res = await api.get<{ reviews: PerformanceReview[] }>('/performance-reviews');
      return res.data;
    },
  });

  const { data: empData } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const res = await api.get<{ employees: User[] }>('/employees');
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: FormState) =>
      api.post(`/employees/${data.employeeId}/performance-reviews`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance-reviews'] });
      setShowForm(false);
      setForm(defaultForm);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<FormState> }) =>
      api.put(`/performance-reviews/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance-reviews'] });
      setEditId(null);
      setForm(defaultForm);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/performance-reviews/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance-reviews'] });
    },
  });

  const reviews = reviewsData?.reviews ?? [];
  const employees = empData?.employees ?? [];

  // Group reviews by employee for the collapsed/expanded employee view
  const byEmployee = employees
    .filter(e => reviews.some(r => r.employeeId === e.id))
    .map(e => ({
      employee: e,
      reviews: reviews.filter(r => r.employeeId === e.id),
    }));

  const employeesWithoutReview = employees.filter(
    e => !reviews.some(r => r.employeeId === e.id)
  );

  function startEdit(review: PerformanceReview) {
    setEditId(review.id);
    setForm({
      employeeId: review.employeeId,
      reviewPeriod: review.reviewPeriod,
      reviewDate: review.reviewDate,
      rating: review.rating,
      strengths: review.strengths,
      areasForImprovement: review.areasForImprovement,
      goals: review.goals,
      notes: review.notes,
      status: review.status,
      attendanceScore: review.attendanceScore || null,
    });
    setScoreResult(null);
    setScoreFrom('');
    setScoreTo('');
    setShowForm(false);
  }

  function cancelForm() {
    setShowForm(false);
    setEditId(null);
    setForm(defaultForm);
    setScoreResult(null);
    setScoreFrom('');
    setScoreTo('');
  }

  function handleSubmit() {
    if (editId) {
      updateMutation.mutate({ id: editId, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Star className="w-5 h-5 text-blue-600" />
            Performance Reviews
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">Record and track periodic review cycles for employees.</p>
        </div>
        {!showForm && !editId && (
          <Button
            size="sm"
            className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => setShowForm(true)}
          >
            <Plus className="w-4 h-4" />
            New Review
          </Button>
        )}
      </div>

      {/* Create / Edit form */}
      {(showForm || editId) && (
        <Card className="p-6 border border-blue-100 bg-blue-50/30 space-y-5">
          <h3 className="text-sm font-semibold text-gray-800">
            {editId ? 'Edit Review' : 'New Performance Review'}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Employee (create only) */}
            {!editId && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Employee *</label>
                <select
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={form.employeeId}
                  onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}
                >
                  <option value="">Select employee…</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.employeeId}) {e.department ? `— ${e.department}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Review Period */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Review Period *</label>
              <input
                type="text"
                placeholder="e.g. 2025-H1, 2025-Q3, 2025-Annual"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.reviewPeriod}
                onChange={e => setForm(f => ({ ...f, reviewPeriod: e.target.value }))}
              />
            </div>

            {/* Review Date */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Review Date *</label>
              <input
                type="date"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.reviewDate}
                onChange={e => setForm(f => ({ ...f, reviewDate: e.target.value }))}
              />
            </div>

            {/* Rating */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Overall Rating *</label>
              <select
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.rating}
                onChange={e => setForm(f => ({ ...f, rating: e.target.value }))}
              >
                {RATINGS.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              >
                <option value="draft">Draft</option>
                <option value="final">Final</option>
              </select>
            </div>

            {/* Strengths */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Strengths</label>
              <textarea
                rows={3}
                placeholder="Key strengths demonstrated during this period…"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                value={form.strengths}
                onChange={e => setForm(f => ({ ...f, strengths: e.target.value }))}
              />
            </div>

            {/* Areas for Improvement */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Areas for Improvement</label>
              <textarea
                rows={3}
                placeholder="Areas where the employee can grow…"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                value={form.areasForImprovement}
                onChange={e => setForm(f => ({ ...f, areasForImprovement: e.target.value }))}
              />
            </div>

            {/* Goals */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Goals for Next Period</label>
              <textarea
                rows={3}
                placeholder="Goals and targets for the upcoming period…"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                value={form.goals}
                onChange={e => setForm(f => ({ ...f, goals: e.target.value }))}
              />
            </div>

            {/* Notes */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Additional Notes</label>
              <textarea
                rows={2}
                placeholder="Any additional notes…"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>

            {/* Attendance Score */}
            <div className="sm:col-span-2 space-y-3">
              <label className="block text-xs font-medium text-gray-600">
                Attendance / Punctuality Score
              </label>
              <div className="p-3 border border-blue-100 bg-blue-50/40 rounded-lg space-y-3">
                <p className="text-[10px] text-blue-600 font-medium flex items-center gap-1">
                  <Calculator className="w-3 h-3" />
                  Select the period to auto-calculate from attendance records. Uses the shift start time configured in Settings.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500 mb-1 block">From</label>
                    <input
                      type="date"
                      className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                      value={scoreFrom}
                      onChange={e => setScoreFrom(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 mb-1 block">To</label>
                    <input
                      type="date"
                      className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                      value={scoreTo}
                      onChange={e => setScoreTo(e.target.value)}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCalculateScore}
                  disabled={!form.employeeId || !scoreFrom || !scoreTo || scoreFetching}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Calculator className="w-3 h-3" />
                  {scoreFetching ? 'Calculating…' : 'Calculate Score'}
                </button>
                {scoreResult && (
                  <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
                    <div className="bg-white border border-gray-100 rounded-lg p-2">
                      <p className="text-lg font-black text-gray-800">{scoreResult.totalDays}</p>
                      <p className="text-gray-400 uppercase tracking-wide">Days</p>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2">
                      <p className="text-lg font-black text-emerald-700">{scoreResult.onTimeDays}</p>
                      <p className="text-emerald-500 uppercase tracking-wide">On Time</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-100 rounded-lg p-2">
                      <p className="text-lg font-black text-amber-700">{scoreResult.lateDays}</p>
                      <p className="text-amber-500 uppercase tracking-wide">Late</p>
                    </div>
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-2">
                      <p className="text-lg font-black text-blue-700">{scoreResult.punctualityPct}%</p>
                      <p className="text-blue-500 uppercase tracking-wide">Score</p>
                    </div>
                  </div>
                )}
                {scoreResult && (
                  <p className="text-[10px] text-gray-400">
                    Shift start threshold: <span className="font-mono font-semibold">{scoreResult.shiftStartTime}</span>
                    {scoreResult.noTimeIn > 0 && ` · ${scoreResult.noTimeIn} day(s) with no time-in data excluded`}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">Punctuality Score (%) — auto-filled or enter manually</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="0 – 100"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={form.attendanceScore ?? ''}
                  onChange={e => setForm(f => ({ ...f, attendanceScore: e.target.value === '' ? null : Number(e.target.value) }))}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
              onClick={handleSubmit}
              disabled={isSaving || (!editId && !form.employeeId) || !form.reviewPeriod || !form.reviewDate}
            >
              {isSaving ? 'Saving…' : editId ? 'Save Changes' : 'Create Review'}
            </Button>
            <Button size="sm" variant="outline" className="text-xs" onClick={cancelForm}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : reviews.length === 0 ? (
        <Card className="p-12 border border-dashed text-center">
          <Star className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="font-semibold text-gray-700">No reviews yet</p>
          <p className="text-xs text-gray-400 mt-1">Create the first performance review to get started.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {/* Employees with reviews */}
          {byEmployee.map(({ employee, reviews: empReviews }) => {
            const latest = empReviews[0];
            const isExpanded = expandedEmployeeId === employee.id;
            return (
              <Card key={employee.id} className="overflow-hidden">
                {/* Employee row */}
                <button
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                  onClick={() => setExpandedEmployeeId(isExpanded ? null : employee.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <UserIcon className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{employee.name}</p>
                      <p className="text-xs text-gray-400">{employee.employeeId} · {employee.department || 'No Department'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-gray-500">Latest: {latest.reviewPeriod}</p>
                      <p className="text-xs text-gray-400">{latest.reviewDate}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ratingStyle(latest.rating)}`}>
                      {ratingLabel(latest.rating)}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${latest.status === 'final' ? 'border-emerald-200 text-emerald-600 bg-emerald-50' : 'border-gray-200 text-gray-500 bg-gray-50'}`}>
                      {latest.status}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </button>

                {/* Expanded reviews */}
                {isExpanded && (
                  <div className="border-t border-gray-100 divide-y divide-gray-50">
                    {empReviews.map(review => (
                      <div key={review.id} className="px-5 py-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-gray-800">{review.reviewPeriod}</span>
                            <span className="text-xs text-gray-400">{review.reviewDate}</span>
                            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${ratingStyle(review.rating)}`}>
                              {ratingLabel(review.rating)}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${review.status === 'final' ? 'border-emerald-200 text-emerald-600 bg-emerald-50' : 'border-gray-200 text-gray-500 bg-gray-50'}`}>
                              {review.status}
                            </span>
                            {review.attendanceScore > 0 && (
                              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                                {review.attendanceScore}% punctual
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              className="p-1.5 rounded hover:bg-blue-50 text-blue-500 hover:text-blue-700 transition-colors"
                              onClick={() => startEdit(review)}
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
                              onClick={() => deleteMutation.mutate(review.id)}
                              disabled={deleteMutation.isPending}
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Edit form inline */}
                        {editId === review.id && (
                          <Card className="p-4 border border-blue-100 bg-blue-50/30 space-y-4 mt-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Review Period</label>
                                <input
                                  type="text"
                                  className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                                  value={form.reviewPeriod}
                                  onChange={e => setForm(f => ({ ...f, reviewPeriod: e.target.value }))}
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Review Date</label>
                                <input
                                  type="date"
                                  className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                                  value={form.reviewDate}
                                  onChange={e => setForm(f => ({ ...f, reviewDate: e.target.value }))}
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Rating</label>
                                <select
                                  className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                                  value={form.rating}
                                  onChange={e => setForm(f => ({ ...f, rating: e.target.value }))}
                                >
                                  {RATINGS.map(r => (
                                    <option key={r.value} value={r.value}>{r.label}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                                <select
                                  className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                                  value={form.status}
                                  onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                                >
                                  <option value="draft">Draft</option>
                                  <option value="final">Final</option>
                                </select>
                              </div>
                              <div className="sm:col-span-2">
                                <label className="block text-xs font-medium text-gray-600 mb-1">Strengths</label>
                                <textarea
                                  rows={2}
                                  className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                                  value={form.strengths}
                                  onChange={e => setForm(f => ({ ...f, strengths: e.target.value }))}
                                />
                              </div>
                              <div className="sm:col-span-2">
                                <label className="block text-xs font-medium text-gray-600 mb-1">Areas for Improvement</label>
                                <textarea
                                  rows={2}
                                  className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                                  value={form.areasForImprovement}
                                  onChange={e => setForm(f => ({ ...f, areasForImprovement: e.target.value }))}
                                />
                              </div>
                              <div className="sm:col-span-2">
                                <label className="block text-xs font-medium text-gray-600 mb-1">Goals</label>
                                <textarea
                                  rows={2}
                                  className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                                  value={form.goals}
                                  onChange={e => setForm(f => ({ ...f, goals: e.target.value }))}
                                />
                              </div>
                              <div className="sm:col-span-2">
                                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                                <textarea
                                  rows={2}
                                  className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                                  value={form.notes}
                                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                />
                              </div>
                              <div className="sm:col-span-2 space-y-2">
                                <label className="block text-xs font-medium text-gray-600">Attendance / Punctuality Score</label>
                                <div className="p-2 border border-blue-100 bg-blue-50/40 rounded-lg space-y-2">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="text-[10px] text-gray-500 mb-1 block">From</label>
                                      <input type="date" className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white" value={scoreFrom} onChange={e => setScoreFrom(e.target.value)} />
                                    </div>
                                    <div>
                                      <label className="text-[10px] text-gray-500 mb-1 block">To</label>
                                      <input type="date" className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white" value={scoreTo} onChange={e => setScoreTo(e.target.value)} />
                                    </div>
                                  </div>
                                  <button type="button" onClick={handleCalculateScore} disabled={!form.employeeId || !scoreFrom || !scoreTo || scoreFetching} className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors">
                                    <Calculator className="w-3 h-3" />{scoreFetching ? 'Calculating…' : 'Calculate'}
                                  </button>
                                  {scoreResult && (
                                    <div className="grid grid-cols-4 gap-1 text-center text-[10px]">
                                      <div className="bg-white border border-gray-100 rounded p-1"><p className="font-black text-gray-800">{scoreResult.totalDays}</p><p className="text-gray-400">Days</p></div>
                                      <div className="bg-emerald-50 border border-emerald-100 rounded p-1"><p className="font-black text-emerald-700">{scoreResult.onTimeDays}</p><p className="text-emerald-500">On Time</p></div>
                                      <div className="bg-amber-50 border border-amber-100 rounded p-1"><p className="font-black text-amber-700">{scoreResult.lateDays}</p><p className="text-amber-500">Late</p></div>
                                      <div className="bg-blue-50 border border-blue-100 rounded p-1"><p className="font-black text-blue-700">{scoreResult.punctualityPct}%</p><p className="text-blue-500">Score</p></div>
                                    </div>
                                  )}
                                </div>
                                <input type="number" min="0" max="100" step="0.01" placeholder="0 – 100" className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" value={form.attendanceScore ?? ''} onChange={e => setForm(f => ({ ...f, attendanceScore: e.target.value === '' ? null : Number(e.target.value) }))} />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
                                onClick={handleSubmit}
                                disabled={isSaving}
                              >
                                {isSaving ? 'Saving…' : 'Save Changes'}
                              </Button>
                              <Button size="sm" variant="outline" className="text-xs" onClick={cancelForm}>
                                Cancel
                              </Button>
                            </div>
                          </Card>
                        )}

                        {/* Review detail (not editing) */}
                        {editId !== review.id && (
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
                                  <p className="text-gray-500 text-[10px]">Calculated from attendance records for this review period</p>
                                </div>
                                <span className="ml-auto text-2xl font-black text-blue-700">{review.attendanceScore}%</span>
                              </div>
                            )}
                          </div>
                        )}

                        {review.reviewedBy && (
                          <p className="text-xs text-gray-400">Reviewed by {review.reviewedBy}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}

          {/* Employees without reviews — subtle list */}
          {employeesWithoutReview.length > 0 && (
            <Card className="p-4 border border-dashed">
              <p className="text-xs font-semibold text-gray-500 mb-2">No reviews yet</p>
              <div className="flex flex-wrap gap-2">
                {employeesWithoutReview.map(e => (
                  <span
                    key={e.id}
                    className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600"
                  >
                    {e.name}
                  </span>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
