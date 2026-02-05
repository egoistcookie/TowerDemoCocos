import { _decorator, Component, Node, Vec3, Graphics, UITransform, Color, view, SpriteFrame, Prefab, instantiate, find, assetManager } from 'cc';
import { Tree } from './role/Tree';
const { ccclass, property } = _decorator;

interface GridCell {
    occupied: boolean;
    treeNode: Node | null;
}

@ccclass('ForestGridPanel')
export class ForestGridPanel extends Component {
    @property
    gridWidth: number = 6; // 网格宽度（默认6格，对应300像素）

    @property
    gridHeight: number = 4; // 网格高度（默认4格，对应200像素）

    @property
    cellSize: number = 50; // 格子大小（50x50）

    @property
    cellSpacing: number = 0; // 格子间距

    @property
    distanceFromBottom: number = 20; // 距离底部的像素距离

    @property
    alignRight: boolean = false; // 是否放在右下角（默认左下角）

    @property(SpriteFrame)
    borderSpriteFrame: SpriteFrame = null!; // 边框贴图（可选）

    @property(Prefab)
    treePrefab: Prefab = null!; // 树木预制体（从分包 prefabs_sub 动态加载）

    private gridGraphics: Graphics = null!;
    private gridCells: GridCell[][] = [];
    private static sharedTreePrefab: Prefab | null = null;
    private static treePrefabLoaded: boolean = false;
    private static isLoadingTreePrefab: boolean = false;

    onLoad() {
        this.initializeGrid();
    }

    start() {
        this.initializeGrid();
        this.updatePanelPosition();
        this.createGridGraphics();
        this.drawGrid();

        // 默认始终可见
        this.node.active = true;
        if (this.gridGraphics && this.gridGraphics.node) {
            this.gridGraphics.node.active = true;
        }

        // 在每个网格中心种一棵树（从分包中懒加载 Tree 预制体）
        this.loadTreePrefabAndSpawn();
    }

    private initializeGrid() {
        this.gridCells = [];
        for (let y = 0; y < this.gridHeight; y++) {
            this.gridCells[y] = [];
            for (let x = 0; x < this.gridWidth; x++) {
                this.gridCells[y][x] = {
                    occupied: false,
                    treeNode: null
                };
            }
        }
    }

    /**
     * 更新面板位置：放在屏幕下方左右两角
     */
    private updatePanelPosition() {
        const visibleSize = view.getVisibleSize();
        const screenWidth = visibleSize.width;
        const screenHeight = visibleSize.height;

        const gridTotalWidth = (this.cellSize + this.cellSpacing) * this.gridWidth - this.cellSpacing;
        const gridTotalHeight = (this.cellSize + this.cellSpacing) * this.gridHeight - this.cellSpacing;

        // 确保节点有 UITransform
        let uiTransform = this.node.getComponent(UITransform);
        if (!uiTransform) {
            uiTransform = this.node.addComponent(UITransform);
        }
        uiTransform.setContentSize(gridTotalWidth, gridTotalHeight);

        // 保证是 Canvas 的子节点
        const canvas = find('Canvas');
        if (canvas && this.node.parent !== canvas) {
            this.node.setParent(canvas);
        }

        // Canvas 原点在中心
        const halfWidth = screenWidth / 2;
        const halfHeight = screenHeight / 2;

        const marginX = 20;
        const marginY = this.distanceFromBottom;

        const x = this.alignRight
            ? (halfWidth - gridTotalWidth / 2 - marginX)
            : (-halfWidth + gridTotalWidth / 2 + marginX);
        const y = -halfHeight + gridTotalHeight / 2 + marginY;

        this.node.setPosition(x, y, 0);
    }

    private createGridGraphics() {
        const gridNode = new Node('ForestGridGraphics');
        gridNode.setParent(this.node);
        gridNode.setPosition(0, 0, 0);

        const uiTransform = gridNode.addComponent(UITransform);
        const gridTotalWidth = (this.cellSize + this.cellSpacing) * this.gridWidth - this.cellSpacing;
        const gridTotalHeight = (this.cellSize + this.cellSpacing) * this.gridHeight - this.cellSpacing;
        uiTransform.setContentSize(gridTotalWidth, gridTotalHeight);

        this.gridGraphics = gridNode.addComponent(Graphics);
        this.gridGraphics.node.active = true;
    }

    private drawGrid() {
        if (!this.gridGraphics) return;

        this.gridGraphics.clear();

        const gridTotalWidth = (this.cellSize + this.cellSpacing) * this.gridWidth - this.cellSpacing;
        const gridTotalHeight = (this.cellSize + this.cellSpacing) * this.gridHeight - this.cellSpacing;
        const startX = -gridTotalWidth / 2;
        const startY = -gridTotalHeight / 2;

        // 使用淡绿色线条，突出树林区域
        this.gridGraphics.strokeColor = new Color(80, 180, 80, 200);
        this.gridGraphics.lineWidth = 1;

        // 绘制垂直线
        for (let x = 0; x <= this.gridWidth; x++) {
            const xPos = startX + x * (this.cellSize + this.cellSpacing);
            this.gridGraphics.moveTo(xPos, startY);
            this.gridGraphics.lineTo(xPos, startY + gridTotalHeight);
            this.gridGraphics.stroke();
        }

        // 绘制水平线
        for (let y = 0; y <= this.gridHeight; y++) {
            const yPos = startY + y * (this.cellSize + this.cellSpacing);
            this.gridGraphics.moveTo(startX, yPos);
            this.gridGraphics.lineTo(startX + gridTotalWidth, yPos);
            this.gridGraphics.stroke();
        }

        // 绘制外框，稍微加粗
        this.gridGraphics.lineWidth = 2;
        this.gridGraphics.strokeColor = new Color(60, 140, 60, 255);
        this.gridGraphics.rect(startX, startY, gridTotalWidth, gridTotalHeight);
        this.gridGraphics.stroke();
    }

