import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/hooks/useApi';
import { Shield, RefreshCw, AlertCircle, Sparkles, Percent, Clock, Scale, Building2 } from 'lucide-react';
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

interface CompanyProfile {
  id: number;
  name: string;
  logoUrl: string;
  parserType: string;
  updatedAt: string;
}

export default function AdminSettings() {
  const api = useApi();
  const queryClient = useQueryClient();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const [editDesc, setEditDesc] = useState<string>('');
  const [saveError, setSaveError] = useState('');

  // Company profile state
  const [editingCompany, setEditingCompany] = useState(false);
  const [companyForm, setCompanyForm] = useState({ name: '', logoUrl: '', parserType: 'auto' });
  const [companyError, setCompanyError] = useState('');

  // Fetch settings
  const { data, isLoading, isError } = useQuery({
    queryKey: ['payrollSettings'],
    queryFn: async () => {
      const res = await api.get<{ settings: PayrollSetting[] }>('/payroll-settings');
      return res.data;
    },
  });

  // Fetch company profile
  const { data: companyData } = useQuery({
    queryKey: ['companyProfile'],
    queryFn: async () => {
      const res = await api.get<{ profile: CompanyProfile }>('/company-profile');
      return res.data;
    },
  });

  const company = companyData?.profile;
  const settings = data?.settings || [];

  // Update company profile mutation
  const updateCompanyMutation = useMutation({
    mutationFn: async (data: { name: string; logoUrl: string; parserType: string }) => {
      return api.put('/company-profile', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companyProfile'] });
      setEditingCompany(false);
      setCompanyError('');
    },
    onError: (err: any) => {
      setCompanyError(err.response?.data?.error || 'Failed to update company profile.');
    },
  });

  const handleEditCompany = () => {
    setCompanyForm({
      name: company?.name || '',
      logoUrl: company?.logoUrl || '',
      parserType: company?.parserType || 'auto',
    });
    setEditingCompany(true);
    setCompanyError('');
  };

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

      {/* Company Profile */}
      <Card className="border border-gray-100 shadow-sm rounded-xl overflow-hidden bg-white">
        <div className="p-6 flex flex-col sm:flex-row justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <h4 className="font-bold text-gray-900">Company Profile</h4>
              {editingCompany ? (
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Company Name</label>
                    <input
                      type="text"
                      className="w-full px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={companyForm.name}
                      onChange={e => setCompanyForm(f => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Logo URL</label>
                    <input
                      type="text"
                      className="w-full px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="https://..."
                      value={companyForm.logoUrl}
                      onChange={e => setCompanyForm(f => ({ ...f, logoUrl: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Attendance Parser</label>
                    <select
                      className="w-full px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={companyForm.parserType}
                      onChange={e => setCompanyForm(f => ({ ...f, parserType: e.target.value }))}
                    >
                      <option value="auto">Auto-detect (recommended)</option>
                      <option value="podur_xml">PODUR XML SpreadsheetML</option>
                      <option value="ngtimereport">NGTimeReport XLS</option>
                    </select>
                  </div>
                  {companyError && (
                    <div className="p-2 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5" />{companyError}
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-1 space-y-0.5">
                  <p className="text-sm text-gray-700 font-medium">{company?.name || '—'}</p>
                  <p className="text-xs text-gray-400">Parser: <span className="font-mono">{company?.parserType || 'auto'}</span></p>
                  {company?.logoUrl && <p className="text-xs text-gray-400 truncate max-w-xs">{company.logoUrl}</p>}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-start justify-end gap-2 shrink-0">
            {editingCompany ? (
              <>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => updateCompanyMutation.mutate(companyForm)}
                  disabled={updateCompanyMutation.isPending}
                >
                  {updateCompanyMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingCompany(false)} disabled={updateCompanyMutation.isPending}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={handleEditCompany} className="text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                Edit
              </Button>
            )}
          </div>
        </div>
      </Card>

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
