import { Component } from 'cc';

const HIDER_KEY = '__transientHbHide';

/** 受击后头顶血条展示时长（秒），到期由回调销毁节点 */
export const TRANSIENT_HEALTH_BAR_SEC = 3;

/** 消耗蓝量后头顶蓝条展示时长（秒），到期仅隐藏节点（不销毁，便于复用） */
export const TRANSIENT_MANA_BAR_SEC = 2;

const MANA_HIDER_KEY = '__transientMbHide';

export function cancelTransientManaBarHide(host: Component): void {
    const fn = (host as any)[MANA_HIDER_KEY] as (() => void) | undefined;
    if (fn) {
        host.unschedule(fn);
        (host as any)[MANA_HIDER_KEY] = undefined;
    }
}

export function scheduleTransientManaBarHide(host: Component, onExpire: () => void): void {
    cancelTransientManaBarHide(host);
    const wrap = () => {
        (host as any)[MANA_HIDER_KEY] = undefined;
        onExpire();
    };
    (host as any)[MANA_HIDER_KEY] = wrap;
    host.scheduleOnce(wrap, TRANSIENT_MANA_BAR_SEC);
}

export function cancelTransientHealthBarHide(host: Component): void {
    const fn = (host as any)[HIDER_KEY] as (() => void) | undefined;
    if (fn) {
        host.unschedule(fn);
        (host as any)[HIDER_KEY] = undefined;
    }
}

/** 取消上一计时后重新 schedule；onExpire 中应销毁血条并清空引用 */
export function scheduleTransientHealthBarHide(host: Component, onExpire: () => void): void {
    cancelTransientHealthBarHide(host);
    const wrap = () => {
        (host as any)[HIDER_KEY] = undefined;
        onExpire();
    };
    (host as any)[HIDER_KEY] = wrap;
    host.scheduleOnce(wrap, TRANSIENT_HEALTH_BAR_SEC);
}
