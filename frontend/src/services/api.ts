/**
 * API Client
 * 
 * Axios wrapper for making HTTP requests to the backend API.
 * Handles authentication, error handling, and request/response interceptors.
 * Includes automatic retry logic with exponential backoff for transient failures.
 */

import axios, { AxiosError } from 'axios';
import type { AxiosInstance, AxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:7071/api';
const REQUEST_TIMEOUT = 30000; // 30 seconds

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAYS = [100, 200, 400]; // Exponential backoff: 100ms → 200ms → 400ms
const RETRYABLE_STATUS_CODES = [429, 503]; // Rate limit, Service unavailable

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  requestId?: string;
}

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: REQUEST_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor - Add auth token and retry metadata
    this.client.interceptors.request.use(
      (config) => {
        // Get token from localStorage (will be set by auth service)
        const token = localStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Add request ID for tracing
        config.headers['X-Request-ID'] = this.generateRequestId();

        // Initialize retry count if not present
        if (!config.headers['X-Retry-Count']) {
          config.headers['X-Retry-Count'] = '0';
        }

        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor - Handle errors and retries
    this.client.interceptors.response.use(
      (response) => {
        return response;
      },
      async (error: AxiosError) => {
        const config = error.config;

        // Handle 401 Unauthorized
        if (error.response?.status === 401) {
          localStorage.removeItem('auth_token');
          window.location.href = '/login';
          return Promise.reject(error);
        }

        // Retry logic for transient failures
        if (config && this.shouldRetry(error)) {
          const retryCount = parseInt(config.headers['X-Retry-Count'] as string || '0');

          if (retryCount < MAX_RETRIES) {
            // Increment retry count
            config.headers['X-Retry-Count'] = (retryCount + 1).toString();

            // Get delay for this retry attempt
            const delay = RETRY_DELAYS[retryCount] || RETRY_DELAYS[RETRY_DELAYS.length - 1];

            // Show toast notification to user
            this.showRetryToast(retryCount + 1, MAX_RETRIES);

            // Log retry attempt
            console.log(`Retrying request (attempt ${retryCount + 1}/${MAX_RETRIES}) after ${delay}ms:`, {
              url: config.url,
              method: config.method,
              status: error.response?.status,
              error: error.message,
            });

            // Wait before retrying
            await this.sleep(delay);

            // Retry the request
            return this.client.request(config);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Determine if a request should be retried
   */
  private shouldRetry(error: AxiosError): boolean {
    // Don't retry if no response (network error) - might be offline
    if (!error.response) {
      // Retry network errors (timeout, connection refused, etc.)
      return error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';
    }

    const status = error.response.status;

    // Retry on rate limit (429) and service unavailable (503)
    if (RETRYABLE_STATUS_CODES.includes(status)) {
      return true;
    }

    // Don't retry client errors (400, 401, 404, etc.)
    if (status >= 400 && status < 500) {
      return false;
    }

    // Retry server errors (500, 502, 504, etc.)
    if (status >= 500) {
      return true;
    }

    return false;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Show toast notification for retry attempts
   */
  private showRetryToast(attempt: number, maxAttempts: number): void {
    // TODO: Integrate with toast notification system when available
    // For now, just log to console in development
    if (import.meta.env.DEV) {
      console.info(`⏳ Retrying request (${attempt}/${maxAttempts})...`);
    }

    // In production, you would show a toast like:
    // toast.info(`Retrying request (${attempt}/${maxAttempts})...`, {
    //   duration: 2000,
    //   icon: '⏳',
    // });
  }

  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * GET request
   */
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<ApiResponse<T>>(url, config);
    
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Request failed');
    }

    return response.data.data as T;
  }

  /**
   * POST request
   */
  async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<ApiResponse<T>>(url, data, config);
    
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Request failed');
    }

    return response.data.data as T;
  }

  /**
   * PUT request
   */
  async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<ApiResponse<T>>(url, data, config);
    
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Request failed');
    }

    return response.data.data as T;
  }

  /**
   * PATCH request
   */
  async patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.patch<ApiResponse<T>>(url, data, config);
    
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Request failed');
    }

    return response.data.data as T;
  }

  /**
   * DELETE request
   */
  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<ApiResponse<T>>(url, config);
    
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Request failed');
    }

    return response.data.data as T;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
