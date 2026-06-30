import { BrowserRouter, Routes, Route, Navigate, useOutletContext } from 'react-router-dom';
import { useAuthContext } from '@asgardeo/auth-react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AdminEmployees from './components/AdminEmployees';
import AdminAttendance from './components/AdminAttendance';
import AdminPayroll from './components/AdminPayroll';
import AdminSettings from './components/AdminSettings';
import ManagerOverview from './components/ManagerOverview';
import type { User as DBUser } from './lib/api';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { state } = useAuthContext();
  const hasDevToken = !!localStorage.getItem('dev_token');

  if (state.isLoading && !hasDevToken) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!state.isAuthenticated && !hasDevToken) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Reads user from Dashboard's outlet context and passes to ManagerOverview
function OverviewOutlet() {
  const { user } = useOutletContext<{ user: DBUser }>();
  return <ManagerOverview user={user} />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview"    element={<OverviewOutlet />} />
          <Route path="employees"   element={<AdminEmployees />} />
          <Route path="attendance"  element={<AdminAttendance />} />
          <Route path="payroll"     element={<AdminPayroll />} />
          <Route path="settings"    element={<AdminSettings />} />
        </Route>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
