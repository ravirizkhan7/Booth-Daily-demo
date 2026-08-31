export interface DemoSession {
  userId: string;
  token: string;
  loggedInAt: string;
}

export const DEMO_SESSION_KEY = 'boothdaily_demo_session';

const isLocalStorageAvailable = (): boolean => {
  try {
    return (
      typeof window !== 'undefined' &&
      typeof window.localStorage !== 'undefined' &&
      window.localStorage !== null
    );
  } catch {
    return false;
  }
};

let inMemorySession: DemoSession | null = null;

export const sessionManager = {
  getSession(): DemoSession | null {
    if (isLocalStorageAvailable()) {
      try {
        const raw = window.localStorage.getItem(DEMO_SESSION_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.userId === 'string' && typeof parsed.token === 'string') {
          return parsed as DemoSession;
        }
        return null;
      } catch {
        return null;
      }
    }
    return inMemorySession;
  },

  setSession(session: DemoSession): void {
    if (isLocalStorageAvailable()) {
      try {
        window.localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(session));
      } catch (e) {
        console.error('[SessionManager] Failed to set session:', e);
      }
    } else {
      inMemorySession = session;
    }
  },

  clearSession(): void {
    if (isLocalStorageAvailable()) {
      try {
        window.localStorage.removeItem(DEMO_SESSION_KEY);
      } catch (e) {
        console.error('[SessionManager] Failed to clear session:', e);
      }
    } else {
      inMemorySession = null;
    }
  },
};
