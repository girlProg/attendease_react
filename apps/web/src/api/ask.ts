import { api } from "../lib/api";

export interface AskColumn {
  key: string;
  label: string;
}

export interface AskResult {
  question: string;
  display: "table" | "cards";
  title: string;
  columns: AskColumn[];
  rows: Record<string, unknown>[];
  truncated: boolean;
  explanation: string;
  orm: string;
}

export const askQuestion = (question: string) =>
  api.post<AskResult>("/ask/", { question }).then((r) => r.data);
