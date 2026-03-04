import { useAuthContext } from '@asgardeo/auth-react';
import { useMemo } from 'react';
import { createApi } from '../lib/api';

// Returns an axios instance pre-configured with the current user's access token.
// Re-creates the instance only when getAccessToken reference changes.
export function useApi() {
  const { getAccessToken } = useAuthContext();
  return useMemo(() => createApi(getAccessToken), [getAccessToken]);
}
