/// <reference types="vite/client" />
import ReactDOM from 'react-dom/client';
import { AuthProvider } from '@asgardeo/auth-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';

const authConfig = {
  signInRedirectURL: 'http://localhost:5173',
  signOutRedirectURL: 'http://localhost:5173',
  clientID: import.meta.env.VITE_ASGARDEO_CLIENT_ID,
  baseUrl: import.meta.env.VITE_ASGARDEO_BASE_URL,
  scope: ['openid', 'profile', 'email', 'groups'],
  enablePKCE: true,
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <AuthProvider config={authConfig}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </AuthProvider>
);