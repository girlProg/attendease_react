// src/api/auth.ts
import { api } from "../lib/api";

export interface LoginCredentials {
  email: string;   // see note below — might be "email" for your user model
  password: string;
}

export interface TokenPair {
  access: string;
  refresh: string;
}

export const login = (credentials: LoginCredentials) =>
  api.post<TokenPair>("/auth/token/", credentials).then((r) => {
    localStorage.setItem("access", r.data.access);
    localStorage.setItem("refresh", r.data.refresh);
    return r.data;
  });

export const logout = () => {
  localStorage.removeItem("access");
  localStorage.removeItem("refresh");
};

export const isAuthenticated = () => !!localStorage.getItem("access");