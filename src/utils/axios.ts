/**
 * Standalone image URL helper and API client stub.
 * Eliminates all network connection attempts to external Laravel/Cloudflare backend.
 */

export const getImageUrl = (path?: string): string => {
  if (!path) return '';
  if (
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('data:') ||
    path.startsWith('/')
  ) {
    return path;
  }
  return path;
};

// Safe fallback stub for backward compatibility
const api = {
  get: async () => ({ data: null }),
  post: async () => ({ data: null }),
  put: async () => ({ data: null }),
  delete: async () => ({ data: null }),
  interceptors: {
    request: { use: () => {} },
    response: { use: () => {} },
  },
};

export default api;
