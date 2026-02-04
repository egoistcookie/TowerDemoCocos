import { _decorator, Component, Node, Vec3, Graphics, UITransform, Color, view, SpriteFrame, find, EventTouch, Camera } from 'cc';
import { GameState } from './GameState';
import { GridBuildingSelectionPanel } from './GridBuildingSelectionPanel';
import { UnitSelectionManager } from './UnitSelectionManager';
const { ccclass, property } = _decorator;

/**
 * 网格占用状态
 */
interface GridCell {
    occupied: boolean;
    buildingNode: Node | null;
}

@ccclass('StoneWallGridPanel')
export class StoneWallGridPanel extends Component {
    @property
    gridWidth: number = 15; // 网格宽度（15格）

    @property
    gridHeight: number = 10; // 网格高度（10格）

    @property
    cellSize: number = 50; // 格子大小（50x50）

    @property
    cellSpacing: number = 0; // 格子间隔（0）

    @property(SpriteFrame)
    borderSpriteFrame: SpriteFrame = null!; // 边框贴图（可选，未来扩展）

    private gridGraphics: Graphics = null!; // 网格绘制组件
    private highlightGraphics: Graphics = null!; // 高亮绘制组件
    private gridCells: GridCell[][] = []; // 网格占用状态
    private isHighlighted: boolean = false; // 是否正在高亮显示
    private highlightedCell: { x: number; y: number } | null = null; // 当前高亮的网格
    private excludeBuildingForHighlight: Node | null = null; // 高亮时排除的建筑物（用于拖拽）
    private showGridBorder: boolean = false; // 是否显示网格边框（默认不显示）
    private selectionPanel: GridBuildingSelectionPanel = null!; // 选择面板组件

    onLoad() {
        // 确保网格在任何生命周期调用前初始化
        this.initializeGrid();
    }

    start() {
        // 初始化网格占用状态
        this.initializeGrid();
        
        // 设置面板位置
        this.updatePanelPosition();
        
        // 创建网格绘制组件
        this.createGridGraphics();
        
        // 默认不绘制网格（边框透明）
        this.showGridBorder = false;
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
        
        // 初始化选择面板
        this.initSelectionPanel();
        
        // 添加点击事件监听
        this.setupClickHandler();
    }
    
    /**
     * 初始化选择面板
     */
    private initSelectionPanel() {
        // 查找或创建选择面板节点
        let panelNode = find('Canvas/GridBuildingSelectionPanel');
        if (!panelNode) {
            panelNode = new Node('GridBuildingSelectionPanel');
            const canvas = find('Canvas');
            if (canvas) {
                panelNode.setParent(canvas);
            }
            this.selectionPanel = panelNode.addComponent(GridBuildingSelectionPanel);
        } else {
            this.selectionPanel = panelNode.getComponent(GridBuildingSelectionPanel);
            if (!this.selectionPanel) {
                this.selectionPanel = panelNode.addComponent(GridBuildingSelectionPanel);
            }
        }
    }
    
    /**
     * 设置点击事件处理器
     */
    private setupClickHandler() {
        // 在Canvas上添加点击事件监听
        const canvas = find('Canvas');
        if (canvas) {
            canvas.on(Node.EventType.TOUCH_END, this.onGridClick, this);
        }
    }
    
