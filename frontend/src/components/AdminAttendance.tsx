import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/hooks/useApi';
import { 
  FileSpreadsheet, Upload, CheckCircle2, AlertTriangle, AlertCircle, RefreshCw,
  Plus, Edit2, Trash2, Calendar, User, Clock, HelpCircle, Save, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface UploadResponse {
  message: string;
  saved: number;
  skipped: number;
  errors: string[];
}

interface DBUser {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  department: string;
  position: string;
}

interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  timeIn: string | null;
  timeOut: string | null;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  isHalfDay: boolean;
}

export default function AdminAttendance() {
  const api = useApi();
  const queryClient = useQueryClient();
  
  // Tab control
  const [activeSubTab, setActiveSubTab] = useState<'upload' | 'manual'>('upload');

  // ---- Spreadsheet Upload State ----
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [uploadError, setUploadError] = useState('');

  // ---- Manual Adjustments State ----
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('2026-06');
  
  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [dialogError, setDialogError] = useState('');
  const [dialogDate, setDialogDate] = useState('');
  const [dialogTimeIn, setDialogTimeIn] = useState('');
  const [dialogTimeOut, setDialogTimeOut] = useState('');
  const [dialogHours, setDialogHours] = useState('');
  const [useClockTimes, setUseClockTimes] = useState(true);

  // Queries
  const { data: empsData, isLoading: empsLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const res = await api.get<{ employees: DBUser[] }>('/employees');
      return res.data;
    }
  });

  const { data: attData, isLoading: attLoading, refetch: refetchAttendance } = useQuery({
    queryKey: ['attendanceLogs', selectedEmpId, selectedMonth],
    queryFn: async () => {
      if (!selectedEmpId) return { attendance: [] };
      const res = await api.get<{ attendance: AttendanceRecord[] }>(
        `/attendance/employee/${selectedEmpId}?month=${selectedMonth}`
      );
      return res.data;
    },
    enabled: !!selectedEmpId
  });

  const employees = empsData?.employees || [];
  const attendanceLogs = attData?.attendance || [];

  // Mutations
  const uploadMutation = useMutation({
    mutationFn: async (fileToUpload: File) => {
      const formData = new FormData();
      formData.append('file', fileToUpload);
      const res = await api.post<UploadResponse>('/attendance/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return res.data;
    },
    onSuccess: (data) => {
      setUploadResult(data);
      setFile(null);
      setUploadError('');
      queryClient.invalidateQueries({ queryKey: ['attendanceLogs'] });
    },
    onError: (err: any) => {
      setUploadError(err.response?.data?.error || 'Failed to upload attendance file.');
      setUploadResult(null);
    },
  });

  const saveAdjustmentMutation = useMutation({
    mutationFn: async (payload: any) => {
      return api.post('/attendance/manual', payload);
    },
    onSuccess: () => {
      refetchAttendance();
      setIsDialogOpen(false);
      resetDialogForm();
    },
    onError: (err: any) => {
      setDialogError(err.response?.data?.error || 'Failed to save manual adjustment.');
    }
  });

  const deleteAdjustmentMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/attendance/${id}`);
    },
    onSuccess: () => {
      refetchAttendance();
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || 'Failed to delete attendance record.');
    }
  });

  // ---- Drag & Drop Event Handlers ----
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls')) {
        setFile(droppedFile);
      } else {
        setUploadError('Only Excel files (.xlsx, .xls) are supported.');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setUploadError('');
    }
  };

  const handleUpload = () => {
    if (file) {
      uploadMutation.mutate(file);
    }
  };

  // ---- Manual Dialog Logic ----
  const resetDialogForm = () => {
    setEditingRecord(null);
    setDialogDate('');
    setDialogTimeIn('');
    setDialogTimeOut('');
    setDialogHours('');
    setUseClockTimes(true);
    setDialogError('');
  };

  const handleOpenAdd = () => {
    resetDialogForm();
    // Default date within the selected month if possible
    setDialogDate(`${selectedMonth}-01`);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (rec: AttendanceRecord) => {
    setEditingRecord(rec);
    // Format date string from timestamp YYYY-MM-DD
    const dateOnly = rec.date.split('T')[0];
    setDialogDate(dateOnly);
    
    if (rec.timeIn && rec.timeOut) {
      // Extract HH:MM
      const parseTimeStr = (tStr: string) => {
        const d = new Date(tStr);
        const hh = String(d.getUTCHours()).padStart(2, '0');
        const mm = String(d.getUTCMinutes()).padStart(2, '0');
        return `${hh}:${mm}`;
      };
      try {
        setDialogTimeIn(parseTimeStr(rec.timeIn));
        setDialogTimeOut(parseTimeStr(rec.timeOut));
        setUseClockTimes(true);
      } catch {
        setUseClockTimes(false);
        setDialogHours(String(rec.totalHours));
      }
    } else {
      setUseClockTimes(false);
      setDialogHours(String(rec.totalHours));
    }
    setDialogError('');
    setIsDialogOpen(true);
  };

  const handleSaveAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId) return;
    if (!dialogDate) {
      setDialogError('Date is required.');
      return;
    }

    const payload: any = {
      employeeId: selectedEmpId,
      date: dialogDate
    };

    if (useClockTimes) {
      if (!dialogTimeIn || !dialogTimeOut) {
        setDialogError('Clock-In and Clock-Out times are required.');
        return;
      }
      payload.timeIn = dialogTimeIn;
      payload.timeOut = dialogTimeOut;
    } else {
      const hrs = Number(dialogHours);
      if (isNaN(hrs) || hrs < 0 || hrs > 24) {
        setDialogError('Please specify total manual hours between 0 and 24.');
        return;
      }
      payload.manualHours = hrs;
    }

    saveAdjustmentMutation.mutate(payload);
  };

  const handleDeleteRecord = (id: string, dateStr: string) => {
    const formattedDate = new Date(dateStr).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    if (confirm(`Are you sure you want to remove the attendance log for ${formattedDate}?`)) {
      deleteAdjustmentMutation.mutate(id);
    }
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '—';
    try {
      const d = new Date(timeStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
    } catch {
      return timeStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-tab navigation */}
      <div className="flex border-b border-gray-100 gap-4 mb-4">
        <button
          onClick={() => setActiveSubTab('upload')}
          className={`pb-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
            activeSubTab === 'upload'
              ? 'border-green-600 text-green-700'
              : 'border-transparent text-gray-400 hover:text-gray-700'
          }`}
        >
          Spreadsheet Upload
        </button>
        <button
          onClick={() => setActiveSubTab('manual')}
          className={`pb-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
            activeSubTab === 'manual'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-gray-400 hover:text-gray-700'
          }`}
        >
          Manual Adjustments
        </button>
      </div>

      {/* ---- Tab Content 1: Excel Upload ---- */}
      {activeSubTab === 'upload' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card className="p-6 border border-gray-100 shadow-sm rounded-xl bg-white">
              <h3 className="text-base font-bold text-gray-900 mb-2 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-green-600" />
                Upload Attendance Spreadsheet
              </h3>
              <p className="text-xs text-gray-500 mb-6">
                Upload the monthly NGTimereport <code className="bg-gray-100 px-1 py-0.5 rounded text-[10px] font-mono">.xlsx</code> timecard spreadsheet. The backend will parse dates, match employee codes, calculate regular/overtime hours, and automatically apply lunch hour deductions.
              </p>

              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-10 text-center flex flex-col items-center justify-center transition-all ${
                  dragActive 
                    ? 'border-blue-500 bg-blue-50/50' 
                    : file 
                    ? 'border-green-500 bg-green-50/20' 
                    : 'border-gray-200 hover:border-blue-500 hover:bg-gray-50/50'
                }`}
              >
                {file ? (
                  <div className="space-y-3">
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto text-green-600">
                      <FileSpreadsheet className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm max-w-xs truncate mx-auto">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <div className="flex gap-2 justify-center pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs text-gray-600"
                        onClick={() => setFile(null)}
                      >
                        Remove
                      </Button>
                      <Button
                        size="sm"
                        className="text-xs bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                        onClick={handleUpload}
                        disabled={uploadMutation.isPending}
                      >
                        {uploadMutation.isPending ? 'Processing...' : 'Process File'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mx-auto text-blue-500">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div>
                      <label htmlFor="file-input" className="cursor-pointer font-semibold text-blue-600 hover:underline text-sm">
                        Click to upload
                      </label>
                      <span className="text-gray-500 text-sm"> or drag and drop</span>
                      <p className="text-xs text-gray-400 mt-1">Excel formats (.xlsx, .xls) up to 10MB</p>
                    </div>
                    <input
                      id="file-input"
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </div>
                )}
              </div>

              {uploadError && (
                <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  {uploadError}
                </div>
              )}

              {uploadMutation.isPending && (
                <div className="mt-4 p-4 bg-blue-50/50 border border-blue-100 rounded-xl flex items-center gap-4 animate-pulse">
                  <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
                  <div>
                    <p className="text-sm font-semibold text-blue-800">Processing Timecard Spreadsheet</p>
                    <p className="text-xs text-blue-600/80">Parsing employee shift logs and writing to DB. This can take a few seconds...</p>
                  </div>
                </div>
              )}
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card className="p-6 border border-gray-100 shadow-sm rounded-xl bg-white h-full flex flex-col">
              <h3 className="text-base font-bold text-gray-900 mb-4">Upload Status Report</h3>
              
              {!uploadResult && !uploadMutation.isPending && (
                <div className="flex-1 flex flex-col items-center justify-center py-10 text-center text-gray-400">
                  <FileSpreadsheet className="w-10 h-10 mb-2 stroke-[1.5]" />
                  <p className="text-xs">No file uploaded yet. Upload a timecard spreadsheet to view results here.</p>
                </div>
              )}

              {uploadMutation.isPending && (
                <div className="flex-1 flex flex-col items-center justify-center py-10 text-center text-gray-400 space-y-2">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                  <p className="text-xs">Waiting for processing report...</p>
                </div>
              )}

              {uploadResult && (
                <div className="space-y-6 flex-1 flex flex-col">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-emerald-50/50 border border-emerald-100 p-3 rounded-lg text-center">
                      <span className="block text-xs font-semibold text-emerald-800 uppercase tracking-wider">Saved</span>
                      <span className="text-2xl font-bold text-emerald-600">{uploadResult.saved}</span>
                      <span className="block text-[10px] text-emerald-500/80 mt-0.5">Records Added</span>
                    </div>
                    <div className="bg-amber-50/50 border border-amber-100 p-3 rounded-lg text-center">
                      <span className="block text-xs font-semibold text-amber-800 uppercase tracking-wider">Skipped</span>
                      <span className="text-2xl font-bold text-amber-600">{uploadResult.skipped}</span>
                      <span className="block text-[10px] text-amber-500/80 mt-0.5">Due to Errors</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pb-3 border-b">
                    {uploadResult.errors.length === 0 ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Success</p>
                          <p className="text-xs text-gray-500">All rows parsed correctly.</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Completed with warnings</p>
                          <p className="text-xs text-gray-500">{uploadResult.errors.length} warnings encountered.</p>
                        </div>
                      </>
                    )}
                  </div>

                  {uploadResult.errors.length > 0 && (
                    <div className="flex-1 flex flex-col min-h-[160px]">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Warnings & Errors</p>
                      <div className="flex-1 overflow-y-auto max-h-[200px] border rounded-lg bg-gray-50 p-2 divide-y divide-gray-200">
                        {uploadResult.errors.map((err, i) => (
                          <p key={i} className="text-xs text-rose-700 font-mono py-1.5 px-1 flex items-start gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 mt-1" />
                            {err}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {uploadResult.errors.length === 0 && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center py-6 text-gray-400 bg-gray-50/50 border border-dashed rounded-lg font-medium">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
                      <p className="text-xs text-emerald-850">All data imported cleanly!</p>
                      <p className="text-[10px] text-gray-400 mt-1 max-w-[180px]">Employee matches and shifts successfully validated.</p>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* ---- Tab Content 2: Manual Adjustments ---- */}
      {activeSubTab === 'manual' && (
        <div className="space-y-6">
          {/* Filters card */}
          <Card className="p-6 border border-gray-100 shadow-sm rounded-xl bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4 flex-1">
              <div className="space-y-1 min-w-[240px]">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Employee</label>
                {empsLoading ? (
                  <div className="h-9 w-full bg-gray-100 rounded-lg animate-pulse" />
                ) : (
                  <select
                    className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={selectedEmpId}
                    onChange={(e) => setSelectedEmpId(e.target.value)}
                  >
                    <option value="">Select Employee...</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.employeeId}) — {emp.department || 'No Dept'}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Month</label>
                <input
                  type="month"
                  className="px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                />
              </div>
            </div>

            {selectedEmpId && (
              <Button
                onClick={handleOpenAdd}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-2 rounded-lg"
              >
                <Plus className="w-4 h-4" /> Add Day Adjustment
              </Button>
            )}
          </Card>

          {/* Table displaying logs */}
          {!selectedEmpId ? (
            <Card className="p-20 text-center text-gray-400 border border-dashed rounded-xl flex flex-col items-center justify-center">
              <User className="w-12 h-12 mb-3 stroke-[1.2] text-gray-300" />
              <p className="text-sm font-semibold">Select an Employee</p>
              <p className="text-xs text-gray-400 mt-1 max-w-sm">
                Choose an employee from the dropdown list to view, edit, add, or delete shift attendance logs for the selected month.
              </p>
            </Card>
          ) : attLoading ? (
            <Card className="p-20 text-center text-gray-400 bg-white flex flex-col items-center justify-center space-y-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              <p className="text-xs">Fetching attendance logs for {selectedMonth}...</p>
            </Card>
          ) : attendanceLogs.length === 0 ? (
            <Card className="p-20 text-center text-gray-400 border border-dashed rounded-xl bg-white flex flex-col items-center justify-center">
              <Calendar className="w-12 h-12 mb-3 stroke-[1.2] text-gray-300" />
              <p className="text-sm font-semibold">No Attendance Records Found</p>
              <p className="text-xs text-gray-400 mt-1 max-w-xs">
                There are no logs matching this employee and month. Click the "Add Day Adjustment" button to insert a record.
              </p>
            </Card>
          ) : (
            <Card className="border border-gray-100 shadow-sm rounded-xl overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                      <th className="px-6 py-3">Date</th>
                      <th className="px-6 py-3">Clock-In (UTC)</th>
                      <th className="px-6 py-3">Clock-Out (UTC)</th>
                      <th className="px-6 py-3 text-center">Total Hours</th>
                      <th className="px-6 py-3 text-center">Regular Hours</th>
                      <th className="px-6 py-3 text-center">Overtime Hours</th>
                      <th className="px-6 py-3 text-center">Shift Type</th>
                      <th className="px-6 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs text-gray-700 font-medium">
                    {attendanceLogs.map((rec) => {
                      const d = new Date(rec.date);
                      const formattedDate = d.toLocaleDateString(undefined, { 
                        weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' 
                      });
                      
                      return (
                        <tr key={rec.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-3.5 font-bold text-gray-900">{formattedDate}</td>
                          <td className="px-6 py-3.5 font-mono text-gray-500">{formatTime(rec.timeIn)}</td>
                          <td className="px-6 py-3.5 font-mono text-gray-500">{formatTime(rec.timeOut)}</td>
                          <td className="px-6 py-3.5 text-center font-mono font-semibold">{rec.totalHours} hrs</td>
                          <td className="px-6 py-3.5 text-center font-mono">{rec.regularHours} hrs</td>
                          <td className="px-6 py-3.5 text-center font-mono text-purple-600 font-semibold">
                            {rec.overtimeHours > 0 ? `+${rec.overtimeHours} hrs` : '—'}
                          </td>
                          <td className="px-6 py-3.5 text-center">
                            {rec.isHalfDay ? (
                              <span className="bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-amber-100">
                                Half Day
                              </span>
                            ) : (
                              <span className="bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-emerald-100">
                                Full Shift
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-3.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-blue-600 hover:bg-blue-50 rounded-full"
                                onClick={() => handleOpenEdit(rec)}
                                title="Edit adjustment"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-rose-600 hover:bg-rose-50 rounded-full"
                                onClick={() => handleDeleteRecord(rec.id, rec.date)}
                                title="Delete record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ---- Add/Edit Adjustment Modal Dialog ---- */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <Card className="w-full max-w-md bg-white overflow-hidden shadow-2xl rounded-2xl border border-gray-100 flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold">
                  {editingRecord ? 'Edit Shift Log' : 'Add Shift Adjustment'}
                </h3>
                <p className="text-xs text-blue-100">Log manual regular and overtime shift hours.</p>
              </div>
              <button 
                onClick={() => setIsDialogOpen(false)}
                className="p-1 rounded-lg hover:bg-white/10 transition-colors text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveAdjustment} className="p-6 space-y-4 flex-1">
              {dialogError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg font-medium flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  {dialogError}
                </div>
              )}

              {/* Date Input */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Date *</label>
                <input
                  type="date"
                  required
                  disabled={!!editingRecord}
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all disabled:opacity-60"
                  value={dialogDate}
                  onChange={(e) => setDialogDate(e.target.value)}
                />
              </div>

              {/* Input Type Selector */}
              <div className="flex border border-gray-200 rounded-lg overflow-hidden p-0.5 bg-gray-50">
                <button
                  type="button"
                  onClick={() => setUseClockTimes(true)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    useClockTimes 
                      ? 'bg-white shadow-sm text-blue-700 font-bold' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Clock Times
                </button>
                <button
                  type="button"
                  onClick={() => setUseClockTimes(false)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    !useClockTimes 
                      ? 'bg-white shadow-sm text-blue-700 font-bold' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Manual Total Hours
                </button>
              </div>

              {/* Conditional Inputs */}
              {useClockTimes ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-gray-400" /> Clock In *
                    </label>
                    <input
                      type="time"
                      required
                      className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                      value={dialogTimeIn}
                      onChange={(e) => setDialogTimeIn(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-gray-400" /> Clock Out *
                    </label>
                    <input
                      type="time"
                      required
                      className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                      value={dialogTimeOut}
                      onChange={(e) => setDialogTimeOut(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-gray-400" /> Total Hours Work *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="24"
                    required
                    placeholder="e.g. 8.5"
                    className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    value={dialogHours}
                    onChange={(e) => setDialogHours(e.target.value)}
                  />
                </div>
              )}

              {/* Informative Note */}
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-[11px] text-blue-800 flex gap-2">
                <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  Calculated values (Regular / Overtime) will be computed by the backend based on the employee's lunch-hour deduction settings.
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="pt-4 border-t flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  className="rounded-lg text-gray-600 text-xs hover:bg-gray-50"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
                  disabled={saveAdjustmentMutation.isPending}
                >
                  {saveAdjustmentMutation.isPending ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" /> Save Adjustment
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
