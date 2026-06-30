import { api } from "../lib/api";
import type { LoginCredentials, TokenPair } from "@/types";

export const login = (credentials: LoginCredentials) =>
  api.post<TokenPair & { role?: string }>("/auth/token/", credentials).then((response) => {
    localStorage.setItem("access", response.data.access);
    localStorage.setItem("refresh", response.data.refresh);
    if (response.data.role) localStorage.setItem("role", response.data.role);
    return response.data;
  });

export const logout = () => {
  localStorage.removeItem("access");
  localStorage.removeItem("refresh");
  localStorage.removeItem("role");
};

export const isAuthenticated = () => !!localStorage.getItem("access");
