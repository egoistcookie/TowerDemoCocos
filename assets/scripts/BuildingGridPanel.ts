import { _decorator, Component, Node, Vec3, Graphics, UITransform, Color, view, SpriteFrame } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 网格占用状态
 */
interface GridCell {
    occupied: boolean;
    buildingNode: Node | null;
}

@ccclass('BuildingGridPanel')
export class BuildingGridPanel extends Component {
    @property
    gridWidth: number = 4; // 网格宽度（默认4）

    @property
    gridHeight: number = 4; // 网格高度（默认4）

    @property
    cellSize: number = 100; // 格子大小（100x100）

    @property
    cellSpacing: number = 10; // 格子间隔（10）

    @property
    distanceFromBottom: number = 100; // 距离底部距离（100像素）

    @property(SpriteFrame)
    borderSpriteFrame: SpriteFrame = null!; // 边框贴图（可选，未来扩展）

    private gridGraphics: Graphics = null!; // 网格绘制组件
    private highlightGraphics: Graphics = null!; // 高亮绘制组件
    private gridCells: GridCell[][] = []; // 网格占用状态
    private isHighlighted: boolean = false; // 是否正在高亮显示
    private highlightedCell: { x: number; y: number } | null = null; // 当前高亮的网格
    private excludeBuildingForHighlight: Node | null = null; // 高亮时排除的建筑物（用于拖拽）

    start() {
        // 初始化网格占用状态
        this.initializeGrid();
        
        // 设置面板位置
        this.updatePanelPosition();
        
        // 创建网格绘制组件
        this.createGridGraphics();
        
        // 绘制网格
        this.drawGrid();
        
        // 确保网格面板默认可见
        this.node.active = true;
        
        if (this.gridGraphics && this.gridGraphics.node) {
            this.gridGraphics.node.active = true;
        }
        
        if (this.highlightGraphics && this.highlightGraphics.node) {
            this.highlightGraphics.node.active = true;
            this.highlightGraphics.enabled = true;
        }
    }

    /**
     * 显示网格面板
     */
    show() {
        this.node.active = true;
        
        if (this.gridGraphics && this.gridGraphics.node) {
            this.gridGraphics.node.active = true;
        }
        
        if (this.highlightGraphics && this.highlightGraphics.node) {
            // 确保高亮节点可见，以便在拖拽时能够显示高亮
            this.highlightGraphics.node.active = true;
            this.highlightGraphics.enabled = true;
        }
        
        // 重新绘制网格，确保可见
        if (this.gridGraphics) {
            this.drawGrid();
        }
    }

    /**
     * 隐藏网格面板
     */
    hide() {
        this.clearHighlight();
        // 可以选择完全隐藏或保持可见但清除高亮
        // this.node.active = false;
    }

    /**
     * 初始化网格占用状态
     */
    private initializeGrid() {
        this.gridCells = [];
        for (let y = 0; y < this.gridHeight; y++) {
            this.gridCells[y] = [];
            for (let x = 0; x < this.gridWidth; x++) {
                this.gridCells[y][x] = {
                    occupied: false,
                    buildingNode: null
                };
            }
        }
    }

    /**
     * 重置整个建筑网格（用于重新开始游戏）
     */
    public resetGrid() {
        // 完全重新初始化占用状态
        this.initializeGrid();
        // 清除高亮和绘制内容
        if (this.highlightGraphics) {
            this.highlightGraphics.clear();
        }
        if (this.gridGraphics) {
            this.gridGraphics.clear();
            this.drawGrid();
        }
        this.isHighlighted = false;
        this.highlightedCell = null;
        this.excludeBuildingForHighlight = null;
    }

