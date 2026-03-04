import { useAuthContext, DecodedIDTokenPayload } from '@asgardeo/auth-react';
import { useEffect, useState } from 'react';
import { LogOut, User, Briefcase, Building2, Hash, Shield, Users, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useApi } from '@/hooks/useApi';
import type { User as DBUser } from '@/lib/api';

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

  // On first authenticated load: sync the user to our DB, then fetch their record.
  useEffect(() => {
    if (!state.isAuthenticated || syncState !== 'idle') return;

    const syncAndFetch = async () => {
      setSyncState('syncing');
      try {
        const decoded = (await getDecodedIDToken()) as AsgardeoToken;
        const email = decoded.email as string;
        const name = (decoded.name || decoded.username || email) as string;

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
  }, [state.isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

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
            <h1 className="text-xl font-bold text-gray-900">Payroll System</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 hidden sm:block">{user.email}</span>
            <RoleBadge role={user.role} />
            <Button variant="outline" size="sm" onClick={() => signOut()} className="flex items-center gap-2">
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
        {user.role === 'ADMIN' && <AdminPanel />}
        {user.role === 'MANAGER' && <ManagerPanel />}
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

function AdminPanel() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <PlaceholderCard
        icon={<Users className="w-6 h-6 text-blue-600" />}
        title="Manage Employees"
        description="Add, edit, and configure employee salary settings."
      />
      <PlaceholderCard
        icon={<FileText className="w-6 h-6 text-green-600" />}
        title="Upload Attendance"
        description="Upload the monthly Excel timecard to process attendance."
      />
      <PlaceholderCard
        icon={<Shield className="w-6 h-6 text-purple-600" />}
        title="Run Payroll"
        description="Calculate salaries and generate payslips for all employees."
      />
    </div>
  );
}

function ManagerPanel() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <PlaceholderCard
        icon={<Users className="w-6 h-6 text-blue-600" />}
        title="Team Overview"
        description="View attendance and payroll summary for your department."
      />
      <PlaceholderCard
        icon={<FileText className="w-6 h-6 text-green-600" />}
        title="Reports"
        description="View department-level payroll and attendance reports."
      />
    </div>
  );
}

function EmployeePanel({ user }: { user: DBUser }) {
  const profile = user.salaryProfile;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card className="p-5">
        <h3 className="font-semibold text-gray-900 mb-3 text-sm">Salary Details</h3>
        <div className="space-y-2 text-sm">
          {[
            { label: 'Base Salary', value: profile?.baseSalary ?? 0 },
            { label: 'Hourly Rate', value: profile?.hourlyRate ?? 0 },
            { label: 'Travel Allowance', value: profile?.travelAllowance ?? 0 },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between">
              <span className="text-gray-500">{label}</span>
              <span className="font-medium">LKR {value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </Card>
      <PlaceholderCard
        icon={<FileText className="w-6 h-6 text-blue-600" />}
        title="My Payslips"
        description="View and download your monthly payslips once payroll is processed."
      />
    </div>
  );
}

function PlaceholderCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <Card className="p-5 flex flex-col gap-3 border-dashed">
      <div className="flex items-center gap-3">
        {icon}
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
      </div>
      <p className="text-sm text-gray-500 flex-1">{description}</p>
      <span className="text-xs text-gray-400 font-medium">Coming soon</span>
    </Card>
  );
}
