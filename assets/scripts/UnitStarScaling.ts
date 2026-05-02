/**
 * 兵营建筑星级 → 产出单位的攻血与体型（相对 1 星「原版」基准）
 * 2 星：攻血 ×1.2，贴图/模型 ×1.1
 * 3 星：攻血 ×1.5，贴图/模型 ×1.2
 */
export class UnitStarScaling {
    static getAttackMultiplier(star: number): number {
        const s = Math.max(1, Math.min(3, Math.floor(star)));
        if (s >= 3) return 1.5;
        if (s >= 2) return 1.2;
        return 1.0;
    }

    static getHealthMultiplier(star: number): number {
        return UnitStarScaling.getAttackMultiplier(star);
    }

    /** 仅作用于展示缩放（与 Role.defaultScale 相乘） */
    static getVisualScaleMultiplier(star: number): number {
        const s = Math.max(1, Math.min(3, Math.floor(star)));
        if (s >= 3) return 1.2;
        if (s >= 2) return 1.1;
        return 1.0;
    }
}