    /**
     * 更新面板位置（距离底部100像素，水平居中）
     */
    private updatePanelPosition() {
        const visibleSize = view.getVisibleSize();
        const screenHeight = visibleSize.height;
        
        // 计算网格总尺寸
        const gridTotalWidth = (this.cellSize + this.cellSpacing) * this.gridWidth - this.cellSpacing;
        const gridTotalHeight = (this.cellSize + this.cellSpacing) * this.gridHeight - this.cellSpacing;
        
        // 设置面板位置：X居中，Y距离底部100像素
        const uiTransform = this.node.getComponent(UITransform);
        if (uiTransform) {
            uiTransform.setContentSize(gridTotalWidth, gridTotalHeight);
        }
        
        // 设置节点位置（相对于Canvas）
        // Y坐标：-screenHeight/2 + distanceFromBottom + gridTotalHeight/2
        const yPos = -screenHeight / 2 + this.distanceFromBottom + gridTotalHeight / 2;
        this.node.setPosition(0, yPos, 0);
    }

    /**
     * 创建网格绘制组件
     */
    private createGridGraphics() {
        // 确保节点有UITransform组件
        let nodeTransform = this.node.getComponent(UITransform);
        if (!nodeTransform) {
            nodeTransform = this.node.addComponent(UITransform);
        }
        
        const gridTotalWidth = (this.cellSize + this.cellSpacing) * this.gridWidth - this.cellSpacing;
        const gridTotalHeight = (this.cellSize + this.cellSpacing) * this.gridHeight - this.cellSpacing;
        
        // 创建网格绘制节点
        const gridNode = new Node('GridGraphics');
        gridNode.setParent(this.node);
        gridNode.setPosition(0, 0, 0);
        gridNode.active = true;
        
        const uiTransform = gridNode.addComponent(UITransform);
        uiTransform.setContentSize(gridTotalWidth, gridTotalHeight);
        
        this.gridGraphics = gridNode.addComponent(Graphics);
        this.gridGraphics.node.active = true;
        
        // 创建高亮绘制节点
        const highlightNode = new Node('HighlightGraphics');
        highlightNode.setParent(this.node);
        highlightNode.setPosition(0, 0, 0);
        highlightNode.active = true; // 初始设为可见，但内容为空
        
        // 确保高亮节点在网格节点之上（通过设置siblingIndex）
        const gridNodeIndex = gridNode.getSiblingIndex();
        highlightNode.setSiblingIndex(gridNodeIndex + 1);
        
        const highlightTransform = highlightNode.addComponent(UITransform);
        highlightTransform.setContentSize(gridTotalWidth, gridTotalHeight);
        
        this.highlightGraphics = highlightNode.addComponent(Graphics);
        this.highlightGraphics.node.active = true; // 改为可见，drawHighlight时会绘制
        this.highlightGraphics.enabled = true; // 确保组件启用
        
    }

    /**
     * 绘制网格
     */
    private drawGrid() {
        if (!this.gridGraphics) return;
        
        this.gridGraphics.clear();
        
        const gridTotalWidth = (this.cellSize + this.cellSpacing) * this.gridWidth - this.cellSpacing;
        const gridTotalHeight = (this.cellSize + this.cellSpacing) * this.gridHeight - this.cellSpacing;
        const startX = -gridTotalWidth / 2;
        const startY = -gridTotalHeight / 2;
        
        // 绘制网格线（改为完全透明，只保留高亮效果，视觉上类似石墙网格）
        this.gridGraphics.strokeColor = new Color(200, 200, 200, 0);
        this.gridGraphics.lineWidth = 2;
        
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
    }