    /**
     * 世界坐标转网格坐标
     */
    worldToGrid(worldPos: Vec3): { x: number; y: number } | null {
        const localPos = new Vec3();
        Vec3.subtract(localPos, worldPos, this.node.worldPosition);

        const gridTotalWidth = (this.cellSize + this.cellSpacing) * this.gridWidth - this.cellSpacing;
        const gridTotalHeight = (this.cellSize + this.cellSpacing) * this.gridHeight - this.cellSpacing;
        const startX = -gridTotalWidth / 2;
        const startY = -gridTotalHeight / 2;

        const offsetX = localPos.x - startX;
        const offsetY = localPos.y - startY;

        const gridX = Math.floor(offsetX / (this.cellSize + this.cellSpacing));
        const gridY = Math.floor(offsetY / (this.cellSize + this.cellSpacing));

        if (gridX < 0 || gridX >= this.gridWidth || gridY < 0 || gridY >= this.gridHeight) {
            return null;
        }

        return { x: gridX, y: gridY };
    }

    /**
     * 网格坐标转世界坐标（返回网格中心）
     */
    gridToWorld(gridX: number, gridY: number): Vec3 | null {
        if (gridX < 0 || gridX >= this.gridWidth || gridY < 0 || gridY >= this.gridHeight) {
            return null;
        }

        const gridTotalWidth = (this.cellSize + this.cellSpacing) * this.gridWidth - this.cellSpacing;
        const gridTotalHeight = (this.cellSize + this.cellSpacing) * this.gridHeight - this.cellSpacing;
        const startX = -gridTotalWidth / 2;
        const startY = -gridTotalHeight / 2;

        const localX = startX + gridX * (this.cellSize + this.cellSpacing) + this.cellSize / 2;
        const localY = startY + gridY * (this.cellSize + this.cellSpacing) + this.cellSize / 2;

        const localPos = new Vec3(localX, localY, 0);
        const worldPos = new Vec3();
        Vec3.add(worldPos, this.node.worldPosition, localPos);

        return worldPos;
    }

    isGridOccupied(gridX: number, gridY: number): boolean {
        if (gridX < 0 || gridX >= this.gridWidth || gridY < 0 || gridY >= this.gridHeight) {
            return true;
        }
        return this.gridCells[gridY][gridX].occupied;
    }

    occupyGrid(gridX: number, gridY: number, treeNode: Node) {
        if (gridX < 0 || gridX >= this.gridWidth || gridY < 0 || gridY >= this.gridHeight) {
            return;
        }
        const cell = this.gridCells[gridY][gridX];
        cell.occupied = true;
        cell.treeNode = treeNode;
    }

    releaseGrid(gridX: number, gridY: number) {
        if (gridX < 0 || gridX >= this.gridWidth || gridY < 0 || gridY >= this.gridHeight) {
            return;
        }
        const cell = this.gridCells[gridY][gridX];
        cell.occupied = false;
        cell.treeNode = null;
    }

    /**
     * 懒加载 Tree 预制体（从分包 prefabs_sub），加载完成后在每个网格中心种树
     */
    private loadTreePrefabAndSpawn() {
        // 已经有共享预制体
        if (ForestGridPanel.treePrefabLoaded && ForestGridPanel.sharedTreePrefab) {
            this.treePrefab = ForestGridPanel.sharedTreePrefab;
            this.spawnInitialTrees();
            return;
        }

        // 正在加载中，稍后再尝试
        if (ForestGridPanel.isLoadingTreePrefab) {
            this.scheduleOnce(() => {
                this.loadTreePrefabAndSpawn();
            }, 0.2);
            return;
        }

        // 开始加载
        ForestGridPanel.isLoadingTreePrefab = true;

        assetManager.loadBundle('prefabs_sub', (err, bundle) => {
            if (err || !bundle) {
                console.error('[ForestGridPanel] 加载分包 prefabs_sub 失败，无法加载 Tree 预制体:', err);
                ForestGridPanel.isLoadingTreePrefab = false;
                return;
            }

            bundle.load('Tree', Prefab, (err2, prefab) => {
                ForestGridPanel.isLoadingTreePrefab = false;
                if (err2 || !prefab) {
                    console.error('[ForestGridPanel] 从分包 prefabs_sub 加载 Tree 预制体失败:', err2);
                    return;
                }

                console.info('[ForestGridPanel] 从分包 prefabs_sub 成功加载 Tree 预制体');
                ForestGridPanel.sharedTreePrefab = prefab as Prefab;
                ForestGridPanel.treePrefabLoaded = true;

                this.treePrefab = ForestGridPanel.sharedTreePrefab;
                this.spawnInitialTrees();
            });
        });
    }

    /**
     * 在每个网格中心种植一棵树（必须已有 treePrefab）
     */
    private spawnInitialTrees() {
        if (!this.treePrefab) {
            console.warn('[ForestGridPanel] spawnInitialTrees 调用时 treePrefab 为空，跳过种树');
            return;
        }
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                if (this.isGridOccupied(x, y)) {
                    continue;
                }
                const center = this.gridToWorld(x, y);
                if (!center) {
                    continue;
                }

                const treeNode = instantiate(this.treePrefab);

                treeNode.setParent(this.node);
                treeNode.setWorldPosition(center);

                let treeScript = treeNode.getComponent(Tree);
                if (!treeScript) {
                    treeScript = treeNode.addComponent(Tree);
                }

                this.occupyGrid(x, y, treeNode);
            }
        }
    }
}

