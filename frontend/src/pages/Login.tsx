import { useAuthContext } from '@asgardeo/auth-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function Login() {
  const { signIn, state } = useAuthContext();
  const navigate = useNavigate();

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <Card className="w-full max-w-md p-8 shadow-xl">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Payroll System</h1>
          <p className="text-gray-600 mt-2">Employee Management Portal</p>
        </div>
        
        <Button 
          onClick={handleLogin}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          size="lg"
          disabled={state.isLoading}
        >
          {state.isLoading ? 'Loading...' : 'Login with Asgardeo'}
        </Button>
        
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            Secured by WSO2 Asgardeo
          </p>
        </div>
      </Card>
    </div>
  );
}