    /**
     * 世界坐标转网格坐标
     */
    worldToGrid(worldPos: Vec3): { x: number; y: number } | null {
        // 将世界坐标转换为相对于网格面板节点的本地坐标
        const localPos = new Vec3();
        Vec3.subtract(localPos, worldPos, this.node.worldPosition);
        
        const gridTotalWidth = (this.cellSize + this.cellSpacing) * this.gridWidth - this.cellSpacing;
        const gridTotalHeight = (this.cellSize + this.cellSpacing) * this.gridHeight - this.cellSpacing;
        const startX = -gridTotalWidth / 2;
        const startY = -gridTotalHeight / 2;
        
        // 计算相对于面板的偏移
        const offsetX = localPos.x - startX;
        const offsetY = localPos.y - startY;
        
        // 计算网格坐标
        const gridX = Math.floor(offsetX / (this.cellSize + this.cellSpacing));
        const gridY = Math.floor(offsetY / (this.cellSize + this.cellSpacing));
        
        // 检查是否在网格范围内
        if (gridX < 0 || gridX >= this.gridWidth || gridY < 0 || gridY >= this.gridHeight) {
            return null;
        }
        
        return { x: gridX, y: gridY };
    }

    /**
     * 网格坐标转世界坐标（返回网格中心位置）
     */
    gridToWorld(gridX: number, gridY: number): Vec3 | null {
        if (gridX < 0 || gridX >= this.gridWidth || gridY < 0 || gridY >= this.gridHeight) {
            return null;
        }
        
        const gridTotalWidth = (this.cellSize + this.cellSpacing) * this.gridWidth - this.cellSpacing;
        const gridTotalHeight = (this.cellSize + this.cellSpacing) * this.gridHeight - this.cellSpacing;
        const startX = -gridTotalWidth / 2;
        const startY = -gridTotalHeight / 2;
        
        // 计算网格中心的本地坐标
        const localX = startX + gridX * (this.cellSize + this.cellSpacing) + this.cellSize / 2;
        const localY = startY + gridY * (this.cellSize + this.cellSpacing) + this.cellSize / 2;
        
        // 转换为世界坐标
        const localPos = new Vec3(localX, localY, 0);
        const worldPos = new Vec3();
        Vec3.add(worldPos, this.node.worldPosition, localPos);
        
        return worldPos;
    }

    /**
     * 检查位置是否在网格内
     */
    isPositionInGrid(worldPos: Vec3): boolean {
        const grid = this.worldToGrid(worldPos);
        return grid !== null;
    }

    /**
     * 获取最近的网格中心位置
     */
    getNearestGridCenter(worldPos: Vec3): Vec3 | null {
        const grid = this.worldToGrid(worldPos);
        if (!grid) {
            return null;
        }
        
        return this.gridToWorld(grid.x, grid.y);
    }

    /**
     * 检查网格是否被占用
     */
    isGridOccupied(gridX: number, gridY: number): boolean {
        if (gridX < 0 || gridX >= this.gridWidth || gridY < 0 || gridY >= this.gridHeight) {
            return true; // 超出范围视为已占用
        }
        
        const cell = this.gridCells[gridY][gridX];
        // 如果标记为占用但节点已失效/未激活，自动释放，防止僵尸占用
        if (cell.occupied) {
            const node = cell.buildingNode;
            if (!node || !node.isValid || !node.active) {
                cell.occupied = false;
                cell.buildingNode = null;
                return false;
            }

            // 额外保险：如果节点已经被移动到远离当前格子的位置，认为该格子不再被占用
            const center = this.gridToWorld(gridX, gridY);
            if (center) {
                const distance = Vec3.distance(center, node.worldPosition);
                // 距离大于一个格子的尺寸，说明不是这个格子里的建筑，清除占用
                if (distance > this.cellSize) {
                    cell.occupied = false;
                    cell.buildingNode = null;
                    return false;
                }
            }
        }
        return cell.occupied;
    }

    /**
     * 标记网格为已占用
     */
    occupyGrid(gridX: number, gridY: number, buildingNode: Node) {
        if (gridX < 0 || gridX >= this.gridWidth || gridY < 0 || gridY >= this.gridHeight) {
            return;
        }
        
        this.gridCells[gridY][gridX].occupied = true;
        this.gridCells[gridY][gridX].buildingNode = buildingNode;
    }

