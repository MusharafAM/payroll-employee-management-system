import { useAuthContext, DecodedIDTokenPayload } from '@asgardeo/auth-react';
import { useEffect, useState } from 'react';
import { LogOut, User, Briefcase, Building2, Hash, Shield, Users, FileText, Settings, BarChart2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useApi } from '@/hooks/useApi';
import type { User as DBUser } from '@/lib/api';
import AdminEmployees from '@/components/AdminEmployees';
import AdminAttendance from '@/components/AdminAttendance';
import AdminSettings from '@/components/AdminSettings';
import AdminPayroll from '@/components/AdminPayroll';
import EmployeeDashboard from '@/components/EmployeeDashboard';
import ManagerOverview from '@/components/ManagerOverview';


interface AsgardeoToken extends DecodedIDTokenPayload {
  groups?: string[];
}

type SyncState = 'idle' | 'syncing' | 'done' | 'error';

export default function Dashboard() {
  const { state, signOut, getDecodedIDToken } = useAuthContext();
  const api = useApi();

  const [dbUser, setDbUser] = useState<DBUser | null>(null);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [error, setError] = useState('');

  const hasDevToken = !!localStorage.getItem('dev_token');

  // On first authenticated load: sync the user to our DB, then fetch their record.
  useEffect(() => {
    if ((!state.isAuthenticated && !hasDevToken) || syncState !== 'idle') return;

    const syncAndFetch = async () => {
      setSyncState('syncing');
      try {
        let email = '';
        let name = '';
        
        if (hasDevToken) {
          const token = localStorage.getItem('dev_token') || '';
          if (token.startsWith('dev-token-email:')) {
            email = token.replace('dev-token-email:', '');
            const prefix = email.split('@')[0];
            name = prefix.charAt(0).toUpperCase() + prefix.slice(1);
          } else if (token === 'dev-token-admin') {
            email = 'admin@company.com';
            name = 'Dev Admin';
          } else if (token === 'dev-token-manager') {
            email = 'manager@company.com';
            name = 'Dev Manager';
          } else {
            email = 'employee@company.com';
            name = 'Dev Employee';
          }
        } else {
          const decoded = (await getDecodedIDToken()) as AsgardeoToken;
          email = decoded.email as string;
          name = (decoded.name || decoded.username || email) as string;
        }

        // Create / update user in DB (role is read from the JWT groups claim by the backend)
        await api.post('/auth/sync-user', { email, name });

        // Fetch the full DB record
        const { data } = await api.get<{ user: DBUser }>('/auth/me');
        setDbUser(data.user);
        setSyncState('done');
      } catch (err: unknown) {
        console.error('Failed to sync user:', err);
        const msg = err instanceof Error ? err.message : String(err);
        // axios wraps HTTP errors — try to get the response status
        const axiosErr = err as { response?: { status: number; data?: { error?: string } } };
        if (axiosErr.response) {
          const status = axiosErr.response.status;
          const detail = axiosErr.response.data?.error ?? '';
          setError(`Server returned ${status}: ${detail || msg}`);
        } else {
          setError(`Cannot reach backend (port 3000). ${msg}`);
        }
        setSyncState('error');
      }
    };

    syncAndFetch();
  }, [state.isAuthenticated, hasDevToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Loading ---
  if (syncState === 'idle' || syncState === 'syncing') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Connecting to server...</p>
        </div>
      </div>
    );
  }

  // --- Error ---
  if (syncState === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="p-8 max-w-md text-center space-y-4">
          <p className="text-red-600 font-semibold">Connection Error</p>
          <p className="text-gray-600 text-sm">{error}</p>
          <Button variant="outline" onClick={() => signOut()}>Sign Out</Button>
        </Card>
      </div>
    );
  }

  const user = dbUser!;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">PODUR Payroll</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 hidden sm:block">{user.email}</span>
            <RoleBadge role={user.role} />
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                if (localStorage.getItem('dev_token')) {
                  localStorage.removeItem('dev_token');
                  window.location.href = '/login';
                } else {
                  signOut();
                }
              }} 
              className="flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Profile card */}
        <Card className="p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            Welcome back, {user.name}!
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <InfoCell icon={<User className="w-4 h-4" />} label="Full Name" value={user.name} />
            <InfoCell icon={<Hash className="w-4 h-4" />} label="Employee ID" value={user.employeeId} />
            <InfoCell icon={<Building2 className="w-4 h-4" />} label="Department" value={user.department || '—'} />
            <InfoCell icon={<Briefcase className="w-4 h-4" />} label="Position" value={user.position || '—'} />
          </div>
        </Card>

        {/* Role-specific panels */}
        {user.role === 'ADMIN' && <AdminPanel user={user} />}
        {user.role === 'MANAGER' && <ManagerPanel user={user} />}
        {user.role === 'EMPLOYEE' && <EmployeePanel user={user} />}
      </main>
    </div>
  );
}

