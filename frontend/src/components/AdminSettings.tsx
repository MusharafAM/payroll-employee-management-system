import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/hooks/useApi';
import { Shield, RefreshCw, AlertCircle, Sparkles, Percent, Clock, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface PayrollSetting {
  id: number;
  key: string;
  value: number;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export default function AdminSettings() {
  const api = useApi();
  const queryClient = useQueryClient();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const [editDesc, setEditDesc] = useState<string>('');
  const [saveError, setSaveError] = useState('');

  // Fetch settings
  const { data, isLoading, isError } = useQuery({
    queryKey: ['payrollSettings'],
    queryFn: async () => {
      const res = await api.get<{ settings: PayrollSetting[] }>('/payroll-settings');
      return res.data;
    },
  });

  const settings = data?.settings || [];

  // Update setting mutation
  const updateMutation = useMutation({
    mutationFn: async ({ key, value, description }: { key: string; value: number; description: string }) => {
      return api.put(`/payroll-settings/${key}`, { value, description });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payrollSettings'] });
      setEditingKey(null);
      setSaveError('');
    },
    onError: (err: any) => {
      setSaveError(err.response?.data?.error || 'Failed to update rule setting.');
    },
  });

  const handleEdit = (setting: PayrollSetting) => {
    setEditingKey(setting.key);
    setEditValue(setting.value);
    setEditDesc(setting.description);
    setSaveError('');
  };

  const handleSave = (key: string) => {
    updateMutation.mutate({ key, value: editValue, description: editDesc });
  };

  const formatKeyName = (key: string) => {
    return key
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getSettingIcon = (key: string) => {
    if (key.includes('multiplier')) return <Scale className="w-5 h-5 text-indigo-500" />;
    if (key.includes('rate')) return <Percent className="w-5 h-5 text-emerald-500" />;
    if (key.includes('hours')) return <Clock className="w-5 h-5 text-amber-500" />;
    return <Shield className="w-5 h-5 text-blue-500" />;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-100 p-4 rounded-xl flex gap-3 items-start">
        <Sparkles className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-900">Legal Compliance & Payroll Parameters</p>
          <p className="text-xs text-blue-700/80 mt-0.5">
            These parameters govern all monthly salary calculations. Modifying these rules will instantly recalculate gross totals, overtime components, and statutory EPF/ETF contributions.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <RefreshCw className="animate-spin rounded-full h-10 w-10 text-blue-600" />
          <p className="text-gray-500 text-sm">Loading rule parameters...</p>
        </div>
      ) : isError ? (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-center">
          Failed to fetch settings from backend. Check if service is up.
        </div>
      ) : (
        <Card className="divide-y divide-gray-100 border border-gray-100 shadow-sm rounded-xl overflow-hidden bg-white">
          {settings.map((setting) => {
            const isEditing = editingKey === setting.key;
            return (
              <div key={setting.key} className="p-6 hover:bg-gray-50/30 transition-colors">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
                      {getSettingIcon(setting.key)}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900">{formatKeyName(setting.key)}</h4>
                      {isEditing ? (
                        <input
                          type="text"
                          className="mt-1 w-full text-xs px-2 py-1 bg-white border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-600"
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                        />
                      ) : (
                        <p className="text-xs text-gray-500 mt-0.5">{setting.description || 'No description provided.'}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 w-full sm:w-auto justify-end">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.01"
                          className="w-24 px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-right font-semibold"
                          value={editValue}
                          onChange={(e) => setEditValue(Number(e.target.value))}
                        />
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => handleSave(setting.key)}
                          disabled={updateMutation.isPending}
                        >
                          {updateMutation.isPending ? 'Saving...' : 'Save'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingKey(null)}
                          disabled={updateMutation.isPending}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-lg font-bold text-gray-900">
                            {setting.key.includes('rate') ? `${setting.value}%` : setting.value}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(setting)}
                          className="text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          Modify
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {isEditing && saveError && (
                  <div className="mt-3 p-2 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {saveError}
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