    /**
     * 网格点击事件
     */
    private onGridClick(event: EventTouch) {
        // 1. 如果当前不在游戏进行中（例如主页、结算页、暂停/弹窗期间），不允许弹出选择框
        const gmNode = find('Canvas/GameManager') || find('GameManager');
        const gameManager = gmNode ? (gmNode.getComponent('GameManager') as any) : null;
        if (gameManager && gameManager.getGameState) {
            const state = gameManager.getGameState();
            if (state !== GameState.Playing) {
                if (this.selectionPanel) {
                    this.selectionPanel.hide();
                }
                return;
            }
        }

        // 2. 如果有全屏弹窗/遮罩（结算页、提示框、单位介绍等），不允许弹出选择框
        const canvas = find('Canvas');
        if (canvas) {
            // GamePopup 遮罩
            const popupMask = canvas.getChildByName('GamePopupMask');
            if (popupMask && popupMask.active) {
                if (this.selectionPanel) {
                    this.selectionPanel.hide();
                }
                return;
            }

            // 单位介绍遮罩
            const unitIntroMask = canvas.getChildByName('UnitIntroMask');
            if (unitIntroMask && unitIntroMask.active) {
                if (this.selectionPanel) {
                    this.selectionPanel.hide();
                }
                return;
            }

            // 结算弹窗（GameOverDialog）
            const gameOverDialog = canvas.getChildByName('GameOverDialog');
            if (gameOverDialog && gameOverDialog.active) {
                if (this.selectionPanel) {
                    this.selectionPanel.hide();
                }
                return;
            }
        }

        // 检查是否有选中单位，如果有则不显示选择框
        const unitSelectionManagerNode = find('Canvas/UnitSelectionManager');
        if (unitSelectionManagerNode) {
            const unitSelectionManager = unitSelectionManagerNode.getComponent(UnitSelectionManager);
            if (unitSelectionManager) {
                const selectedUnit = unitSelectionManager.getCurrentSelectedUnit();
                // 检查是否有选中单位（单选或多选）
                if (selectedUnit) {
                    // 有选中单位，不显示选择框
                    if (this.selectionPanel) {
                        this.selectionPanel.hide();
                    }
                    return;
                }
                // 检查多选单位（通过检查currentSelectedUnits属性）
                const selectedUnits = (unitSelectionManager as any).currentSelectedUnits;
                if (selectedUnits && selectedUnits.length > 0) {
                    // 有选中单位，不显示选择框
                    if (this.selectionPanel) {
                        this.selectionPanel.hide();
                    }
                    return;
                }
            }
        }
        
        // 获取触摸位置
        const touchLocation = event.getLocation();
        
        // 查找Camera节点
        const cameraNode = find('Canvas/Camera');
        if (!cameraNode) {
            return;
        }
        
        const camera = cameraNode.getComponent(Camera);
        if (!camera) {
            return;
        }
        
        // 将屏幕坐标转换为世界坐标
        const screenPos = new Vec3(touchLocation.x, touchLocation.y, 0);
        const worldPos = new Vec3();
        camera.screenToWorld(screenPos, worldPos);
        worldPos.z = 0;
        
        // 检查点击位置是否在网格内
        if (!this.isPositionInGrid(worldPos)) {
            // 点击不在网格内，关闭选择面板
            if (this.selectionPanel) {
                this.selectionPanel.hide();
            }
            return;
        }
        
        // 转换为网格坐标
        const grid = this.worldToGrid(worldPos);
        if (!grid) {
            return;
        }
        
        // 检查网格是否被占用（石墙只占用一个网格，哨塔占用两个网格）
        // 对于点击的网格，如果被占用则不显示选择面板
        if (this.isGridOccupied(grid.x, grid.y)) {
            // 网格已被占用，不显示选择面板
            if (this.selectionPanel) {
                this.selectionPanel.hide();
            }
            return;
        }
        
        // 检查第二个网格是否被占用（哨塔需要两个网格）
        // 如果第二个网格被占用，仍然可以显示选择面板，但只能选择石墙
        // 这个检查在选择面板中处理，这里只检查第一个网格
        
        // 获取网格中心位置
        const gridCenter = this.gridToWorld(grid.x, grid.y);
        if (!gridCenter) {
            return;
        }
        
        // 显示选择面板
        if (this.selectionPanel) {
            console.info('[StoneWallGridPanel] 显示选择面板，网格坐标:', grid.x, grid.y, '世界坐标:', gridCenter);
            this.selectionPanel.show(grid.x, grid.y, gridCenter);
        } else {
            console.warn('[StoneWallGridPanel] 选择面板未初始化');
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
     * 重置整个石墙网格（用于重新开始游戏）
     */
    public resetGrid() {
        // 重新初始化占用状态
        this.initializeGrid();

        // 清除高亮和绘制
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
     * 更新面板位置（固定位置：x:0-750，y:500-1000）
     */
    private updatePanelPosition() {
        // 计算网格总尺寸
        const gridTotalWidth = (this.cellSize + this.cellSpacing) * this.gridWidth - this.cellSpacing;
        const gridTotalHeight = (this.cellSize + this.cellSpacing) * this.gridHeight - this.cellSpacing;
        
        // 设置面板尺寸
        let uiTransform = this.node.getComponent(UITransform);
        if (!uiTransform) {
            uiTransform = this.node.addComponent(UITransform);
        }
        uiTransform.setContentSize(gridTotalWidth, gridTotalHeight);
        
        // 确保节点是Canvas的子节点
        const canvas = find('Canvas');
        if (canvas) {
            this.node.setParent(canvas);
        }
        
        // 设置节点位置（相对于Canvas）
        // Canvas的原点在中心，x轴向右，y轴向上
        // 屏幕坐标的原点在左上角，x轴向右，y轴向下
        // 目标：网格左下角在屏幕坐标(0, 500)，右上角在(750, 1000)
        
        // 获取Canvas的尺寸
        const canvasTransform = canvas?.getComponent(UITransform);
        const canvasWidth = canvasTransform?.width || 750;
        const canvasHeight = canvasTransform?.height || 1334;
        const canvasCenterX = canvasWidth / 2;
        const canvasCenterY = canvasHeight / 2;
        
        // 计算面板节点的位置
        // 网格的总尺寸是750x500
        // 用户期望的网格位置：屏幕坐标x:0-750，y:500-1000
        // 屏幕坐标转换为Canvas坐标（相对于Canvas中心）：
        // Canvas中心屏幕坐标：(375, 667)
        // 网格左下角屏幕坐标：(0, 500)
        // 网格左下角Canvas坐标：
        // x = 0 - canvasCenterX = -375
        // y = canvasCenterY - 500 = 667 - 500 = 167
        // 节点位置需要将网格整体居中，所以：
        // xPos = -375 + gridTotalWidth / 2 = -375 + 375 = 0
        // yPos = 167 - gridTotalHeight / 2 = 167 - 250 = -83
        // 但这个计算结果导致网格偏下，需要调整yPos
        // 调整后：
        const xPos = 0;
        // 让网格中心在屏幕坐标y=500处
        const yPos = - canvasCenterY + 750;
        
        
        // 设置节点位置
        this.node.setPosition(xPos, yPos, 0);
    }

    /**
     * 创建网格绘制组件
     */
    private createGridGraphics() {
        // 创建网格绘制节点
        const gridGraphicsNode = new Node('GridGraphics');
        gridGraphicsNode.setParent(this.node);
        gridGraphicsNode.setPosition(0, 0, 0);
        
        this.gridGraphics = gridGraphicsNode.addComponent(Graphics);
        this.gridGraphics.lineWidth = 1;
        this.gridGraphics.strokeColor = new Color(200, 200, 200, 255);
        
        // 创建高亮绘制节点
        const highlightGraphicsNode = new Node('HighlightGraphics');
        highlightGraphicsNode.setParent(this.node);
        highlightGraphicsNode.setPosition(0, 0, 0);
        
        this.highlightGraphics = highlightGraphicsNode.addComponent(Graphics);
        this.highlightGraphics.lineWidth = 2;
    }

    /**
     * 绘制网格
     */
    private drawGrid() {
        if (!this.gridGraphics) {
            return;
        }
        
        // 清空之前的绘制
        this.gridGraphics.clear();
        
        // 如果不需要显示边框，直接返回（不绘制任何内容）
        if (!this.showGridBorder) {
            return;
        }
        
        // 计算网格总尺寸
        const gridTotalWidth = (this.cellSize + this.cellSpacing) * this.gridWidth - this.cellSpacing;
        const gridTotalHeight = (this.cellSize + this.cellSpacing) * this.gridHeight - this.cellSpacing;
        
        // 计算起始位置
        const startX = -gridTotalWidth / 2;
        const startY = -gridTotalHeight / 2;
        
        // 绘制网格线
        this.gridGraphics.lineWidth = 1;
        this.gridGraphics.strokeColor = new Color(200, 200, 200, 255);
        
        // 绘制垂直线
        for (let x = 0; x <= this.gridWidth; x++) {
            const posX = startX + x * (this.cellSize + this.cellSpacing);
            this.gridGraphics.moveTo(posX, startY);
            this.gridGraphics.lineTo(posX, startY + gridTotalHeight);
        }
        
        // 绘制水平线
        for (let y = 0; y <= this.gridHeight; y++) {
            const posY = startY + y * (this.cellSize + this.cellSpacing);
            this.gridGraphics.moveTo(startX, posY);
            this.gridGraphics.lineTo(startX + gridTotalWidth, posY);
        }
        
        // 绘制网格边框
        this.gridGraphics.lineWidth = 2;
        this.gridGraphics.strokeColor = new Color(150, 150, 150, 255);
        this.gridGraphics.rect(startX, startY, gridTotalWidth, gridTotalHeight);
        
        // 执行绘制
        this.gridGraphics.stroke();
    }

    /**
     * 世界坐标转网格坐标（完全按照BuildingGridPanel的逻辑）
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
     * 网格坐标转世界坐标（返回网格中心位置，完全按照BuildingGridPanel的逻辑）
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
        const localY = gridY * (this.cellSize + this.cellSpacing) + this.cellSize / 2;

        const wordX = this.node.worldPosition.x + localX;
        
        const wordY = 500 + localY;
        
        // 转换为世界坐标
        //const localPos = new Vec3(localX, localY, 0);
        const worldPos = new Vec3(wordX, wordY, 0);
        //Vec3.add(worldPos, this.node.worldPosition, localPos);
        
        return worldPos;
    }

    /**
     * 高亮显示网格（拖拽时，完全按照BuildingGridPanel的逻辑）
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
        
        // 显示网格边框（拖动时显示）
        this.showGridBorder = true;
        this.drawGrid();
        
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
        }
        
        // 隐藏网格边框（拖动结束时隐藏）
        this.showGridBorder = false;
        this.drawGrid();
        
        this.isHighlighted = false;
        this.highlightedCell = null;
        this.excludeBuildingForHighlight = null;
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
     * 防御式检查：确保网格数组已初始化
     */
    private ensureGridInitialized() {
        if (!this.gridCells || this.gridCells.length !== this.gridHeight) {
            this.initializeGrid();
        }
    }

    /**
     * 检查网格是否被占用
     * 判断网格中是否存在石墙节点，并且石墙节点的状态是存活
     */
    isGridOccupied(gridX: number, gridY: number): boolean {
        if (gridX < 0 || gridX >= this.gridWidth || gridY < 0 || gridY >= this.gridHeight) {
            return false;
        }
        this.ensureGridInitialized();
        const cell = this.gridCells[gridY][gridX];
        
        // 如果标记为未占用，直接返回false
        if (!cell.occupied) {
            return false;
        }
        
        // 如果标记为占用，检查石墙节点是否存在且存活
        if (cell.buildingNode) {
            // 检查节点是否有效
            if (!cell.buildingNode.isValid || !cell.buildingNode.active) {
                // 节点无效，更新占用状态
                cell.occupied = false;
                cell.buildingNode = null;
                return false;
            }
            
            // 检查石墙是否存活
            const stoneWallScript = cell.buildingNode.getComponent('StoneWall') as any;
            if (stoneWallScript) {
                // 检查石墙是否存活（通过isAlive方法）
                if (stoneWallScript.isAlive && !stoneWallScript.isAlive()) {
                    // 石墙已死亡，更新占用状态
                    cell.occupied = false;
                    cell.buildingNode = null;
                    return false;
                }
                // 石墙存活，返回true
                return true;
            } else {
                // 没有石墙脚本，可能是其他类型的建筑物，保持占用状态
                return true;
            }
        } else {
            // 没有建筑物节点，但标记为占用，更新状态
            cell.occupied = false;
            return false;
        }
    }

    /**
     * 检查网格是否被其他建筑物占用（排除指定建筑物）
     * 判断网格中是否存在石墙节点，并且石墙节点的状态是存活，且不是排除的建筑物
     */
    isGridOccupiedByOther(gridX: number, gridY: number, excludeBuilding: Node): boolean {
        if (gridX < 0 || gridX >= this.gridWidth || gridY < 0 || gridY >= this.gridHeight) {
            return false;
        }
        this.ensureGridInitialized();
        const cell = this.gridCells[gridY][gridX];
        
        // 如果标记为未占用，直接返回false
        if (!cell.occupied) {
            return false;
        }
        
        // 如果标记为占用，检查石墙节点是否存在且存活
        if (cell.buildingNode) {
            // 如果是排除的建筑物，返回false
            if (cell.buildingNode === excludeBuilding) {
                return false;
            }
            
            // 检查节点是否有效
            if (!cell.buildingNode.isValid || !cell.buildingNode.active) {
                // 节点无效，更新占用状态
                cell.occupied = false;
                cell.buildingNode = null;
                return false;
            }
            
            // 检查石墙是否存活
            const stoneWallScript = cell.buildingNode.getComponent('StoneWall') as any;
            if (stoneWallScript) {
                // 检查石墙是否存活（通过isAlive方法）
                if (stoneWallScript.isAlive && !stoneWallScript.isAlive()) {
                    // 石墙已死亡，更新占用状态
                    cell.occupied = false;
                    cell.buildingNode = null;
                    return false;
                }
                // 石墙存活，返回true
                return true;
            } else {
                // 没有石墙脚本，可能是其他类型的建筑物，保持占用状态
                return true;
            }
        } else {
            // 没有建筑物节点，但标记为占用，更新状态
            cell.occupied = false;
            return false;
        }
    }

    /**
     * 占用网格
     */
    occupyGrid(gridX: number, gridY: number, buildingNode: Node): boolean {
        if (gridX < 0 || gridX >= this.gridWidth || gridY < 0 || gridY >= this.gridHeight) {
            return false;
        }
        this.ensureGridInitialized();
        const cell = this.gridCells[gridY][gridX];
        if (cell.occupied) {
            return false;
        }
        
        cell.occupied = true;
        cell.buildingNode = buildingNode;
        return true;
    }

    /**
     * 释放网格
     */
    releaseGrid(gridX: number, gridY: number): boolean {
        if (gridX < 0 || gridX >= this.gridWidth || gridY < 0 || gridY >= this.gridHeight) {
            return false;
        }
        this.ensureGridInitialized();
        const cell = this.gridCells[gridY][gridX];
        cell.occupied = false;
        cell.buildingNode = null;
        return true;
    }

    /**
     * 获取建筑物占用的网格坐标
     */
    getBuildingGridPosition(buildingNode: Node): { x: number; y: number } | null {
        this.ensureGridInitialized();
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
     * 获取指定网格位置的建筑物
     */
    getBuildingAtPosition(gridX: number, gridY: number): Node | null {
        if (gridX < 0 || gridX >= this.gridWidth || gridY < 0 || gridY >= this.gridHeight) {
            return null;
        }
        this.ensureGridInitialized();
        const cell = this.gridCells[gridY][gridX];
        return cell.buildingNode;
    }
}