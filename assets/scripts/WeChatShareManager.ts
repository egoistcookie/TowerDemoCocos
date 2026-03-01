import { _decorator, Component, sys } from 'cc';

const { ccclass } = _decorator;

/**
 * 微信小游戏转发管理器
 * 负责处理微信小游戏的转发功能
 */
@ccclass('WeChatShareManager')
export class WeChatShareManager {
    private static instance: WeChatShareManager | null = null;
    private isWeChatPlatform: boolean = false;
    private wx: any = null;

    private constructor() {
        // 检测是否在微信小游戏平台
        this.isWeChatPlatform = sys.platform === sys.Platform.WECHAT_GAME;
        
        if (this.isWeChatPlatform && typeof window !== 'undefined') {
            this.wx = (window as any).wx;
        }

        console.log('[WeChatShareManager] 初始化完成，平台:', sys.platform, '是否微信:', this.isWeChatPlatform);
    }

    /**
     * 获取单例实例
     */
    public static getInstance(): WeChatShareManager {
        if (!WeChatShareManager.instance) {
            WeChatShareManager.instance = new WeChatShareManager();
        }
        return WeChatShareManager.instance;
    }

    /**
     * 初始化转发功能
     * 显示转发菜单并设置转发监听
     */
    public initShare(): void {
        if (!this.isWeChatPlatform || !this.wx) {
            console.log('[WeChatShareManager] 非微信平台，跳过转发初始化');
            return;
        }

        // 显示转发菜单
        this.showShareMenu();

        // 监听用户点击右上角菜单的"转发"按钮
        this.onShareAppMessage();

        console.log('[WeChatShareManager] 转发功能初始化完成');
    }

    /**
     * 显示转发菜单
     * 支持转发给好友和分享到朋友圈
     */
    public showShareMenu(): void {
        if (!this.isWeChatPlatform || !this.wx) {
            return;
        }

        try {
            this.wx.showShareMenu({
                withShareTicket: true,
                menus: ['shareAppMessage', 'shareTimeline'],
                success: () => {
                    console.log('[WeChatShareManager] 转发菜单显示成功');
                },
                fail: (err: any) => {
                    console.error('[WeChatShareManager] 转发菜单显示失败:', err);
                }
            });
        } catch (error) {
            console.error('[WeChatShareManager] showShareMenu 异常:', error);
        }
    }

    /**
     * 隐藏转发菜单
     */
    public hideShareMenu(): void {
        if (!this.isWeChatPlatform || !this.wx) {
            return;
        }

        try {
            this.wx.hideShareMenu({
                success: () => {
                    console.log('[WeChatShareManager] 转发菜单隐藏成功');
                },
                fail: (err: any) => {
                    console.error('[WeChatShareManager] 转发菜单隐藏失败:', err);
                }
            });
        } catch (error) {
            console.error('[WeChatShareManager] hideShareMenu 异常:', error);
        }
    }

    /**
     * 监听用户点击右上角菜单的"转发"按钮
     * 被动转发
     */
    private onShareAppMessage(): void {
        if (!this.isWeChatPlatform || !this.wx) {
            return;
        }

        try {
            this.wx.onShareAppMessage(() => {
                console.log('[WeChatShareManager] 用户点击了转发按钮');
                
                // 返回自定义转发内容
                return {
                    title: '塔防游戏 - 快来一起守护水晶！',
                    imageUrl: '', // 可以设置转发图片的路径，留空则使用默认截图
                    query: '', // 可以携带参数，例如 'level=5&invite=123'
                };
            });

            console.log('[WeChatShareManager] 转发监听设置成功');
        } catch (error) {
            console.error('[WeChatShareManager] onShareAppMessage 异常:', error);
        }
    }

    /**
     * 主动分享
     * 可以在游戏内的按钮点击时调用
     * @param title 转发标题
     * @param imageUrl 转发图片路径（可选）
     * @param query 转发携带的参数（可选）
     */
    public shareAppMessage(title?: string, imageUrl?: string, query?: string): void {
        if (!this.isWeChatPlatform || !this.wx) {
            console.log('[WeChatShareManager] 非微信平台，无法主动分享');
            return;
        }

        try {
            this.wx.shareAppMessage({
                title: title || '塔防游戏 - 快来一起守护水晶！',
                imageUrl: imageUrl || '',
                query: query || '',
                success: () => {
                    console.log('[WeChatShareManager] 主动分享成功');
                },
                fail: (err: any) => {
                    console.error('[WeChatShareManager] 主动分享失败:', err);
                }
            });
        } catch (error) {
            console.error('[WeChatShareManager] shareAppMessage 异常:', error);
        }
    }

    /**
     * 分享到朋友圈
     * @param title 分享标题
     * @param imageUrl 分享图片路径（可选）
     * @param query 分享携带的参数（可选）
     */
    public shareTimeline(title?: string, imageUrl?: string, query?: string): void {
        if (!this.isWeChatPlatform || !this.wx) {
            console.log('[WeChatShareManager] 非微信平台，无法分享到朋友圈');
            return;
        }

        try {
            // 注意：分享到朋友圈需要基础库 2.11.3 及以上
            if (this.wx.shareToTimeline) {
                this.wx.shareToTimeline({
                    title: title || '塔防游戏 - 快来一起守护水晶！',
                    imageUrl: imageUrl || '',
                    query: query || '',
                    success: () => {
                        console.log('[WeChatShareManager] 分享到朋友圈成功');
                    },
                    fail: (err: any) => {
                        console.error('[WeChatShareManager] 分享到朋友圈失败:', err);
                    }
                });
            } else {
                console.warn('[WeChatShareManager] 当前微信版本不支持分享到朋友圈');
            }
        } catch (error) {
            console.error('[WeChatShareManager] shareTimeline 异常:', error);
        }
    }

    /**
     * 获取启动参数
     * 可以用来获取从转发卡片进入游戏时携带的参数
     */
    public getLaunchOptions(): any {
        if (!this.isWeChatPlatform || !this.wx) {
            return null;
        }

        try {
            const options = this.wx.getLaunchOptionsSync();
            console.log('[WeChatShareManager] 启动参数:', options);
            return options;
        } catch (error) {
            console.error('[WeChatShareManager] getLaunchOptions 异常:', error);
            return null;
        }
    }

    /**
     * 监听小游戏回到前台的事件
     * 可以用来处理从转发卡片返回的情况
     */
    public onShow(callback: (res: any) => void): void {
        if (!this.isWeChatPlatform || !this.wx) {
            return;
        }

        try {
            this.wx.onShow((res: any) => {
                console.log('[WeChatShareManager] 小游戏回到前台:', res);
                callback(res);
            });
        } catch (error) {
            console.error('[WeChatShareManager] onShow 异常:', error);
        }
    }
}
