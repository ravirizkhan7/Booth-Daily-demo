import { User } from '../types';

export const PIN_LENGTH = 4;

/**
 * Generate candidate 4-digit unique numeric PIN.
 * Preserves leading zeroes (e.g. "0123").
 * Checks candidate against all stored users (Owner and employees).
 * If oldPin is provided, ensures candidate is different from oldPin.
 */
export function generateUniquePin(
  existingUsers: User[],
  currentUserId?: string,
  oldPin?: string,
  currentCandidate?: string
): string {
  // Collect all occupied PINs (excluding current user's PIN if currentUserId is given, but including oldPin and current candidate if specified)
  const occupiedPins = new Set<string>();
  for (const u of existingUsers) {
    if (u.pin && (!currentUserId || String(u.id) !== String(currentUserId))) {
      occupiedPins.add(u.pin.trim());
    }
  }
  if (oldPin && oldPin.trim()) {
    occupiedPins.add(oldPin.trim());
  }
  if (currentCandidate && currentCandidate.trim()) {
    occupiedPins.add(currentCandidate.trim());
  }

  // Maximum combinations for 4-digit PIN is 10,000 (0000 - 9999)
  const maxCombinations = Math.pow(10, PIN_LENGTH);
  if (occupiedPins.size >= maxCombinations) {
    throw new Error('Tidak dapat menghasilkan PIN unik: seluruh kombinasi PIN 4 digit telah digunakan.');
  }

  // Try random generation first
  for (let attempt = 0; attempt < 500; attempt++) {
    const randomNum = Math.floor(Math.random() * maxCombinations);
    const candidate = String(randomNum).padStart(PIN_LENGTH, '0');
    if (!occupiedPins.has(candidate)) {
      return candidate;
    }
  }

  // Fallback: deterministic scan with random start offset
  const startOffset = Math.floor(Math.random() * maxCombinations);
  for (let i = 0; i < maxCombinations; i++) {
    const num = (startOffset + i) % maxCombinations;
    const candidate = String(num).padStart(PIN_LENGTH, '0');
    if (!occupiedPins.has(candidate)) {
      return candidate;
    }
  }

  throw new Error('Tidak dapat menghasilkan PIN unik: seluruh kombinasi PIN 4 digit telah digunakan.');
}

/**
 * Check if a PIN is unique among users (optionally excluding a specific user ID)
 */
export function isPinUnique(
  pin: string,
  existingUsers: User[],
  currentUserId?: string
): boolean {
  const cleanPin = pin.trim();
  if (!cleanPin || !/^\d{4}$/.test(cleanPin)) return false;

  return !existingUsers.some(
    u => (!currentUserId || String(u.id) !== String(currentUserId)) && u.pin?.trim() === cleanPin
  );
}

/**
 * Find any PIN conflicts across existing users (duplicate detection)
 */
export function findPinConflicts(
  users: User[]
): { pin: string; userIds: string[]; userNames: string[] }[] {
  const pinMap = new Map<string, User[]>();

  for (const u of users) {
    if (!u.pin) continue;
    const cleanPin = u.pin.trim();
    if (!pinMap.has(cleanPin)) {
      pinMap.set(cleanPin, []);
    }
    pinMap.get(cleanPin)!.push(u);
  }

  const conflicts: { pin: string; userIds: string[]; userNames: string[] }[] = [];
  for (const [pin, list] of pinMap.entries()) {
    if (list.length > 1) {
      conflicts.push({
        pin,
        userIds: list.map(u => u.id),
        userNames: list.map(u => u.name),
      });
    }
  }

  return conflicts;
}
