/**
 * Safe no-op Echo / WebSocket Stub for Standalone Demo Mode.
 * Eliminates all network connection attempts to Pusher, Reverb, or /broadcasting/auth.
 */

export interface SafeChannelStub {
  listen: (event: string, callback: (...args: any[]) => void) => SafeChannelStub;
  stopListening: (event: string, callback?: (...args: any[]) => void) => SafeChannelStub;
  notification: (callback: (...args: any[]) => void) => SafeChannelStub;
  listenForWhisper: (event: string, callback: (...args: any[]) => void) => SafeChannelStub;
}

const dummyChannel: SafeChannelStub = {
  listen: () => dummyChannel,
  stopListening: () => dummyChannel,
  notification: () => dummyChannel,
  listenForWhisper: () => dummyChannel,
};

export const getEcho = (): null => {
  return null;
};

export const onEchoConnected = (_callback: () => void): (() => void) => {
  // Safe no-op unbinder
  return () => {};
};

export const subscribePosPublic = (): SafeChannelStub | null => {
  return dummyChannel;
};

export const leavePosPublic = (): void => {
  // Safe no-op
};

export const subscribePosBooth = (): SafeChannelStub | null => {
  return dummyChannel;
};

export const leavePosBooth = (): void => {
  // Safe no-op
};

export const disconnectEcho = (): void => {
  // Safe no-op
};