    /**
     * 取消标记网格占用
     */
    releaseGrid(gridX: number, gridY: number) {
        if (gridX < 0 || gridX >= this.gridWidth || gridY < 0 || gridY >= this.gridHeight) {
            return;
        }
        
        this.gridCells[gridY][gridX].occupied = false;
        this.gridCells[gridY][gridX].buildingNode = null;
    }

    /**
     * 高亮显示网格（拖拽时）
     * @param worldPos 世界坐标
     * @param excludeBuilding 排除的建筑物（用于拖拽时排除自己）
     */
    highlightGrid(worldPos: Vec3 | null, excludeBuilding?: Node | null) {
        
        if (!worldPos) {
            this.clearHighlight();
            return;
        }
        
        // 确保节点可见
        if (!this.node.active) {
            this.node.active = true;
        }
        
        // 确保高亮Graphics存在
        if (!this.highlightGraphics) {
            return;
        }
        
        const grid = this.worldToGrid(worldPos);
        
        if (!grid) {
            this.clearHighlight();
            return;
        }
        
        // 如果高亮的网格没有变化，且排除的建筑物也没有变化，不重复绘制
        if (this.highlightedCell && 
            this.highlightedCell.x === grid.x && 
            this.highlightedCell.y === grid.y &&
            this.excludeBuildingForHighlight === excludeBuilding) {
            return;
        }
        
        this.highlightedCell = grid;
        this.excludeBuildingForHighlight = excludeBuilding || null;
        this.isHighlighted = true;
        this.drawHighlight();
    }

    /**
     * 绘制高亮
     */
    private drawHighlight() {
        
        if (!this.highlightGraphics || !this.highlightedCell) {
            return;
        }
        
        // 确保节点和Graphics组件都可见
        if (!this.node.active) {
            this.node.active = true;
        }
        if (!this.highlightGraphics.node.active) {
            this.highlightGraphics.node.active = true;
        }
        
        // 确保Graphics组件已启用
        if (!this.highlightGraphics.enabled) {
            this.highlightGraphics.enabled = true;
        }
        
        this.highlightGraphics.clear();
        
        const gridTotalWidth = (this.cellSize + this.cellSpacing) * this.gridWidth - this.cellSpacing;
        const gridTotalHeight = (this.cellSize + this.cellSpacing) * this.gridHeight - this.cellSpacing;
        const startX = -gridTotalWidth / 2;
        const startY = -gridTotalHeight / 2;
        
        const gridX = this.highlightedCell.x;
        const gridY = this.highlightedCell.y;
        
        // 计算网格位置
        const cellX = startX + gridX * (this.cellSize + this.cellSpacing);
        const cellY = startY + gridY * (this.cellSize + this.cellSpacing);
        
        // 检查网格是否可用（排除指定的建筑物）
        const isAvailable = !this.isGridOccupiedByOther(gridX, gridY, this.excludeBuildingForHighlight || null!);

        // 绘制半透明填充（先绘制填充，再绘制边框，确保边框在最上层）
        const fillColor = isAvailable ? new Color(0, 255, 0, 150) : new Color(255, 0, 0, 150);
        this.highlightGraphics.fillColor = fillColor;
        this.highlightGraphics.rect(cellX, cellY, this.cellSize, this.cellSize);
        this.highlightGraphics.fill();

        // 绘制高亮边框（可用为绿色，不可用为红色）- 使用更粗的边框和更鲜艳的颜色
        const strokeColor = isAvailable ? new Color(0, 255, 0, 255) : new Color(255, 0, 0, 255);
        this.highlightGraphics.strokeColor = strokeColor;
        this.highlightGraphics.lineWidth = 8;
        this.highlightGraphics.rect(cellX, cellY, this.cellSize, this.cellSize);
        this.highlightGraphics.stroke();
        
    }

    /**
     * 清除高亮
     */
    clearHighlight() {
        
        if (this.highlightGraphics) {
            this.highlightGraphics.clear();
            
            // 验证是否真的清除了
            if (this.highlightGraphics && this.highlightGraphics['_paths'] && this.highlightGraphics['_paths'].length > 0) {
            } else {
            }
        } else {
        }
        
        this.isHighlighted = false;
        this.highlightedCell = null;
        this.excludeBuildingForHighlight = null;
    }

