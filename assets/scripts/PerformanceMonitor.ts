import { _decorator } from 'cc';
const { ccclass } = _decorator;

/**
 * 性能监控工具类
 * 用于统计方法耗时和输出性能日志
 */
export class PerformanceMonitor {
    private static methodTimings: Map<string, number[]> = new Map();
    private static methodCallCounts: Map<string, number> = new Map();
    private static readonly SLOW_METHOD_THRESHOLD = 5; // 慢方法阈值（毫秒）
    private static readonly LOG_INTERVAL = 5; // 每5秒输出一次统计信息
    private static logTimer: number = 0;

    /**
     * 获取当前时间（毫秒），兼容不同平台
     */
    private static getCurrentTime(): number {
        if (typeof performance !== 'undefined' && performance.now) {
            return performance.now();
        } else {
            return Date.now();
        }
    }

    /**
     * 开始计时
     * @param methodName 方法名称
     * @returns 计时器ID（用于结束计时）
     */
    static startTiming(methodName: string): number {
        return this.getCurrentTime();
    }

    /**
     * 结束计时并记录
     * @param methodName 方法名称
     * @param startTime 开始时间
     * @param logThreshold 日志阈值（毫秒），超过此值才记录日志
     */
    static endTiming(methodName: string, startTime: number, logThreshold: number = 0): void {
        const duration = this.getCurrentTime() - startTime;
        
        // 记录耗时
        if (!this.methodTimings.has(methodName)) {
            this.methodTimings.set(methodName, []);
        }
        const timings = this.methodTimings.get(methodName)!;
        timings.push(duration);
        
        // 只保留最近100次记录，避免内存泄漏
        if (timings.length > 100) {
            timings.shift();
        }
        
        // 记录调用次数
        const count = this.methodCallCounts.get(methodName) || 0;
        this.methodCallCounts.set(methodName, count + 1);
        
        // 如果超过阈值，输出警告日志
        if (duration > logThreshold && logThreshold > 0) {
            console.info(`[PerformanceMonitor] 慢方法警告: ${methodName} 耗时 ${duration.toFixed(2)}ms`);
        }
        
        // 如果超过慢方法阈值，输出警告
        if (duration > this.SLOW_METHOD_THRESHOLD) {
            console.info(`[PerformanceMonitor] ⚠️ 慢方法检测: ${methodName} 耗时 ${duration.toFixed(2)}ms (阈值: ${this.SLOW_METHOD_THRESHOLD}ms)`);
        }
    }

    /**
     * 包装方法，自动统计耗时
     * @param methodName 方法名称
     * @param method 要执行的方法
     * @param logThreshold 日志阈值（毫秒）
     */
    static wrapMethod<T extends (...args: any[]) => any>(
        methodName: string,
        method: T,
        logThreshold: number = 0
    ): T {
        return ((...args: any[]) => {
            const startTime = this.startTiming(methodName);
            try {
                const result = method.apply(this, args);
                // 如果是Promise，需要等待完成
                if (result && typeof result.then === 'function') {
                    return result.then(
                        (value: any) => {
                            this.endTiming(methodName, startTime, logThreshold);
                            return value;
                        },
                        (error: any) => {
                            this.endTiming(methodName, startTime, logThreshold);
                            throw error;
                        }
                    );
                } else {
                    this.endTiming(methodName, startTime, logThreshold);
                    return result;
                }
            } catch (error) {
                this.endTiming(methodName, startTime, logThreshold);
                throw error;
            }
        }) as T;
    }

    /**
     * 更新日志定时器（在update中调用）
     * @param deltaTime 时间增量
     */
    static update(deltaTime: number): void {
        this.logTimer += deltaTime;
        if (this.logTimer >= this.LOG_INTERVAL) {
            this.logTimer = 0;
            this.logStatistics();
        }
    }

    /**
     * 输出统计信息
     */
    static logStatistics(): void {
        console.info('========== 性能统计信息 ==========');
        
        // 按平均耗时排序
        const methodStats: Array<{ name: string; avg: number; max: number; min: number; count: number }> = [];
        
        for (const [methodName, timings] of this.methodTimings.entries()) {
            if (timings.length === 0) continue;
            
            const sum = timings.reduce((a, b) => a + b, 0);
            const avg = sum / timings.length;
            const max = Math.max(...timings);
            const min = Math.min(...timings);
            const count = this.methodCallCounts.get(methodName) || 0;
            
            methodStats.push({ name: methodName, avg, max, min, count });
        }
        
        // 按平均耗时降序排序
        methodStats.sort((a, b) => b.avg - a.avg);
        
        // 输出前20个最耗时的方法
        const topMethods = methodStats.slice(0, 20);
        console.info(`[PerformanceMonitor] 最耗时的方法（前20个）:`);
        topMethods.forEach((stat, index) => {
            const isSlow = stat.avg > this.SLOW_METHOD_THRESHOLD;
            const prefix = isSlow ? '⚠️' : '  ';
            console.info(`${prefix} ${index + 1}. ${stat.name}: 平均 ${stat.avg.toFixed(2)}ms, 最大 ${stat.max.toFixed(2)}ms, 最小 ${stat.min.toFixed(2)}ms, 调用 ${stat.count} 次`);
        });
        
        console.info('================================');
    }

    /**
     * 获取方法统计信息
     * @param methodName 方法名称
     */
    static getMethodStats(methodName: string): { avg: number; max: number; min: number; count: number } | null {
        const timings = this.methodTimings.get(methodName);
        if (!timings || timings.length === 0) {
            return null;
        }
        
        const sum = timings.reduce((a, b) => a + b, 0);
        const avg = sum / timings.length;
        const max = Math.max(...timings);
        const min = Math.min(...timings);
        const count = this.methodCallCounts.get(methodName) || 0;
        
        return { avg, max, min, count };
    }

    /**
     * 清除所有统计信息
     */
    static clear(): void {
        this.methodTimings.clear();
        this.methodCallCounts.clear();
        this.logTimer = 0;
    }
}
