import { api } from "@/lib/api";
import type { DeploymentConfig } from "@/types";

export const getConfig = () =>
  api.get<DeploymentConfig>("/config/").then((response) => response.data);
