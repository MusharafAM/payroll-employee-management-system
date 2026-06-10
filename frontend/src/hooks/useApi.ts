import { useAuthContext } from '@asgardeo/auth-react';
import { useMemo } from 'react';
import { createApi } from '../lib/api';

export function useApi() {
  const { getAccessToken } = useAuthContext();
  return useMemo(() => {
    const localToken = localStorage.getItem('dev_token');
    if (localToken) {
      return createApi(() => Promise.resolve(localToken));
    }
    return createApi(getAccessToken);
  }, [getAccessToken]);
}
