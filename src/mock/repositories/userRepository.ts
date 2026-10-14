import { User } from '../../types';
import { mockStore } from '../store';
import { sessionManager } from './sessionManager';
import { fileToBase64 } from '../utils/imageHelper';

export const userRepository = {
  async login(identifier: string, password?: string): Promise<{ user: User; token: string; token_id: string }> {
    const cleanId = identifier.trim().toLowerCase();
    const users = mockStore.getUsers();

    const user = users.find(
      u =>
        u.email.toLowerCase() === cleanId ||
        (u.username && u.username.toLowerCase() === cleanId) ||
        u.name.toLowerCase() === cleanId
    );

    if (!user) {
      throw new Error('Username/email atau password salah');
    }

    if (!user.is_active) {
      throw new Error('Akun pengguna dinonaktifkan. Hubungi administrator.');
    }

    // Support custom password on user entity or fallback to 'demo123'
    const expectedPassword = user.password || 'demo123';
    if (!password || (password !== expectedPassword && password !== 'demo123')) {
      throw new Error('Username/email atau password salah');
    }

    const token = `mock_token_${user.id}`;
    sessionManager.setSession({
      userId: user.id,
      token,
      loggedInAt: new Date().toISOString(),
    });

    return {
      user,
      token,
      token_id: user.id,
    };
  },

  async loginByPin(pin: string): Promise<{ user: User; token: string }> {
    const cleanPin = pin.trim();
    if (!/^\d{4}$/.test(cleanPin)) {
      throw new Error('PIN tidak valid. Masukkan 4 digit angka numerik.');
    }
    const users = mockStore.getUsers();

    const matchingUsers = users.filter(u => u.pin && u.pin.trim() === cleanPin && u.is_active);

    if (matchingUsers.length === 0) {
      throw new Error('PIN tidak valid atau pengguna tidak aktif');
    }

    if (matchingUsers.length > 1) {
      const names = matchingUsers.map(u => u.name).join(', ');
      throw new Error(
        `Konflik autentikasi: PIN ambigu karena digunakan oleh lebih dari satu pengguna (${names}). Autentikasi ditolak sampai konflik diselesaikan.`
      );
    }

    const user = matchingUsers[0];
    const ticket = mockStore.issuePinVerificationTicket(user.id);

    return {
      user,
      token: ticket.ticketId,
    };
  },

  async getMe(): Promise<User> {
    const session = sessionManager.getSession();
    if (!session || !session.userId) {
      throw new Error('Unauthenticated');
    }

    const user = mockStore.getUserById(session.userId);
    if (!user) {
      sessionManager.clearSession();
      throw new Error('Session invalid, user not found');
    }

    return user;
  },

  async verifyPin(pin: string): Promise<{ user: User; token?: string } | null> {
    try {
      const res = await this.loginByPin(pin);
      return res;
    } catch {
      return null;
    }
  },

  async getUsers(): Promise<User[]> {
    return mockStore.getUsers();
  },

  async updateProfile(userData: Partial<User>, avatarFile?: File | null): Promise<User> {
    const current = await this.getMe();
    const updatePayload: Partial<User> = { ...userData };

    if (avatarFile) {
      updatePayload.avatar = await fileToBase64(avatarFile);
    }

    const updated = mockStore.updateUser(current.id, updatePayload);

    // Synchronize current session if user ID matches
    const session = sessionManager.getSession();
    if (session && session.userId === current.id) {
      sessionManager.setSession({
        ...session,
        loggedInAt: new Date().toISOString(),
      });
    }

    return updated;
  },

  async createUser(userData: Omit<User, 'id' | 'avatar'>, avatarFile?: File | null): Promise<User> {
    const avatarUrl = avatarFile ? await fileToBase64(avatarFile) : undefined;
    const payload: Omit<User, 'id'> = {
      ...userData,
      avatar: avatarUrl,
    };

    return mockStore.addUser(payload);
  },

  async updateUser(id: string, userData: Partial<User>, avatarFile?: File | null): Promise<User> {
    const updatePayload: Partial<User> = { ...userData };
    if (avatarFile) {
      updatePayload.avatar = await fileToBase64(avatarFile);
    }

    return mockStore.updateUser(id, updatePayload);
  },

  async deleteUser(id: string): Promise<boolean> {
    return mockStore.deleteUser(id);
  },

  async logout(): Promise<void> {
    sessionManager.clearSession();
  },
};
