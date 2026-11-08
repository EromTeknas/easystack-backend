export interface DeliveryContext {
  projectId: number;
  environmentId: number;
  environmentName: string; // e.g., 'live' or 'dev'
  environmentDisplayName: string; // e.g., 'Live' or 'Dev'
  projectName: string;
  apiKeyId: number;
  apiKeyName: string;
  keyPrefix: string;
  rateLimitPerMinute: number;
  allowedOrigins: string[] | null;
}

export interface DeliveryPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface DeliveryMeta {
  project: string;
  environment: string;
  blueprint: string;
  type: 'singleton' | 'collection' | 'entry';
  locale: string;
  pagination?: DeliveryPaginationMeta | undefined;
  timestamp: string;
}

export interface DeliveryResponse<T> {
  data: T;
  meta: DeliveryMeta;
}

export interface DeliveryListQueryParams {
  page?: number | undefined;
  limit?: number | undefined;
  sort?: string | undefined;
  search?: string | undefined;
  locale?: string | undefined;
  fields?: string | undefined;
}

export interface DeliveryConnectionTestResponse {
  status: 'connected';
  project: {
    id: number;
    name: string;
  };
  environment: {
    id: number;
    name: string;
    displayName: string;
  };
  key: {
    id: number;
    name: string;
    prefix: string;
  };
  timestamp: string;
}

export interface DeliveryErrorEnvelope {
  error: {
    code: string;
    message: string;
    statusCode: number;
    requestId?: string | undefined;
  };
}
