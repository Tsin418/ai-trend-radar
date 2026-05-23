# 错误处理与重试机制

本文档详细说明 GitHub Trending Radar 的错误处理和重试策略，帮助开发者理解系统的容错设计。

## 目录

- [设计原则](#设计原则)
- [重试工具](#重试工具)
- [各模块实现](#各模块实现)
  - [GitHub Collector](#github-collector)
  - [Email Notifier](#email-notifier)
  - [WeChat Notifier](#wechat-notifier)
- [错误类型与处理策略](#错误类型与处理策略)
- [最佳实践](#最佳实践)
- [故障排查](#故障排查)

---

## 设计原则

### 1. 渐进式重试（Exponential Backoff）

使用指数退避策略，避免对外部服务造成压力：

```
第 1 次重试: 延迟 1s
第 2 次重试: 延迟 2s
第 3 次重试: 延迟 4s
```

### 2. 智能判断

只对临时性错误重试，永久性错误直接返回：

- ✅ **应该重试**：网络超时、服务不可用（5xx）、限流（429）
- ❌ **不应重试**：认证失败、配置错误、格式错误

### 3. 友好的错误消息

提供可操作的错误提示，而非技术术语：

```
❌ "ECONNREFUSED"
✅ "无法连接到 SMTP 服务器：请检查网络连接和 SMTP 配置"
```

### 4. 日志透明

重试时输出清晰的日志，便于调试：

```
[GitHub Collector] 重试 1/3（1000ms 后）: GitHub Trending 网络请求失败
[Email Notifier] 重试 2/3（4000ms 后）: SMTP 连接超时
```

---

## 重试工具

### 核心函数：`withRetry`

位置：`src/utils/retry.ts`

```typescript
import { withRetry, defaultShouldRetry } from '../utils/retry.js';

const result = await withRetry(
  async () => {
    // 你的操作
    return await fetch('https://api.example.com');
  },
  {
    maxRetries: 3,           // 最多重试 3 次
    initialDelay: 1000,      // 初始延迟 1s
    backoffMultiplier: 2,    // 每次延迟翻倍
    maxDelay: 30000,         // 最大延迟 30s
    shouldRetry: defaultShouldRetry,  // 重试判断逻辑
    onRetry: (error, attempt, delay) => {
      console.error(`重试 ${attempt}/${maxRetries}`);
    }
  }
);
```

### 配置选项

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `maxRetries` | number | 3 | 最大重试次数（不含首次尝试） |
| `initialDelay` | number | 1000 | 初始延迟（毫秒） |
| `backoffMultiplier` | number | 2 | 延迟倍数（指数退避） |
| `maxDelay` | number | 30000 | 最大延迟（毫秒） |
| `shouldRetry` | function | `() => true` | 判断是否应该重试 |
| `onRetry` | function | - | 重试前的回调（用于日志） |

### 内置判断函数

#### `isNetworkError(error)`

判断是否为网络错误：

```typescript
import { isNetworkError } from '../utils/retry.js';

if (isNetworkError(error)) {
  // 网络错误，应该重试
}
```

检测的错误类型：
- `network`
- `timeout`
- `ECONNREFUSED`
- `ENOTFOUND`
- `ETIMEDOUT`
- `ECONNRESET`
- `socket hang up`
- `fetch failed`
- `aborted`

#### `isRetryableHttpError(statusCode)`

判断 HTTP 状态码是否应该重试：

```typescript
import { isRetryableHttpError } from '../utils/retry.js';

if (isRetryableHttpError(429)) {
  // 429 Too Many Requests，应该重试
}
```

可重试的状态码：
- `429` - Too Many Requests（限流）
- `500` - Internal Server Error
- `502` - Bad Gateway
- `503` - Service Unavailable
- `504` - Gateway Timeout

#### `defaultShouldRetry(error)`

默认的重试判断逻辑，结合网络错误和 HTTP 错误：

```typescript
import { defaultShouldRetry } from '../utils/retry.js';

await withRetry(operation, {
  shouldRetry: defaultShouldRetry
});
```

---

## 各模块实现

### GitHub Collector

**位置**：`src/collectors/github.ts`

**重试配置**：

```typescript
{
  maxRetries: 3,
  initialDelay: 1000,
  shouldRetry: defaultShouldRetry
}
```

**处理的错误类型**：

1. **网络超时**
   ```
   错误：AbortError
   消息：GitHub Trending 请求超时（15000ms）
   重试：是
   ```

2. **网络请求失败**
   ```
   错误：fetch failed
   消息：GitHub Trending 网络请求失败，请检查网络连接
   重试：是
   ```

3. **HTTP 错误**
   ```
   错误：HTTP 429
   消息：GitHub Trending 请求失败: HTTP 429 (请求过于频繁，请稍后再试)
   重试：是
   ```

   ```
   错误：HTTP 503
   消息：GitHub Trending 请求失败: HTTP 503 (GitHub 服务暂时不可用)
   重试：是
   ```

**重试日志示例**：

```
[GitHub Collector] 重试 1/3（1000ms 后）: GitHub Trending 网络请求失败，请检查网络连接
[GitHub Collector] 重试 2/3（2000ms 后）: GitHub Trending 请求超时（15000ms）
```

---

### Email Notifier

**位置**：`src/notifiers/email.ts`

**重试配置**：

```typescript
{
  maxRetries: 3,
  initialDelay: 2000,  // 邮件发送延迟更长
  shouldRetry: (error) => {
    // 自定义 SMTP 错误判断
  }
}
```

**处理的错误类型**：

1. **配置缺失**（不重试）
   ```
   错误：缺少 SMTP_USER
   消息：缺少 SMTP 配置：请设置 SMTP_USER 和 SMTP_PASSWORD 环境变量
   重试：否
   跳过：是
   ```

2. **认证失败**（不重试）
   ```
   错误：Invalid login
   消息：SMTP 认证失败：请检查 SMTP_USER 和 SMTP_PASSWORD 是否正确
   重试：否
   ```

3. **连接失败**（重试）
   ```
   错误：ECONNREFUSED
   消息：无法连接到 SMTP 服务器 smtp.qq.com:465：请检查网络连接和 SMTP 配置
   重试：是
   ```

4. **超时**（重试）
   ```
   错误：timeout
   消息：SMTP 连接超时：请检查网络连接或稍后重试
   重试：是
   ```

5. **临时性 SMTP 错误**（重试）
   ```
   错误：421 Service not available
   消息：SMTP 临时错误 421
   重试：是
   ```

6. **收件人错误**（不重试）
   ```
   错误：550 User not found
   消息：邮件被拒绝：收件人地址可能无效或不存在
   重试：否
   ```

**重试日志示例**：

```
[Email Notifier] 重试 1/3（2000ms 后）: SMTP 连接超时：请检查网络连接或稍后重试
[Email Notifier] 重试 2/3（4000ms 后）: 无法连接到 SMTP 服务器 smtp.qq.com:465
```

---

### WeChat Notifier

**位置**：`src/notifiers/wechat.ts`

**重试配置**：

```typescript
{
  maxRetries: 3,
  initialDelay: 1500,
  shouldRetry: (error) => {
    // 检查网络错误和 HTTP 状态码
  }
}
```

**处理的错误类型**：

1. **配置缺失**（不重试）
   ```
   错误：缺少 WECHAT_TO
   消息：缺少微信接收方：请设置 WECHAT_TO 环境变量或通过 --wechat-to 参数指定
   重试：否
   跳过：是
   ```

2. **WeClaw 未启动**（不重试）
   ```
   错误：ECONNREFUSED
   消息：无法连接到 WeClaw 服务 (http://127.0.0.1:18011)：请确保 WeClaw 已启动（运行 'weclaw start'）
   重试：否
   ```

3. **WeClaw 未登录**（不重试）
   ```
   错误：not logged in
   消息：WeClaw 未登录：请运行 'weclaw login' 扫码登录微信
   重试：否
   ```

4. **网络超时**（重试）
   ```
   错误：timed out
   消息：WeClaw API 请求超时：请检查 WeClaw 服务状态
   重试：是
   ```

5. **服务错误**（重试）
   ```
   错误：HTTP 503
   消息：WeClaw API 错误: Service Unavailable (HTTP 503)
   重试：是
   ```

**重试日志示例**：

```
[WeChat Notifier] 重试 1/3（1500ms 后）: WeClaw API 请求超时：请检查 WeClaw 服务状态
[WeChat Notifier] 重试 2/3（3000ms 后）: WeClaw API 错误: Service Unavailable (HTTP 503)
```

---

## 错误类型与处理策略

### 快速参考表

| 错误类型 | 示例 | 是否重试 | 用户操作 |
|---------|------|---------|---------|
| **配置错误** | 缺少 SMTP_USER | ❌ | 检查环境变量配置 |
| **认证失败** | SMTP 认证失败 | ❌ | 检查用户名和密码 |
| **网络超时** | Request timeout | ✅ | 等待或检查网络 |
| **连接失败** | ECONNREFUSED | ✅ | 检查服务是否启动 |
| **服务不可用** | HTTP 503 | ✅ | 等待服务恢复 |
| **限流** | HTTP 429 | ✅ | 等待重试 |
| **格式错误** | Invalid email | ❌ | 修正配置格式 |

### 详细策略

#### 1. 网络相关错误（应重试）

**特征**：
- `ECONNREFUSED` - 连接被拒绝
- `ENOTFOUND` - 找不到主机
- `ETIMEDOUT` - 连接超时
- `ECONNRESET` - 连接重置
- `timeout` - 请求超时

**处理**：
- 使用指数退避重试
- 最多重试 3 次
- 如果持续失败，检查网络连接

#### 2. HTTP 临时错误（应重试）

**特征**：
- `429` - 请求过于频繁
- `500-504` - 服务器错误

**处理**：
- 使用指数退避重试
- 429 错误延迟更长（避免继续限流）
- 如果持续 5xx 错误，服务可能宕机

#### 3. 配置错误（不重试）

**特征**：
- 缺少必需的环境变量
- 配置格式错误
- 找不到配置文件

**处理**：
- 立即返回错误
- 提供明确的配置指导
- 标记为 `skipped: true`

#### 4. 认证错误（不重试）

**特征**：
- SMTP 认证失败
- 微信未登录
- API key 无效

**处理**：
- 立即返回错误
- 提示检查凭证
- 不浪费重试次数

---

## 最佳实践

### 1. 为新操作添加重试

如果你要添加新的外部 API 调用，使用 `withRetry` 包装：

```typescript
import { withRetry, defaultShouldRetry } from '../utils/retry.js';

async function fetchExternalApi() {
  return await withRetry(
    async () => {
      const response = await fetch('https://api.example.com/data');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    },
    {
      maxRetries: 3,
      shouldRetry: defaultShouldRetry,
      onRetry: (error, attempt, delay) => {
        console.error(`[External API] 重试 ${attempt}/3（${delay}ms 后）`);
      }
    }
  );
}
```

### 2. 自定义重试判断

对于特定场景，提供自定义的 `shouldRetry` 逻辑：

```typescript
await withRetry(
  async () => {
    // 你的操作
  },
  {
    shouldRetry: (error, attempt) => {
      // 只重试前 2 次
      if (attempt > 2) return false;

      // 只重试特定错误
      if (error instanceof CustomError) {
        return error.isRetryable;
      }

      return false;
    }
  }
);
```

### 3. 优雅降级

对于非关键操作，捕获错误并继续：

```typescript
try {
  await sendNotification();
} catch (error) {
  console.error('通知发送失败，但不影响主流程', error);
  // 继续执行
}
```

### 4. 监控和告警

在生产环境，记录重试次数和失败率：

```typescript
let retryCount = 0;

await withRetry(
  operation,
  {
    onRetry: (error, attempt) => {
      retryCount++;
      // 发送到监控系统
      monitoring.recordRetry('github-collector', attempt);
    }
  }
);

if (retryCount >= 2) {
  // 重试次数过多，可能有问题
  alerting.sendAlert('GitHub Collector 重试次数异常');
}
```

---

## 故障排查

### 问题：GitHub Trending 请求失败

**症状**：

```
GitHub Trending 请求失败: HTTP 503 (GitHub 服务暂时不可用)
[GitHub Collector] 重试 1/3（1000ms 后）
[GitHub Collector] 重试 2/3（2000ms 后）
[GitHub Collector] 重试 3/3（4000ms 后）
```

**原因**：
1. GitHub 服务暂时不可用（偶发）
2. 本地网络问题
3. 防火墙/代理拦截

**解决**：
1. 等待几分钟后重试
2. 检查 `https://github.com/trending` 是否可访问
3. 检查网络和代理配置
4. 查看 GitHub Status：https://www.githubstatus.com/

---

### 问题：SMTP 认证失败

**症状**：

```
SMTP 认证失败：请检查 SMTP_USER 和 SMTP_PASSWORD 是否正确
```

**原因**：
1. 密码错误
2. 使用了密码而非授权码
3. SMTP 服务器地址错误

**解决**：

1. **QQ 邮箱**：使用授权码，不是登录密码
   ```bash
   # 获取授权码：QQ 邮箱 → 设置 → 账户 → POP3/IMAP/SMTP → 生成授权码
   SMTP_PASSWORD=your_authorization_code
   ```

2. **Gmail**：使用应用专用密码
   ```bash
   # 获取应用密码：Google 账户 → 安全性 → 2 步验证 → 应用专用密码
   GMAIL_APP_PASSWORD=your_app_password
   ```

3. **检查配置**：
   ```bash
   # QQ 邮箱
   SMTP_HOST=smtp.qq.com
   SMTP_PORT=465
   SMTP_SECURE=true

   # Gmail
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_SECURE=true
   ```

---

### 问题：WeClaw 连接失败

**症状**：

```
无法连接到 WeClaw 服务 (http://127.0.0.1:18011)：请确保 WeClaw 已启动（运行 'weclaw start'）
```

**原因**：
1. WeClaw 未启动
2. 端口配置错误
3. WeClaw 服务异常

**解决**：

1. **启动 WeClaw**：
   ```bash
   weclaw start
   ```

2. **检查服务状态**：
   ```bash
   # 检查端口是否监听
   lsof -i :18011
   # 或
   netstat -an | grep 18011
   ```

3. **测试 API**：
   ```bash
   curl http://127.0.0.1:18011/api/ping
   ```

4. **检查配置**：
   ```bash
   # 确保配置正确
   WECLAW_API_URL=http://127.0.0.1:18011
   WECHAT_TO=filehelper@im.wechat
   ```

---

### 问题：重试次数过多

**症状**：

```
[GitHub Collector] 重试 1/3（1000ms 后）
[GitHub Collector] 重试 2/3（2000ms 后）
[GitHub Collector] 重试 3/3（4000ms 后）
GitHub Trending 请求失败: HTTP 503
```

**原因**：
1. 服务持续不可用
2. 本地网络问题
3. 限流（429 错误）

**解决**：

1. **检查服务状态**：
   - GitHub: https://www.githubstatus.com/
   - WeClaw: `weclaw status`

2. **调整重试参数**（临时）：
   ```typescript
   // 增加重试次数和延迟
   {
     maxRetries: 5,
     initialDelay: 2000,
     maxDelay: 60000
   }
   ```

3. **限流处理**：
   ```bash
   # 429 错误时，增加初始延迟
   initialDelay: 5000  // 5 秒
   ```

4. **网络诊断**：
   ```bash
   # 测试网络连接
   ping github.com
   curl -I https://github.com/trending

   # 测试 DNS
   nslookup github.com
   ```

---

## 监控建议

### 1. 关键指标

- **重试率**：每次运行的平均重试次数
- **失败率**：重试后仍失败的比例
- **响应时间**：包括重试延迟的总耗时

### 2. 日志记录

```typescript
// 记录关键信息
console.error(`[${moduleName}] 重试 ${attempt}/${maxRetries}（${delay}ms 后）: ${error.message}`);

// 最终失败时记录完整堆栈
if (finalFailure) {
  console.error(`[${moduleName}] 最终失败:`, error);
}
```

### 3. 告警规则

- 连续 3 次运行失败 → 发送告警
- 重试率 > 50% → 发送告警
- 平均响应时间 > 30s → 发送告警

---

## 总结

本项目的错误处理和重试机制遵循以下原则：

1. ✅ **智能重试** - 只对临时性错误重试
2. ✅ **指数退避** - 避免对服务造成压力
3. ✅ **友好提示** - 提供可操作的错误消息
4. ✅ **日志透明** - 记录重试过程便于调试
5. ✅ **优雅降级** - 非关键操作失败不影响主流程

**最佳实践**：
- 使用 `withRetry` 包装所有外部 API 调用
- 提供清晰的错误消息和解决方案
- 记录重试日志便于问题排查
- 监控重试率和失败率

**参考资料**：
- [重试工具源码](../src/utils/retry.ts)
- [GitHub Collector 实现](../src/collectors/github.ts)
- [Email Notifier 实现](../src/notifiers/email.ts)
- [WeChat Notifier 实现](../src/notifiers/wechat.ts)
