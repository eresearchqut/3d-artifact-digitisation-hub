import { useEffect, useState } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { ADMINISTRATORS_GROUP } from '../constants/groups';

export function useIsAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetchAuthSession()
      .then((session) => {
        const groups =
          (session.tokens?.idToken?.payload?.['cognito:groups'] as
            | string[]
            | undefined) ?? [];
        setIsAdmin(groups.includes(ADMINISTRATORS_GROUP));
      })
      .catch(() => setIsAdmin(false));
  }, []);

  return isAdmin;
}
