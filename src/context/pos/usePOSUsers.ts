import { useState } from 'react';
import { User } from '../../types';

export const usePOSUsers = () => {
  const [usersList, setUsersList] = useState<User[]>([]);

  return {
    usersList,
    setUsersList,
  };
};
