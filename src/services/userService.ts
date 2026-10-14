import { User } from '../types';
import { userRepository } from '../mock/repositories/userRepository';
import { generateUniquePin, findPinConflicts } from '../utils/pinUtils';

export const userService = {
  async login(email: string, password?: string): Promise<{ user?: User; token?: string; token_id?: string }> {
    return userRepository.login(email, password);
  },

  async loginByPin(pin: string): Promise<{ user?: User; token?: string }> {
    return userRepository.loginByPin(pin);
  },

  async getMe(): Promise<User> {
    return userRepository.getMe();
  },

  async updateProfile(
    userData: Partial<User>,
    avatarFile?: File | null
  ): Promise<User> {
    return userRepository.updateProfile(userData, avatarFile);
  },

  async getUsers(): Promise<User[]> {
    return userRepository.getUsers();
  },

  async verifyPin(pin: string): Promise<{ user: User; token?: string } | null> {
    return userRepository.verifyPin(pin);
  },

  async createUser(
    userData: Omit<User, 'id' | 'avatar'>,
    avatarFile?: File | null
  ): Promise<User> {
    return userRepository.createUser(userData, avatarFile);
  },

  async updateUser(
    id: string,
    userData: Partial<User>,
    avatarFile?: File | null
  ): Promise<User> {
    return userRepository.updateUser(id, userData, avatarFile);
  },

  async deleteUser(id: string): Promise<boolean> {
    return userRepository.deleteUser(id);
  },

  async logout(): Promise<void> {
    return userRepository.logout();
  },

  async generateUniquePin(
    currentUserId?: string,
    oldPin?: string,
    currentCandidate?: string
  ): Promise<string> {
    const users = await this.getUsers();
    return generateUniquePin(users, currentUserId, oldPin, currentCandidate);
  },

  async findPinConflicts(): Promise<{ pin: string; userIds: string[]; userNames: string[] }[]> {
    const users = await this.getUsers();
    return findPinConflicts(users);
  },
};
