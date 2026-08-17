import { api } from "../lib/api"
import type { Payee } from "@/types"

export interface DisbursementBatchCounts {
  total: number
  successful: number
  failed: number
  in_flight: number
}

export interface DisbursementBatch {
  id: number
  reference: string
  provider: string
  status: string
  provider_code: string
  provider_description: string
  amount: string
  use_single_debit: boolean
  submitted_at: string | null
  created_by: string
  counts: DisbursementBatchCounts
  created_at: string
  updated_at: string
}

export interface CreateDisbursementBatchParams {
  payment_ids: number[]
  amount: number
  use_single_debit?: boolean
  payee?: Payee
}

/**
 * Create a disbursement batch from existing (undisbursed) Payment ids and
 * submit it to the configured bank provider in one step. Celery then polls the
 * bank until every transaction is terminal.
 */
export const createDisbursementBatch = (params: CreateDisbursementBatchParams) =>
  api
    .post<DisbursementBatch>("/disbursement-batch/", params)
    .then((response) => response.data)
