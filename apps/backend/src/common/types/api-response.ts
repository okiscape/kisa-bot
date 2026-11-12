import { ErrorCode } from "./error-codes";

export interface ApiMeta {
  requestId: string;
  [key: string]: unknown;
}

export interface ApiSuccessResponse<T> {
  data: T;
  meta: ApiMeta;
}

export interface ApiErrorBody {
  code: ErrorCode | string;
  message: string;
  details: unknown;
}

export interface ApiErrorResponse {
  error: ApiErrorBody;
  meta: ApiMeta;
}
