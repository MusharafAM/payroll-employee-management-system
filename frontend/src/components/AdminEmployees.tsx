import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/hooks/useApi';
import type { User } from '@/lib/api';
import {
  Plus, Search, Edit2, Trash2, X,
  Briefcase, Building2, Mail, Shield, ShieldAlert, ShieldCheck,
  DollarSign, Clock, UtensilsCrossed, Award, Wallet, CalendarDays,
  Phone, CreditCard, MapPin, Users, Landmark, MoreVertical, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import DeductionsModal from '@/components/DeductionsModal';
import LeaveModal from '@/components/LeaveModal';
import DisciplinaryModal from '@/components/DisciplinaryModal';

interface CreateEmployeePayload {
  employeeId: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
  department: string;
  position: string;
  phone: string;
  nic: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  joinDate: string;
  employmentType: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;
  emergencyContactEmail: string;
  bankName: string;
  bankAccountNumber: string;
  bankBranch: string;
  salaryType: 'hourly' | 'fixed';
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
  additionalAllowances: Record<string, number>;
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
  const [deductionsEmployee, setDeductionsEmployee] = useState<User | null>(null);
  const [leavesEmployee, setLeavesEmployee] = useState<User | null>(null);
  const [disciplinaryEmployee, setDisciplinaryEmployee] = useState<User | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Local state for dynamic additional allowances
  const [newAllowanceKey, setNewAllowanceKey] = useState('');
  const [newAllowanceVal, setNewAllowanceVal] = useState('');

  const handleAddAllowance = () => {
    if (!newAllowanceKey.trim()) return;
    const val = Number(newAllowanceVal) || 0;
    setFormData(prev => ({
      ...prev,
      additionalAllowances: {
        ...prev.additionalAllowances,
        [newAllowanceKey.trim()]: val,
      }
    }));
    setNewAllowanceKey('');
    setNewAllowanceVal('');
  };

  const handleRemoveAllowance = (key: string) => {
    setFormData(prev => {
      const updated = { ...prev.additionalAllowances };
      delete updated[key];
      return {
        ...prev,
        additionalAllowances: updated,
      };
    });
  };

  // Form states
  const [formData, setFormData] = useState<CreateEmployeePayload>({
    employeeId: '',
    email: '',
    name: '',
    role: 'EMPLOYEE',
    department: '',
    position: '',
    phone: '',
    nic: '',
    dateOfBirth: '',
    gender: '',
    address: '',
    joinDate: '',
    employmentType: 'Permanent',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelationship: '',
    emergencyContactEmail: '',
    bankName: '',
    bankAccountNumber: '',
    bankBranch: '',
    salaryType: 'hourly',
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
    additionalAllowances: {},
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
      phone: '',
      nic: '',
      dateOfBirth: '',
      gender: '',
      address: '',
      joinDate: '',
      employmentType: 'Permanent',
      emergencyContactName: '',
      emergencyContactPhone: '',
      emergencyContactRelationship: '',
      emergencyContactEmail: '',
      bankName: '',
      bankAccountNumber: '',
      bankBranch: '',
      salaryType: 'hourly',
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
      additionalAllowances: {},
    });
    setEditingEmployee(null);
    setErrorMsg('');
    setNewAllowanceKey('');
    setNewAllowanceVal('');
  };

  const handleEditClick = (emp: User) => {
    const profile = emp.salaryProfile;
    setEditingEmployee(emp);
    setFormData({
      employeeId: emp.employeeId || '',
      email: emp.email || '',
      name: emp.name || '',
      role: emp.role || 'EMPLOYEE',
      department: emp.department || '',
      position: emp.position || '',
      phone: emp.phone || '',
      nic: emp.nic || '',
      dateOfBirth: emp.dateOfBirth || '',
      gender: emp.gender || '',
      address: emp.address || '',
      joinDate: emp.joinDate || '',
      employmentType: emp.employmentType || 'Permanent',
      emergencyContactName: emp.emergencyContactName || '',
      emergencyContactPhone: emp.emergencyContactPhone || '',
      emergencyContactRelationship: emp.emergencyContactRelationship || '',
      emergencyContactEmail: emp.emergencyContactEmail || '',
      bankName: emp.bankName || '',
      bankAccountNumber: emp.bankAccountNumber || '',
      bankBranch: emp.bankBranch || '',
      salaryType: profile?.salaryType ?? 'hourly',
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
      additionalAllowances: profile?.additionalAllowances ?? {},
    });
    setErrorMsg('');
    setNewAllowanceKey('');
    setNewAllowanceVal('');
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
      {deductionsEmployee && (
        <DeductionsModal
          employee={deductionsEmployee}
          onClose={() => setDeductionsEmployee(null)}
        />
      )}
      {leavesEmployee && (
        <LeaveModal
          employee={leavesEmployee}
          onClose={() => setLeavesEmployee(null)}
        />
      )}
      {disciplinaryEmployee && (
        <DisciplinaryModal
          employee={disciplinaryEmployee}
          onClose={() => setDisciplinaryEmployee(null)}
        />
      )}
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
                  <th className="px-6 py-4 text-right w-44">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                {filteredEmployees.map((emp, index) => {
                  const hasProfile = !!emp.salaryProfile;
                  const profile = emp.salaryProfile;
                  const isMenuOpen = openMenuId === emp.id;
                  const isLastRows = filteredEmployees.length > 2 && index >= filteredEmployees.length - 2;

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
                          <div className="space-y-1">
                            <p className="font-semibold text-gray-950">
                              LKR {(profile?.baseSalary ?? 0).toLocaleString()} <span className="text-[10px] text-gray-400 font-normal">/mo</span>
                            </p>
                            {profile?.salaryType === 'fixed' ? (
                              <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                                Fixed Monthly
                              </span>
                            ) : (
                              <p className="text-xs text-gray-500">
                                LKR {(profile?.hourlyRate ?? 0).toLocaleString()} <span className="text-[10px] text-gray-400 font-normal">/hr</span>
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded border border-yellow-100">
                            No Salary Profile
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="relative inline-flex items-center gap-1.5 justify-end">
                          {/* Quick Edit Action */}
                          <button
                            type="button"
                            onClick={() => handleEditClick(emp)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-200/80 transition-colors"
                            title="Edit Employee"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                            <span>Edit</span>
                          </button>

                          {/* Action Menu Dropdown Toggle */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setOpenMenuId(isMenuOpen ? null : emp.id)}
                              className={`p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 border transition-all ${
                                isMenuOpen ? 'bg-gray-100 border-gray-300 text-gray-900 shadow-inner' : 'border-gray-200 bg-white'
                              }`}
                              title="More Actions"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {/* Dropdown Menu */}
                            {isMenuOpen && (
                              <>
                                <div
                                  className="fixed inset-0 z-40"
                                  onClick={() => setOpenMenuId(null)}
                                />
                                <div
                                  className={`absolute right-0 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-50 text-left animate-in fade-in zoom-in-95 duration-100 ${
                                    isLastRows ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                                  }`}
                                >
                                  <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-50 mb-1">
                                    Employee Actions
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      handleEditClick(emp);
                                    }}
                                    className="w-full px-3 py-2 text-xs font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2.5 transition-colors"
                                  >
                                    <Edit2 className="w-4 h-4 text-blue-500" />
                                    <span>Edit Details</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      setDeductionsEmployee(emp);
                                    }}
                                    className="w-full px-3 py-2 text-xs font-medium text-gray-700 hover:bg-amber-50 hover:text-amber-700 flex items-center gap-2.5 transition-colors"
                                  >
                                    <Wallet className="w-4 h-4 text-amber-500" />
                                    <span>Deductions & Loans</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      setLeavesEmployee(emp);
                                    }}
                                    className="w-full px-3 py-2 text-xs font-medium text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2.5 transition-colors"
                                  >
                                    <CalendarDays className="w-4 h-4 text-emerald-500" />
                                    <span>Leave Records</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      setDisciplinaryEmployee(emp);
                                    }}
                                    className="w-full px-3 py-2 text-xs font-medium text-gray-700 hover:bg-rose-50 hover:text-rose-700 flex items-center gap-2.5 transition-colors"
                                  >
                                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                                    <span>Disciplinary Records</span>
                                  </button>

                                  <div className="my-1 border-t border-gray-100" />

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      handleDelete(emp.id);
                                    }}
                                    className="w-full px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                    <span>Delete Employee</span>
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
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
                    <select
                      className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formData.department}
                      onChange={e => setFormData({ ...formData, department: e.target.value })}
                    >
                      <option value="">Select Department...</option>
                      <option value="Tailoring">Tailoring</option>
                      <option value="Hand Work">Hand Work</option>
                      <option value="Quality Check">Quality Check</option>
                      <option value="Management & Accounts">Management & Accounts</option>
                    </select>
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

              {/* SECTION 2: Personal & HR Details */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-gray-900 border-b pb-2 flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600" />
                  Personal & HR Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-gray-400" /> Phone Number
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. 0771234567"
                      className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                      <CreditCard className="w-3.5 h-3.5 text-gray-400" /> NIC Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 901234567V"
                      className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                      value={formData.nic}
                      onChange={e => setFormData({ ...formData, nic: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Date of Birth</label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                      value={formData.dateOfBirth}
                      onChange={e => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Gender</label>
                    <select
                      className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formData.gender}
                      onChange={e => setFormData({ ...formData, gender: e.target.value })}
                    >
                      <option value="">Select Gender...</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Join Date</label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                      value={formData.joinDate}
                      onChange={e => setFormData({ ...formData, joinDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Employment Type</label>
                    <select
                      className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formData.employmentType}
                      onChange={e => setFormData({ ...formData, employmentType: e.target.value })}
                    >
                      <option value="Permanent">Permanent</option>
                      <option value="Contract">Contract</option>
                      <option value="Probation">Probation</option>
                      <option value="Part-time">Part-time</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-gray-400" /> Home Address
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. 123 Main Street, Colombo 03"
                    className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all resize-none"
                    value={formData.address}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
              </div>

              {/* SECTION 3: Emergency Contact */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-gray-900 border-b pb-2 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-rose-500" />
                  Emergency Contact
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Nimal Perera"
                      className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                      value={formData.emergencyContactName}
                      onChange={e => setFormData({ ...formData, emergencyContactName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Relationship</label>
                    <input
                      type="text"
                      placeholder="e.g. Spouse, Parent, Sibling"
                      className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                      value={(formData as any).emergencyContactRelationship ?? ''}
                      onChange={e => setFormData({ ...formData, emergencyContactRelationship: e.target.value } as any)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact Phone</label>
                    <input
                      type="tel"
                      placeholder="e.g. 0779876543"
                      className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                      value={formData.emergencyContactPhone}
                      onChange={e => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact Email</label>
                    <input
                      type="email"
                      placeholder="e.g. nimal@example.com"
                      className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                      value={(formData as any).emergencyContactEmail ?? ''}
                      onChange={e => setFormData({ ...formData, emergencyContactEmail: e.target.value } as any)}
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 4: Bank Details */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-gray-900 border-b pb-2 flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-teal-600" />
                  Bank Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Bank Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Commercial Bank"
                      className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                      value={formData.bankName}
                      onChange={e => setFormData({ ...formData, bankName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Account Number</label>
                    <input
                      type="text"
                      placeholder="e.g. 1234567890"
                      className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                      value={formData.bankAccountNumber}
                      onChange={e => setFormData({ ...formData, bankAccountNumber: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Branch</label>
                    <input
                      type="text"
                      placeholder="e.g. Colombo Fort"
                      className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                      value={formData.bankBranch}
                      onChange={e => setFormData({ ...formData, bankBranch: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 5: Salary Profile Info */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-gray-900 border-b pb-2 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  Salary Configuration (LKR)
                </h4>

                {/* Salary Type Toggle */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, salaryType: 'hourly' })}
                    className={`flex-1 py-2.5 px-4 rounded-lg border-2 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                      formData.salaryType === 'hourly'
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                    Hourly / Biometric
                    <span className="text-xs font-normal opacity-70">(attendance-driven)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, salaryType: 'fixed' })}
                    className={`flex-1 py-2.5 px-4 rounded-lg border-2 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                      formData.salaryType === 'fixed'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                        : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <DollarSign className="w-4 h-4" />
                    Fixed Monthly
                    <span className="text-xs font-normal opacity-70">(manual salary)</span>
                  </button>
                </div>

                {formData.salaryType === 'fixed' && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700">
                    Payroll will use the <strong>Base Monthly Salary</strong> directly each month — no attendance hours are calculated. EPF/ETF and deductions still apply. Fingerprint attendance is recorded for tracking only.
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-gray-400" />
                      {formData.salaryType === 'fixed' ? 'Fixed Monthly Salary' : 'Base Monthly Salary'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                      value={formData.baseSalary}
                      onChange={e => setFormData({ ...formData, baseSalary: Number(e.target.value) })}
                    />
                  </div>

                  <div className={`space-y-1 ${formData.salaryType === 'fixed' ? 'opacity-40 pointer-events-none' : ''}`}>
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

                  <div className={`space-y-1 ${formData.salaryType === 'fixed' ? 'opacity-40 pointer-events-none' : ''}`}>
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
              </div>

              {/* SECTION 6: Custom & Department Allowances */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-gray-900 border-b pb-2 flex items-center gap-2">
                  <Award className="w-4 h-4 text-purple-600" />
                  Custom & Department-Specific Allowances
                </h4>
                <p className="text-xs text-gray-400">
                  Add dynamic allowances (e.g., Night Shift, Sales Commission, Hazard Pay) that are unique to this employee's department.
                </p>

                {/* List current custom allowances */}
                {Object.keys(formData.additionalAllowances).length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-purple-50/20 border border-purple-100 rounded-lg">
                    {Object.entries(formData.additionalAllowances).map(([key, val]) => (
                      <div key={key} className="flex justify-between items-center bg-white px-3 py-2 border border-purple-50 rounded-lg shadow-sm">
                        <div>
                          <span className="text-xs font-semibold text-gray-700 block">{key}</span>
                          <span className="text-sm font-bold text-purple-700">LKR {val.toLocaleString()}</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full"
                          onClick={() => handleRemoveAllowance(key)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-400 text-xs border border-dashed rounded-lg">
                    No custom allowances configured for this profile.
                  </div>
                )}

                {/* Add new custom allowance form controls */}
                <div className="flex flex-col sm:flex-row items-end gap-3 p-3 bg-gray-50 border border-gray-150 rounded-lg">
                  <div className="space-y-1 flex-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Allowance Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Sales Commission"
                      className="w-full px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      value={newAllowanceKey}
                      onChange={e => setNewAllowanceKey(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1 sm:w-44">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount (LKR)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="e.g. 15000"
                      className="w-full px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      value={newAllowanceVal}
                      onChange={e => setNewAllowanceVal(e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={handleAddAllowance}
                    disabled={!newAllowanceKey.trim()}
                    className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-4 h-9 flex items-center justify-center gap-1 font-semibold animate-pulse hover:animate-none"
                  >
                    <Plus className="w-4 h-4" /> Add
                  </Button>
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
