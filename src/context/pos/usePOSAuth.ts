import React, { useState, useEffect, useCallback } from 'react';
import { User } from '../../types';
import { userService } from '../../services/userService';
import { leavePosBooth } from '../../services/echo';
import { ToastType } from './usePOSToast';

export interface UsePOSAuthProps {
  showToast: (message: string, type?: ToastType) => void;
  onAuthSuccess?: () => Promise<boolean | void>;
  onAuthLogout?: () => void;
  onUserUpdated?: (updatedUser: User) => void;
}

export const usePOSAuth = ({
  showToast,
  onAuthSuccess,
  onAuthLogout,
  onUserUpdated,
}: UsePOSAuthProps) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);

  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [isEditAccountModalOpen, setIsEditAccountModalOpen] = useState<boolean>(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState<boolean>(false);

  const openLoginModal = useCallback(() => setIsLoginModalOpen(true), []);
  const closeLoginModal = useCallback(() => setIsLoginModalOpen(false), []);
  const openEditAccountModal = useCallback(() => setIsEditAccountModalOpen(true), []);
  const closeEditAccountModal = useCallback(() => setIsEditAccountModalOpen(false), []);
  const openLogoutModal = useCallback(() => setIsLogoutModalOpen(true), []);
  const closeLogoutModal = useCallback(() => setIsLogoutModalOpen(false), []);

  // Listen for session expiry event
  useEffect(() => {
    let lastHandled = 0;
    const handleSessionExpired = () => {
      const now = Date.now();
      if (now - lastHandled < 1500) return;
      lastHandled = now;

      localStorage.removeItem('token');
      localStorage.removeItem('token_id');
      localStorage.removeItem('boothdaily_user_session');
      localStorage.removeItem('boothdaily_user_data');
      setCurrentUser(null);
      leavePosBooth();
      onAuthLogout?.();
      showToast('Sesi Anda telah berakhir. Silakan login kembali.', 'info');
    };

    window.addEventListener('auth:session-expired', handleSessionExpired);
    return () => window.removeEventListener('auth:session-expired', handleSessionExpired);
  }, [onAuthLogout, showToast]);

  // Authentication: Login
  const loginUser = async (identifier: string, secret: string) => {
    const cleanId = identifier.trim();

    if (!cleanId) {
      return { success: false, message: 'Masukkan Username atau Email' };
    }

    if (!secret) {
      return { success: false, message: 'Masukkan Password' };
    }

    try {
      const authRes = await userService.login(cleanId, secret);

      if (!authRes?.user?.id) {
        return {
          success: false,
          message: 'Response login tidak valid',
        };
      }

      const authToken =
        (authRes as any).token ??
        (authRes as any).access_token ??
        (authRes as any).data?.token ??
        (authRes as any).data?.access_token;

      if (!authToken) {
        return {
          success: false,
          message: 'Token autentikasi tidak ditemukan',
        };
      }

      const tokenId =
        (authRes as any).token_id ??
        (authRes as any).data?.token_id ??
        (authToken.includes('|') ? authToken.split('|')[0] : '');

      localStorage.setItem('token', authToken);
      if (tokenId) {
        localStorage.setItem('token_id', String(tokenId));
      }
      localStorage.setItem(
        'boothdaily_user_data',
        JSON.stringify(authRes.user)
      );
      localStorage.setItem(
        'boothdaily_user_session',
        authRes.user.id
      );

      setCurrentUser(authRes.user);
      if (onAuthSuccess) {
        await onAuthSuccess();
      }
      setIsLoginModalOpen(false);

      showToast(
        `Login berhasil sebagai ${authRes.user.name}`,
        'success'
      );

      return {
        success: true,
        message: 'Login Berhasil',
        user: authRes.user,
      };
    } catch (error: any) {
      return {
        success: false,
        message:
          error?.response?.data?.message ??
          error?.message ??
          'Username/email atau password salah',
      };
    }
  };

  // Authentication: Logout
  const logoutUser = async () => {
    try {
      await userService.logout();
    } catch (error) {
      console.warn('Logout failed:', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('token_id');
      localStorage.removeItem('boothdaily_user_session');
      localStorage.removeItem('boothdaily_user_data');

      setCurrentUser(null);
      leavePosBooth();
      onAuthLogout?.();
      setIsLogoutModalOpen(false);

      showToast('Logout berhasil. Anda kembali menjadi Guest.', 'info');
    }
  };

  // Authentication: Update Profile Account
  const updateCurrentUserAccount = async (
    updatedData: Partial<User>,
    avatarFile?: File | null
  ) => {
    if (!currentUser) {
      return { success: false, message: 'Tidak ada user aktif' };
    }
    try {
      const updated = await userService.updateProfile(updatedData, avatarFile);
      setCurrentUser(updated);
      onUserUpdated?.(updated);
      localStorage.setItem('boothdaily_user_data', JSON.stringify(updated));
      localStorage.setItem('boothdaily_user_session', updated.id);
      setIsEditAccountModalOpen(false);
      showToast('Data akun berhasil diperbarui', 'success');
      return { success: true, message: 'Profil berhasil diperbarui', user: updated };
    } catch (err: any) {
      return { success: false, message: err.message || 'Gagal memperbarui profil' };
    }
  };

  return {
    currentUser,
    setCurrentUser,
    authReady,
    setAuthReady,
    isLoginModalOpen,
    openLoginModal,
    closeLoginModal,
    isEditAccountModalOpen,
    openEditAccountModal,
    closeEditAccountModal,
    isLogoutModalOpen,
    openLogoutModal,
    closeLogoutModal,
    loginUser,
    logoutUser,
    updateCurrentUserAccount,
  };
};
