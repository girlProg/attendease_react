import { api } from "../lib/api";
import type { LoginCredentials, TokenPair } from "@/types";

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
