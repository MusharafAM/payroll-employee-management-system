import { useAuthContext } from '@asgardeo/auth-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function Login() {
  const { signIn, state } = useAuthContext();
  const navigate = useNavigate();
  const [customEmail, setCustomEmail] = useState('');

  useEffect(() => {
    if (state.isAuthenticated) {
      navigate('/dashboard');
    }
  }, [state.isAuthenticated, navigate]);

  const handleLogin = async () => {
    try {
      await signIn();
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleMockLogin = (role: 'admin' | 'manager' | 'employee') => {
    localStorage.setItem('dev_token', `dev-token-${role}`);
    navigate('/dashboard');
  };

  const handleCustomEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail) return;
    localStorage.setItem('dev_token', `dev-token-email:${customEmail.trim().toLowerCase()}`);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100">
      <Card className="w-full max-w-md p-8 shadow-xl bg-white rounded-2xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Payroll System</h1>
          <p className="text-xs text-gray-500 mt-1">Employee Management Portal</p>
        </div>
        
        <Button 
          onClick={handleLogin}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm hover:shadow transition-all font-semibold"
          size="lg"
          disabled={state.isLoading}
        >
          {state.isLoading ? 'Loading...' : 'Login with Asgardeo'}
        </Button>

        {/* Sandbox Dev Access */}
        <div className="mt-8 border-t border-gray-100 pt-6">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider text-center mb-4">Local Sandbox Access</p>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleMockLogin('admin')}
              className="text-xs font-semibold text-rose-700 bg-rose-50/50 border-rose-100 hover:bg-rose-100/60"
            >
              Admin
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleMockLogin('manager')}
              className="text-xs font-semibold text-indigo-700 bg-indigo-50/50 border-indigo-100 hover:bg-indigo-100/60"
            >
              Manager
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleMockLogin('employee')}
              className="text-xs font-semibold text-emerald-700 bg-emerald-50/50 border-emerald-100 hover:bg-emerald-100/60"
            >
              Employee
            </Button>
          </div>

          <form onSubmit={handleCustomEmailLogin} className="space-y-2">
            <input
              type="email"
              required
              placeholder="Or enter employee email..."
              value={customEmail}
              onChange={(e) => setCustomEmail(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
            <Button
              type="submit"
              size="sm"
              className="w-full bg-gray-800 hover:bg-gray-950 text-white rounded-lg text-xs font-semibold transition-all py-2"
            >
              Mock Login by Email
            </Button>
          </form>

          <p className="text-[10px] text-gray-400 text-center mt-3">
            Developer mode bypasses Asgardeo SSO for offline testing.
          </p>
        </div>
      </Card>
    </div>
  );
}