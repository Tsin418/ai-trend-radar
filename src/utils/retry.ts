/**
 * 重试工具 - 指数退避策略
 */

export interface RetryOptions {
  /**
   * 最大重试次数（不包括首次尝试）
   * 默认：3
   */
  maxRetries?: number;

  /**
   * 初始延迟时间（毫秒）
   * 默认：1000ms (1s)
   */
  initialDelay?: number;

  /**
   * 延迟倍数（指数退避）
   * 默认：2（每次延迟翻倍）
   */
  backoffMultiplier?: number;

  /**
   * 最大延迟时间（毫秒）
   * 默认：30000ms (30s)
   */
  maxDelay?: number;

  /**
   * 是否应该重试（自定义判断逻辑）
   * 默认：所有错误都重试
   */
  shouldRetry?: (error: unknown, attempt: number) => boolean;

  /**
   * 重试前的回调
   * 可用于日志记录
   */
  onRetry?: (error: unknown, attempt: number, delay: number) => void;
}

/**
 * 带指数退避的重试包装器
 *
 * @example
 * ```ts
 * const result = await withRetry(
 *   async () => {
 *     const response = await fetch('https://api.example.com/data');
 *     if (!response.ok) throw new Error(`HTTP ${response.status}`);
 *     return response.json();
 *   },
 *   {
 *     maxRetries: 3,
 *     initialDelay: 1000,
 *     onRetry: (err, attempt, delay) => {
 *       console.log(`Retry ${attempt} after ${delay}ms: ${err}`);
 *     }
 *   }
 * );
 * ```
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    backoffMultiplier = 2,
    maxDelay = 30_000,
    shouldRetry = () => true,
    onRetry
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // 如果是最后一次尝试，或者不应该重试，则抛出错误
      if (attempt === maxRetries || !shouldRetry(error, attempt + 1)) {
        throw error;
      }

      // 计算延迟时间（指数退避）
      const delay = Math.min(
        initialDelay * Math.pow(backoffMultiplier, attempt),
        maxDelay
      );

      // 调用重试回调
      if (onRetry) {
        onRetry(error, attempt + 1, delay);
      }

      // 等待后重试
      await sleep(delay);
    }
  }

  // 理论上不会走到这里，但 TypeScript 需要
  throw lastError;
}

/**
 * 延迟工具函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 判断是否为网络错误（应该重试）
 */
export function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  const networkErrorPatterns = [
    'network',
    'timeout',
    'econnrefused',
    'enotfound',
    'etimedout',
    'econnreset',
    'socket hang up',
    'fetch failed',
    'aborted'
  ];

  return networkErrorPatterns.some((pattern) => message.includes(pattern));
}

/**
 * 判断是否为临时性 HTTP 错误（应该重试）
 */
export function isRetryableHttpError(statusCode: number): boolean {
  // 429 Too Many Requests
  // 500 Internal Server Error
  // 502 Bad Gateway
  // 503 Service Unavailable
  // 504 Gateway Timeout
  return statusCode === 429 || (statusCode >= 500 && statusCode < 600);
}

/**
 * 默认的重试判断逻辑
 * 网络错误和临时性 HTTP 错误都会重试
 */
export function defaultShouldRetry(error: unknown): boolean {
  // 网络错误
  if (isNetworkError(error)) {
    return true;
  }

  // HTTP 错误（检查错误消息中的状态码）
  if (error instanceof Error) {
    const httpStatusMatch = error.message.match(/HTTP (\d{3})/);
    if (httpStatusMatch) {
      const statusCode = Number.parseInt(httpStatusMatch[1], 10);
      return isRetryableHttpError(statusCode);
    }
  }

  // 其他错误不重试
  return false;
}
