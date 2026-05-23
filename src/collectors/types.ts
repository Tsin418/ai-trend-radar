/**
 * 通用的数据源接口
 * 所有 Collector（GitHub、Product Hunt、Reddit 等）都实现此接口
 */

export interface Collector<T = TrendingItem> {
  /**
   * 数据源名称（如 'github', 'producthunt', 'reddit'）
   */
  readonly name: string;

  /**
   * 获取热门项目列表
   * @param limit 获取数量上限
   * @returns 热门项目数组
   */
  fetch(limit: number): Promise<T[]>;
}

/**
 * 通用的热门项目数据结构
 * 所有数据源统一到这个格式
 */
export interface TrendingItem {
  /** 排名 */
  rank: number;
  /** 唯一标识（如 owner/name） */
  id: string;
  /** 标题/名称 */
  title: string;
  /** 描述 */
  description: string;
  /** 链接 */
  url: string;
  /** 主要标签/语言 */
  primaryTag: string | null;
  /** 次要标签列表 */
  tags: string[];
  /** 热度指标（今日新增） */
  heatScore: number;
  /** 总热度（总星标/总赞等） */
  totalScore: number | null;
  /** 元数据（各数据源特有字段） */
  metadata: Record<string, unknown>;
}

/**
 * Collector 工厂函数类型
 */
export type CollectorFactory = () => Collector;
