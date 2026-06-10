import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useApi } from '@/hooks/useApi';
import { FileSpreadsheet, Upload, CheckCircle2, AlertTriangle, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface UploadResponse {
  message: string;
  saved: number;
  skipped: number;
  errors: string[];
}

export default function AdminAttendance() {
  const api = useApi();
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [result, setResult] = useState<UploadResponse | null>(null);
  const [uploadError, setUploadError] = useState('');

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
      setResult(data);
      setFile(null);
      setUploadError('');
    },
    onError: (err: any) => {
      setUploadError(err.response?.data?.error || 'Failed to upload attendance file.');
      setResult(null);
    },
  });

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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Upload Zone */}
      <div className="lg:col-span-2 space-y-4">
        <Card className="p-6 border border-gray-100 shadow-sm rounded-xl bg-white">
          <h3 className="text-base font-bold text-gray-900 mb-2 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-green-600" />
            Upload Attendance File
          </h3>
          <p className="text-xs text-gray-500 mb-6">
            Upload the standard monthly NGTimereport <code className="bg-gray-100 px-1 py-0.5 rounded text-[10px] font-mono">.xlsx</code> timecard spreadsheet. The system will automatically parse split shifts, calculate daily regular/overtime hours, and apply lunch hour deductions.
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
                    {uploadMutation.isPending ? 'Uploading...' : 'Process File'}
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
                <p className="text-xs text-blue-600/80">Parsing employee shift hours & logs. This can take a few seconds...</p>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Upload Summary / Results */}
      <div className="lg:col-span-1">
        <Card className="p-6 border border-gray-100 shadow-sm rounded-xl bg-white h-full flex flex-col">
          <h3 className="text-base font-bold text-gray-900 mb-4">Upload Status Report</h3>
          
          {!result && !uploadMutation.isPending && (
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

          {result && (
            <div className="space-y-6 flex-1 flex flex-col">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50/50 border border-emerald-100 p-3 rounded-lg text-center">
                  <span className="block text-xs font-semibold text-emerald-800 uppercase tracking-wider">Saved</span>
                  <span className="text-2xl font-bold text-emerald-600">{result.saved}</span>
                  <span className="block text-[10px] text-emerald-500/80 mt-0.5">Records Added</span>
                </div>
                <div className="bg-amber-50/50 border border-amber-100 p-3 rounded-lg text-center">
                  <span className="block text-xs font-semibold text-amber-800 uppercase tracking-wider">Skipped</span>
                  <span className="text-2xl font-bold text-amber-600">{result.skipped}</span>
                  <span className="block text-[10px] text-amber-500/80 mt-0.5">Due to Errors</span>
                </div>
              </div>

              {/* Status Header */}
              <div className="flex items-center gap-2 pb-3 border-b">
                {result.errors.length === 0 ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Success</p>
                      <p className="text-xs text-gray-500">100% rows parsed correctly.</p>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Parsed with warnings</p>
                      <p className="text-xs text-gray-500">{result.errors.length} rows failed to parse.</p>
                    </div>
                  </>
                )}
              </div>

              {/* Error list */}
              {result.errors.length > 0 && (
                <div className="flex-1 flex flex-col min-h-[160px]">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Parsing Warnings</p>
                  <div className="flex-1 overflow-y-auto max-h-[200px] border rounded-lg bg-gray-50 p-2 divide-y divide-gray-200">
                    {result.errors.map((err, i) => (
                      <p key={i} className="text-xs text-rose-700 font-mono py-1.5 px-1 flex items-start gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 mt-1" />
                        {err}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {result.errors.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-6 text-gray-400 bg-gray-50/50 border border-dashed rounded-lg">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
                  <p className="text-xs font-medium text-emerald-800">All data imported cleanly!</p>
                  <p className="text-[10px] text-gray-400 mt-1 max-w-[180px]">All employee time records matches existing IDs.</p>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
