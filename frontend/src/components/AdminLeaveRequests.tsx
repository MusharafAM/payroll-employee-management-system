import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/hooks/useApi';
import type { LeaveRecord } from '@/lib/api';
import { CheckCircle2, XCircle, CalendarDays, Clock, User } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function AdminLeaveRequests() {
  const api = useApi();
  const queryClient = useQueryClient();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['leave-requests'],
    queryFn: async () => {
      const res = await api.get<{ requests: LeaveRecord[]; count: number }>('/leave-requests');
      return res.data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.put(`/leaves/${id}/approve`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.put(`/leaves/${id}/reject`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      setRejectingId(null);
      setRejectReason('');
    },
  });

  const requests = data?.requests ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-blue-600" />
          Leave Requests
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">Review and action pending employee leave requests.</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : requests.length === 0 ? (
        <Card className="p-12 border border-dashed text-center">
          <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
          <p className="font-semibold text-gray-700">All caught up!</p>
          <p className="text-xs text-gray-400 mt-1">No pending leave requests at this time.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <Card key={req.id} className="p-5 border border-amber-100 bg-amber-50/30">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                {/* Employee & leave info */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{req.employee?.name ?? 'Unknown'}</p>
                      <p className="text-xs text-gray-400">{req.employee?.employeeId} · {req.employee?.department || 'No Department'}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 text-xs text-gray-600 pl-10">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="w-3.5 h-3.5 text-gray-400" />
                      {new Date(req.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full font-semibold ${req.days === 0.5 ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                      {req.days === 0.5 ? 'Half day' : 'Full day'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      Requested {new Date(req.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>

                  {req.reason && (
                    <p className="text-xs text-gray-500 pl-10 italic">"{req.reason}"</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 pl-10 sm:pl-0">
                  {rejectingId === req.id ? (
                    <div className="flex flex-col gap-2 w-64">
                      <input
                        type="text"
                        placeholder="Rejection reason (optional)"
                        className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400"
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs"
                          onClick={() => rejectMutation.mutate({ id: req.id, reason: rejectReason })}
                          disabled={rejectMutation.isPending}
                        >
                          {rejectMutation.isPending ? 'Rejecting...' : 'Confirm Reject'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => { setRejectingId(null); setRejectReason(''); }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-1.5 text-xs"
                        onClick={() => approveMutation.mutate(req.id)}
                        disabled={approveMutation.isPending}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-200 text-red-600 hover:bg-red-50 flex items-center gap-1.5 text-xs"
                        onClick={() => setRejectingId(req.id)}
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Reject
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
