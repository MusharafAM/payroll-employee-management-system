import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/hooks/useApi';
import type { User } from '@/lib/api';
import { 
  Plus, Search, Edit2, Trash2, X, 
  Briefcase, Building2, Mail, Shield, ShieldAlert, ShieldCheck,
  DollarSign, Clock, UtensilsCrossed, CalendarDays, Award
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface CreateEmployeePayload {
  employeeId: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
  department: string;
  position: string;
  hourlyRate: number;
  baseSalary: number;
  travelAllowance: number;
  travelAllowanceFixed: number;
  incentiveAllowance: number;
  eidBonus: number;
  hajBonus: number;
  poyaBonus: number;
  targetBonus: number;
  attendanceBonus: number;
  isLunchHourDeduction: boolean;
}

interface UpdateEmployeePayload extends Partial<CreateEmployeePayload> {
  isActive?: boolean;
}

export default function AdminEmployees() {
  const api = useApi();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<User | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Form states
  const [formData, setFormData] = useState<CreateEmployeePayload>({
    employeeId: '',
    email: '',
    name: '',
    role: 'EMPLOYEE',
    department: '',
    position: '',
    hourlyRate: 0,
    baseSalary: 0,
    travelAllowance: 0,
    travelAllowanceFixed: 0,
    incentiveAllowance: 0,
    eidBonus: 0,
    hajBonus: 0,
    poyaBonus: 0,
    targetBonus: 0,
    attendanceBonus: 0,
    isLunchHourDeduction: true,
  });

  // Fetch employees
  const { data, isLoading, isError } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const res = await api.get<{ employees: User[]; count: number }>('/employees');
      return res.data;
    },
  });

  const employees = data?.employees || [];

  // Get unique departments for filter dropdown
  const departments = Array.from(new Set(employees.map(e => e.department).filter(Boolean)));

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (payload: CreateEmployeePayload) => {
      return api.post('/employees', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.error || 'Failed to create employee');
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateEmployeePayload }) => {
      return api.put(`/employees/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.error || 'Failed to update employee');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/employees/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || 'Failed to delete employee');
    }
  });

  const resetForm = () => {
    setFormData({
      employeeId: '',
      email: '',
      name: '',
      role: 'EMPLOYEE',
      department: '',
      position: '',
      hourlyRate: 0,
      baseSalary: 0,
      travelAllowance: 0,
      travelAllowanceFixed: 0,
      incentiveAllowance: 0,
      eidBonus: 0,
      hajBonus: 0,
      poyaBonus: 0,
      targetBonus: 0,
      attendanceBonus: 0,
      isLunchHourDeduction: true,
    });
    setEditingEmployee(null);
    setErrorMsg('');
  };

  const handleEditClick = (emp: User) => {
    setEditingEmployee(emp);
    const profile = emp.salaryProfile;
    setFormData({
      employeeId: emp.employeeId || '',
      email: emp.email || '',
      name: emp.name || '',
      role: emp.role || 'EMPLOYEE',
      department: emp.department || '',
      position: emp.position || '',
      hourlyRate: profile?.hourlyRate ?? 0,
      baseSalary: profile?.baseSalary ?? 0,
      travelAllowance: profile?.travelAllowance ?? 0,
      travelAllowanceFixed: profile?.travelAllowanceFixed ?? 0,
      incentiveAllowance: profile?.incentiveAllowance ?? 0,
      eidBonus: profile?.eidBonus ?? 0,
      hajBonus: profile?.hajBonus ?? 0,
      poyaBonus: profile?.poyaBonus ?? 0,
      targetBonus: profile?.targetBonus ?? 0,
      attendanceBonus: profile?.attendanceBonus ?? 0,
      isLunchHourDeduction: profile?.isLunchHourDeduction ?? true,
    });
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingEmployee) {
      updateMutation.mutate({ id: editingEmployee.id, payload: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this employee?')) {
      deleteMutation.mutate(id);
    }
  };

  // Filtered list
  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = 
      emp.name.toLowerCase().includes(search.toLowerCase()) ||
      emp.email.toLowerCase().includes(search.toLowerCase()) ||
      emp.employeeId.toLowerCase().includes(search.toLowerCase());
    
    const matchesRole = roleFilter ? emp.role === roleFilter : true;
    const matchesDept = deptFilter ? emp.department === deptFilter : true;

    return matchesSearch && matchesRole && matchesDept;
  });

  return (
    <div className="space-y-6">
      {/* Search & Actions Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, or ID..."
              className="pl-9 pr-4 py-2 w-full text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
          >
            <option value="">All Roles</option>
            <option value="ADMIN">Admin</option>
            <option value="MANAGER">Manager</option>
            <option value="EMPLOYEE">Employee</option>
          </select>
          <select
            className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
          >
            <option value="">All Departments</option>
            {departments.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <Button 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg shadow-md hover:shadow-lg transition-all"
        >
          <Plus className="w-4 h-4" />
          Add Employee
        </Button>
      </div>

      {/* Employee List Table */}
      <Card className="overflow-hidden border border-gray-100 shadow-sm rounded-xl">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
            <p className="text-gray-500 text-sm">Loading employees...</p>
          </div>
        ) : isError ? (
          <div className="text-center py-20 text-red-500">
            Failed to load employees. Please check if backend is running.
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="text-center py-20 text-gray-500 text-sm">
            No employees found matching the filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Department & Position</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4 text-right">Compensation (LKR)</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                {filteredEmployees.map(emp => {
                  const hasProfile = !!emp.salaryProfile;
                  const profile = emp.salaryProfile;
                  return (
                    <tr key={emp.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-inner">
                            {emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{emp.name}</p>
                            <div className="flex items-center gap-1.5 text-xs text-gray-400">
                              <span className="font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px]">
                                {emp.employeeId}
                              </span>
                              <span>•</span>
                              <span className="flex items-center gap-0.5"><Mail className="w-3 h-3" /> {emp.email}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <p className="font-medium text-gray-900 flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 text-gray-400" />
                            {emp.department || '—'}
                          </p>
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <Briefcase className="w-3.5 h-3.5 text-gray-400" />
                            {emp.position || '—'}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          emp.role === 'ADMIN' 
                            ? 'bg-rose-50 text-rose-700 border border-rose-100' 
                            : emp.role === 'MANAGER' 
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' 
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        }`}>
                          {emp.role === 'ADMIN' ? <ShieldAlert className="w-3.5 h-3.5" /> : emp.role === 'MANAGER' ? <ShieldCheck className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                          {emp.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {hasProfile ? (
                          <div className="space-y-0.5">
                            <p className="font-semibold text-gray-950">
                              LKR {(profile?.baseSalary ?? 0).toLocaleString()} <span className="text-[10px] text-gray-400 font-normal">/mo</span>
                            </p>
                            <p className="text-xs text-gray-500">
                              LKR {(profile?.hourlyRate ?? 0).toLocaleString()} <span className="text-[10px] text-gray-400 font-normal">/hr</span>
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded border border-yellow-100">
                            No Salary Profile
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEditClick(emp)}
                            className="p-1.5 hover:bg-gray-100 text-gray-600 hover:text-blue-600 rounded-lg transition-colors"
                            title="Edit Employee & Salary Profile"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(emp.id)}
                            className="p-1.5 hover:bg-red-50 text-gray-600 hover:text-red-600 rounded-lg transition-colors"
                            title="Delete Employee"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal Form Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <Card className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-white overflow-hidden shadow-2xl rounded-2xl border border-gray-100">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">
                  {editingEmployee ? 'Edit Employee Profile' : 'Register New Employee'}
                </h3>
                <p className="text-xs text-blue-100">Configure personal identity and salary credentials.</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-white/10 transition-colors text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg font-medium flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0" />
                  {errorMsg}
                </div>
              )}

              {/* SECTION 1: Personal & Position Info */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-gray-900 border-b pb-2 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-600" />
                  Identity & Placement
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Employee ID *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. E024"
                      className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                      value={formData.employeeId}
                      onChange={e => setFormData({ ...formData, employeeId: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ruwan Silva"
                      className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Email Address *</label>
                    <input
                      type="email"
                      required
                      disabled={!!editingEmployee}
                      placeholder="e.g. ruwan@company.com"
                      className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all disabled:opacity-60"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Access Role</label>
                    <select
                      className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formData.role}
                      onChange={e => setFormData({ ...formData, role: e.target.value as any })}
                    >
                      <option value="EMPLOYEE">Employee (Standard Access)</option>
                      <option value="MANAGER">Manager (Department Overview)</option>
                      <option value="ADMIN">Admin (Full System Controls)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Department</label>
                    <input
                      type="text"
                      placeholder="e.g. Operations"
                      className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                      value={formData.department}
                      onChange={e => setFormData({ ...formData, department: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Position</label>
                    <input
                      type="text"
                      placeholder="e.g. Supervisor"
                      className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                      value={formData.position}
                      onChange={e => setFormData({ ...formData, position: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: Salary Profile Info */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-gray-900 border-b pb-2 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  Salary Configuration (LKR)
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-gray-400" /> Base Monthly Salary
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                      value={formData.baseSalary}
                      onChange={e => setFormData({ ...formData, baseSalary: Number(e.target.value) })}
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-gray-400" /> Hourly Overtime Rate
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                      value={formData.hourlyRate}
                      onChange={e => setFormData({ ...formData, hourlyRate: Number(e.target.value) })}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                      <UtensilsCrossed className="w-3.5 h-3.5 text-gray-400" /> Lunch Hour Deduction
                    </label>
                    <div className="h-9 flex items-center">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={formData.isLunchHourDeduction}
                          onChange={e => setFormData({ ...formData, isLunchHourDeduction: e.target.checked })}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        <span className="ml-3 text-sm font-medium text-gray-600">Enable Deduction</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Travel Allowance (Variable)</label>
                    <input
                      type="number"
                      min="0"
                      className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                      value={formData.travelAllowance}
                      onChange={e => setFormData({ ...formData, travelAllowance: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Travel Allowance (Fixed)</label>
                    <input
                      type="number"
                      min="0"
                      className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                      value={formData.travelAllowanceFixed}
                      onChange={e => setFormData({ ...formData, travelAllowanceFixed: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Incentive Allowance</label>
                    <input
                      type="number"
                      min="0"
                      className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                      value={formData.incentiveAllowance}
                      onChange={e => setFormData({ ...formData, incentiveAllowance: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                      <CalendarDays className="w-3.5 h-3.5 text-gray-400" /> Eid Festival Bonus
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                      value={formData.eidBonus}
                      onChange={e => setFormData({ ...formData, eidBonus: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                      <CalendarDays className="w-3.5 h-3.5 text-gray-400" /> Haj Festival Bonus
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                      value={formData.hajBonus}
                      onChange={e => setFormData({ ...formData, hajBonus: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                      <CalendarDays className="w-3.5 h-3.5 text-gray-400" /> Poya Day Bonus
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                      value={formData.poyaBonus}
                      onChange={e => setFormData({ ...formData, poyaBonus: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                      <Award className="w-3.5 h-3.5 text-gray-400" /> Performance Target Bonus
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                      value={formData.targetBonus}
                      onChange={e => setFormData({ ...formData, targetBonus: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                      <Award className="w-3.5 h-3.5 text-gray-400" /> Attendance Consistency Bonus
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                      value={formData.attendanceBonus}
                      onChange={e => setFormData({ ...formData, attendanceBonus: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t flex justify-end gap-3 bg-white">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg px-6 font-semibold"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full border-2 border-t-transparent border-white animate-spin" />
                      Saving...
                    </div>
                  ) : (
                    'Save Details'
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
