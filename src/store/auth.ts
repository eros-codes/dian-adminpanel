import { create } from "zustand";
import { persist } from "zustand/middleware";
import { User } from "@/types";
import { apiService } from "@/services/api";

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
}

const isValidToken = (token?: string | null) =>
  !!token && token.trim() !== "" && token !== "undefined" && token !== "null";

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (username, password) => {
        try {
          const response = await apiService.login({ username, password });
          // ApiService.login returns a typed payload {user, accessToken, refreshToken}
          const token = response?.accessToken ?? response?.accessToken;
          const user = response?.user ?? null;

          if (!isValidToken(token)) {
            throw new Error('Invalid access token received from server');
          }

          set({ user: user, token, isAuthenticated: true });
          localStorage.setItem('token', token);
          localStorage.setItem('user', JSON.stringify(user));
        } catch (e: unknown) {
          // Re-throw axios errors so caller can inspect response.data
          if (typeof e === 'object' && e && 'response' in e) {
            const msg = (e as { message?: string }).message || 'Login failed';
            const err = new Error(msg) as Error & { response?: unknown };
            err.response = (e as { response?: unknown }).response;
            throw err;
          }
          throw e;
        }
      },

      logout: () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        set({ user: null, token: null, isAuthenticated: false });
      },

      setUser: (user: User) => set({ user, isAuthenticated: true }),
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return; // ✅ safeguard

        const storedUser = localStorage.getItem("user");
        const storedToken = localStorage.getItem("token");

        if (storedUser && isValidToken(storedToken)) {
          try {
            state.user = JSON.parse(storedUser);
            state.token = storedToken;
            state.isAuthenticated = true;
          } catch {
            localStorage.removeItem("user");
            localStorage.removeItem("token");
            state.user = null;
            state.token = null;
            state.isAuthenticated = false;
          }
        } else {
          state.user = null;
          state.token = null;
          state.isAuthenticated = false;
        }
      },
    }
  )
);