// ---- Sub-components ----

function InfoCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
      <div className="text-blue-600 mt-0.5">{icon}</div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="font-medium text-gray-900 text-sm">{value}</p>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    ADMIN: 'bg-red-100 text-red-700',
    MANAGER: 'bg-purple-100 text-purple-700',
    EMPLOYEE: 'bg-green-100 text-green-700',
  };
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${styles[role] ?? styles.EMPLOYEE}`}>
      {role}
    </span>
  );
}

function AdminPanel({ user }: { user: DBUser }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'employees' | 'attendance' | 'payroll' | 'settings'>('overview');

  return (
    <div className="space-y-6">
      {/* Admin Navigation Tabs */}
      <div className="flex flex-wrap border-b border-gray-200 gap-1 sm:gap-6 bg-white px-4 pt-4 rounded-t-xl border border-gray-100 shadow-sm">
        {[
          { id: 'overview', label: 'Company Overview', icon: <BarChart2 className="w-4 h-4" /> },
          { id: 'employees', label: 'Manage Employees', icon: <Users className="w-4 h-4" /> },
          { id: 'attendance', label: 'Upload Attendance', icon: <FileText className="w-4 h-4" /> },
          { id: 'payroll', label: 'Run Payroll', icon: <Shield className="w-4 h-4" /> },
          { id: 'settings', label: 'Payroll Settings', icon: <Settings className="w-4 h-4" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 pb-4 px-2 text-sm font-semibold border-b-2 transition-all ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white/50 rounded-b-xl border-x border-b border-gray-100 shadow-sm p-6">
        {activeTab === 'overview' && <ManagerOverview user={user} />}
        {activeTab === 'employees' && <AdminEmployees />}
        {activeTab === 'attendance' && <AdminAttendance />}
        {activeTab === 'payroll' && <AdminPayroll />}
        {activeTab === 'settings' && <AdminSettings />}
      </div>
    </div>
  );
}

function ManagerPanel({ user }: { user: DBUser }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'attendance' | 'payroll'>('overview');

  return (
    <div className="space-y-6">
      {/* Manager Navigation Tabs */}
      <div className="flex flex-wrap border-b border-gray-200 gap-1 sm:gap-6 bg-white px-4 pt-4 rounded-t-xl border border-gray-100 shadow-sm">
        {[
          { id: 'overview', label: 'Team Overview', icon: <Users className="w-4 h-4" /> },
          { id: 'attendance', label: 'Upload Attendance', icon: <FileText className="w-4 h-4" /> },
          { id: 'payroll', label: 'Run Payroll', icon: <Shield className="w-4 h-4" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 pb-4 px-2 text-sm font-semibold border-b-2 transition-all ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white/50 rounded-b-xl border-x border-b border-gray-100 shadow-sm p-6">
        {activeTab === 'overview' && <ManagerOverview user={user} />}
        {activeTab === 'attendance' && <AdminAttendance />}
        {activeTab === 'payroll' && <AdminPayroll />}
      </div>
    </div>
  );
}

function EmployeePanel({ user }: { user: DBUser }) {
  return <EmployeeDashboard user={user} />;
}