    /**
     * 获取建筑物占用的网格坐标
     */
    getBuildingGridPosition(buildingNode: Node): { x: number; y: number } | null {
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                if (this.gridCells[y][x].buildingNode === buildingNode) {
                    return { x, y };
                }
            }
        }
        return null;
    }

    /**
     * 查找最近的空网格
     */
    findNearestEmptyGrid(worldPos: Vec3): { x: number; y: number } | null {
        const grid = this.worldToGrid(worldPos);
        if (!grid) {
            return null;
        }
        
        // 如果当前位置可用，直接返回
        if (!this.isGridOccupied(grid.x, grid.y)) {
            return grid;
        }
        
        // 查找最近的空网格（BFS）
        const visited: boolean[][] = [];
        for (let y = 0; y < this.gridHeight; y++) {
            visited[y] = [];
            for (let x = 0; x < this.gridWidth; x++) {
                visited[y][x] = false;
            }
        }
        
        const queue: Array<{ x: number; y: number; distance: number }> = [{ x: grid.x, y: grid.y, distance: 0 }];
        visited[grid.y][grid.x] = true;
        
        const directions = [
            { dx: 0, dy: -1 }, // 上
            { dx: 0, dy: 1 },  // 下
            { dx: -1, dy: 0 }, // 左
            { dx: 1, dy: 0 }   // 右
        ];
        
        while (queue.length > 0) {
            const current = queue.shift()!;
            
            // 如果当前网格可用，返回
            if (!this.isGridOccupied(current.x, current.y)) {
                return { x: current.x, y: current.y };
            }
            
            // 检查相邻网格
            for (const dir of directions) {
                const nextX = current.x + dir.dx;
                const nextY = current.y + dir.dy;
                
                if (nextX >= 0 && nextX < this.gridWidth && 
                    nextY >= 0 && nextY < this.gridHeight && 
                    !visited[nextY][nextX]) {
                    visited[nextY][nextX] = true;
                    queue.push({ x: nextX, y: nextY, distance: current.distance + 1 });
                }
            }
        }
        
        // 如果找不到空网格，返回null
        return null;
    }

    /**
     * 交换两个建筑物的位置
     */
    swapBuildings(building1: Node, building2: Node): boolean {
        const grid1 = this.getBuildingGridPosition(building1);
        const grid2 = this.getBuildingGridPosition(building2);
        
        if (!grid1 || !grid2) {
            return false;
        }
        
        // 临时释放两个网格
        this.releaseGrid(grid1.x, grid1.y);
        this.releaseGrid(grid2.x, grid2.y);
        
        // 交换占用
        this.occupyGrid(grid2.x, grid2.y, building1);
        this.occupyGrid(grid1.x, grid1.y, building2);
        
        return true;
    }

    /**
     * 检查网格是否被指定建筑物占用（用于拖拽时排除自己）
     */
    isGridOccupiedByOther(gridX: number, gridY: number, excludeBuilding: Node): boolean {
        if (gridX < 0 || gridX >= this.gridWidth || gridY < 0 || gridY >= this.gridHeight) {
            return true;
        }
        
        const cell = this.gridCells[gridY][gridX];
        if (!cell.occupied) {
            return false;
        }
        
        // 如果被占用的建筑物是排除的建筑物，返回false（视为可用）
        if (cell.buildingNode === excludeBuilding) {
            return false;
        }
        
        return true;
    }

    /**
     * 获取指定网格位置的建筑物
     */
    getBuildingAtPosition(gridX: number, gridY: number): Node | null {
        if (gridX < 0 || gridX >= this.gridWidth || gridY < 0 || gridY >= this.gridHeight) {
            return null;
        }
        
        const cell = this.gridCells[gridY][gridX];
        return cell.buildingNode;
    }
}

