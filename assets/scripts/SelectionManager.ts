import { _decorator, Component, Node, Vec3, Graphics, UITransform, EventTouch, find, Camera, input, Input } from 'cc';
import { Arrower } from './Arrower';
import { Wisp } from './Wisp';
const { ccclass, property } = _decorator;

@ccclass('SelectionManager')
export class SelectionManager extends Component {
    @property(Node)
    canvas: Node = null!; // Canvas节点

    @property(Node)
    towerBuilderNode: Node = null!; // TowerBuilder节点（可选，如果未设置则自动查找）

    private selectionBox: Node = null!; // 选择框节点
    private selectionGraphics: Graphics = null!; // 选择框Graphics组件
    private isSelecting: boolean = false; // 是否正在选择
    private startPos: Vec3 = new Vec3(); // 拖拽起始位置（世界坐标）
    private currentPos: Vec3 = new Vec3(); // 当前鼠标位置（世界坐标）
    private selectedTowers: Arrower[] = []; // 选中的防御单位数组
    private selectedWisps: Wisp[] = []; // 选中的小精灵数组
    private camera: Camera = null!; // 相机引用
    private globalTouchHandler: ((event: EventTouch) => void) | null = null!; // 全局触摸事件处理器

    start() {
        // 查找Canvas
        if (!this.canvas) {
            this.canvas = find('Canvas');
        }
        if (!this.canvas) {
            console.error('SelectionManager: Canvas not found!');
            return;
        }

        // 查找Camera
        const cameraNode = find('Canvas/Camera') || this.node.scene?.getChildByName('Camera');
        if (cameraNode) {
            this.camera = cameraNode.getComponent(Camera);
        }
        if (!this.camera) {
            console.error('SelectionManager: Camera not found!');
            return;
        }

        // 查找TowerBuilder节点（如果未设置）
        if (!this.towerBuilderNode) {
            this.towerBuilderNode = find('TowerBuilder');
            // 如果直接查找失败，尝试从场景中递归查找
            if (!this.towerBuilderNode && this.node.scene) {
                const findNodeRecursive = (node: Node, name: string): Node | null => {
                    if (node.name === name) {
                        return node;
                    }
                    for (const child of node.children) {
                        const found = findNodeRecursive(child, name);
                        if (found) return found;
                    }
                    return null;
                };
                this.towerBuilderNode = findNodeRecursive(this.node.scene, 'TowerBuilder');
            }
            if (this.towerBuilderNode) {
                console.log('SelectionManager: Found TowerBuilder node:', this.towerBuilderNode.name);
            } else {
                console.warn('SelectionManager: TowerBuilder node not found! Please set towerBuilderNode property in editor.');
            }
        }

        // 创建选择框节点
        this.createSelectionBox();

        // 监听触摸事件
        this.setupTouchEvents();
    }

    onDestroy() {
        // 移除触摸事件监听
        try {
            this.removeTouchEvents();
        } catch (error) {
            console.warn('SelectionManager: Error removing touch events:', error);
        }
        
        // 清理选择框节点
        if (this.selectionBox && this.selectionBox.isValid) {
            this.selectionBox.destroy();
            this.selectionBox = null!;
        }
        
        // 清除选中状态
        this.clearSelection();
    }

    /**
     * 创建选择框节点
     */
    createSelectionBox() {
        this.selectionBox = new Node('SelectionBox');
        this.selectionBox.setParent(this.canvas);
        
        // 添加UITransform
        const uiTransform = this.selectionBox.addComponent(UITransform);
        uiTransform.setContentSize(2000, 2000); // 设置足够大的内容区域

        // 添加Graphics组件用于绘制选择框
        this.selectionGraphics = this.selectionBox.addComponent(Graphics);
        this.selectionBox.active = false; // 初始隐藏
    }

    /**
     * 设置触摸事件监听
     */
    setupTouchEvents() {
        if (!this.canvas) return;

        // 监听触摸开始（不使用 capture 阶段，避免干扰其他系统）
        this.canvas.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        // 监听触摸移动
        this.canvas.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        // 监听触摸结束（不使用 capture 阶段，避免干扰建造系统）
        this.canvas.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    }

    /**
     * 移除触摸事件监听
     */
    removeTouchEvents() {
        if (!this.canvas) return;

        this.canvas.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.canvas.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.canvas.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);

        // 移除全局点击监听
        if (this.globalTouchHandler) {
            this.canvas.off(Node.EventType.TOUCH_END, this.globalTouchHandler, this);
            this.globalTouchHandler = null!;
        }
    }

    /**
     * 触摸开始
     */
    onTouchStart(event: EventTouch) {
        // 优先检查是否在建造模式下（如果是，完全不处理，让建造系统处理）
        const buildingMode = this.isBuildingMode();
        
        if (buildingMode) {
            // 如果正在选择，清除选择状态
            if (this.isSelecting) {
                this.isSelecting = false;
                if (this.selectionBox && this.selectionBox.isValid) {
                    this.selectionBox.active = false;
                }
                this.clearSelection();
            }
            return; // 建造模式下，不处理多选
        }

        // 检查是否点击在UI元素上（如按钮、选择面板等）
        const targetNode = event.target as Node;
        if (this.isUIElement(targetNode)) {
            return; // 点击在UI上，不处理选择
        }

        // 检查是否点击在防御单位或小精灵上（如果是，不触发多选，让单位的点击事件处理）
        if (this.isTowerNode(targetNode) || this.isWispNode(targetNode)) {
            return; // 点击在防御单位或小精灵上，不处理多选
        }

        // 获取触摸位置（世界坐标）
        const touchLocation = event.getLocation();
        const worldPos = this.screenToWorld(touchLocation);
        
        this.startPos = worldPos.clone();
        this.currentPos = worldPos.clone();
        this.isSelecting = true;

        console.log('SelectionManager.onTouchStart: Start selecting at', this.startPos);

        // 显示选择框
        if (this.selectionBox && this.selectionBox.isValid) {
            this.selectionBox.active = true;
            this.selectionBox.setWorldPosition(this.startPos);
        }

        // 如果之前没有选中的单位，清除之前的选择
        // 如果有选中的单位，保留选择（等待拖拽或点击来决定是重新选择还是移动）
        if (this.selectedTowers.length === 0 && this.selectedWisps.length === 0) {
            this.clearSelection();
        }
    }

    /**
     * 触摸移动
     */
    onTouchMove(event: EventTouch) {
        // 优先检查是否在建造模式下（如果是，完全不处理）
        if (this.isBuildingMode()) {
            // 如果正在选择，清除选择状态
            if (this.isSelecting) {
                this.isSelecting = false;
                if (this.selectionBox && this.selectionBox.isValid) {
                    this.selectionBox.active = false;
                }
                this.clearSelection();
            }
            return;
        }

        if (!this.isSelecting) return;

        // 获取当前触摸位置（世界坐标）
        const touchLocation = event.getLocation();
        this.currentPos = this.screenToWorld(touchLocation);

        // 如果之前有选中的单位，检测到拖拽时清除之前的选择（开始新的选择）
        if (this.selectedTowers.length > 0) {
            const dragDistance = Vec3.distance(this.startPos, this.currentPos);
            if (dragDistance > 5) { // 检测到拖拽（移动超过5像素）
                console.log('SelectionManager.onTouchMove: Detected drag, clearing previous selection');
                this.clearSelection();
            }
        }

        // 更新选择框
        this.updateSelectionBox();

        // 更新选中的防御单位
        this.updateSelectedTowers();
        
        console.log('SelectionManager.onTouchMove: Current pos', this.currentPos, 'Selected towers:', this.selectedTowers.length);
    }

    /**
     * 触摸结束
     */
    onTouchEnd(event: EventTouch) {
        // 优先检查是否在建造模式下（如果是，完全不处理，让建造系统处理）
        const buildingMode = this.isBuildingMode();
        
        if (buildingMode) {
            // 如果正在选择，清除选择状态
            if (this.isSelecting) {
                this.isSelecting = false;
                if (this.selectionBox && this.selectionBox.isValid) {
                    this.selectionBox.active = false;
                }
                this.clearSelection();
            }
            // 不阻止事件传播，让TowerBuilder可以处理
            return;
        }

        if (!this.isSelecting) return;

        // 检查是否点击在防御单位或小精灵上（如果是，不处理多选）
        const targetNode = event.target as Node;
        if (this.isTowerNode(targetNode) || this.isWispNode(targetNode)) {
            // 点击在防御单位或小精灵上，清除选择状态但不注册移动命令
            this.isSelecting = false;
            if (this.selectionBox && this.selectionBox.isValid) {
                this.selectionBox.active = false;
            }
            this.clearSelection();
            return;
        }

        this.isSelecting = false;

        // 隐藏选择框
        if (this.selectionBox && this.selectionBox.isValid) {
            this.selectionBox.active = false;
        }

        // 最后更新一次选中的防御单位（确保拖拽结束时也更新）
        // 检查是否有足够的拖动距离（避免点击被误判为拖动）
        const dragDistance = Vec3.distance(this.startPos, this.currentPos);
        console.log('SelectionManager.onTouchEnd: Drag distance:', dragDistance.toFixed(2), 'Start:', this.startPos, 'End:', this.currentPos);
        
        // 记录拖拽开始前是否有选中的单位（包括防御单位和小精灵）
        const hadPreviousSelection = this.selectedTowers.length > 0 || this.selectedWisps.length > 0;
        
        if (dragDistance > 10) { // 至少拖动10像素才认为是有效的选择
            console.log('SelectionManager.onTouchEnd: Updating selected towers...');
            this.updateSelectedTowers();
            console.log('SelectionManager.onTouchEnd: After update, selected towers count:', this.selectedTowers.length);
        } else {
            // 拖动距离太小，可能是误触或点击
            if (!hadPreviousSelection) {
                // 如果之前没有选中的单位，清除选择状态
                console.log('SelectionManager.onTouchEnd: Drag distance too small, clearing selection');
                this.clearSelection();
            } else {
                // 如果之前有选中的单位，且是点击（不是拖拽），执行移动命令
                console.log('SelectionManager.onTouchEnd: Click detected with previous selection, moving units');
                const touchLocation = event.getLocation();
                const worldPos = this.screenToWorld(touchLocation);
                
                // 计算分散位置（包括防御单位和小精灵）
                const allUnits: any[] = [...this.selectedTowers, ...this.selectedWisps];
                const formationPositions = this.calculateFormationPositions(worldPos, allUnits);
                
                // 让所有选中的防御单位移动到各自的分散位置
                for (let i = 0; i < this.selectedTowers.length; i++) {
                    const tower = this.selectedTowers[i];
                    if (tower && tower.node && tower.node.isValid && i < formationPositions.length) {
                        tower.setManualMoveTargetPosition(formationPositions[i]);
                    }
                }
                
                // 让所有选中的小精灵移动到各自的分散位置
                for (let i = 0; i < this.selectedWisps.length; i++) {
                    const wisp = this.selectedWisps[i];
                    if (wisp && wisp.node && wisp.node.isValid && this.selectedTowers.length + i < formationPositions.length) {
                        wisp.setManualMoveTargetPosition(formationPositions[this.selectedTowers.length + i]);
                    }
                }
                
                // 不清除选择，保留高亮状态
                return; // 处理完移动命令后返回
            }
        }

        // 如果有选中的防御单位或小精灵，注册点击移动监听
        if (this.selectedTowers.length > 0 || this.selectedWisps.length > 0) {
            console.log('SelectionManager.onTouchEnd: Registering move command for', this.selectedTowers.length, 'towers and', this.selectedWisps.length, 'wisps');
            this.registerMoveCommand();
        } else {
            // 如果没有选中任何单位，清除选择状态
            console.log('SelectionManager.onTouchEnd: No units selected, clearing selection');
            this.clearSelection();
        }
    }

    /**
     * 更新选择框显示
     */
    updateSelectionBox() {
        if (!this.selectionGraphics) return;

        // 计算选择框的位置和大小
        const minX = Math.min(this.startPos.x, this.currentPos.x);
        const maxX = Math.max(this.startPos.x, this.currentPos.x);
        const minY = Math.min(this.startPos.y, this.currentPos.y);
        const maxY = Math.max(this.startPos.y, this.currentPos.y);

        const width = maxX - minX;
        const height = maxY - minY;
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        // 设置选择框位置
        this.selectionBox.setWorldPosition(new Vec3(centerX, centerY, 0));

        // 清除并重新绘制选择框
        this.selectionGraphics.clear();
        
        // 绘制半透明填充
        this.selectionGraphics.fillColor.set(100, 150, 255, 100); // 半透明蓝色
        this.selectionGraphics.rect(-width / 2, -height / 2, width, height);
        this.selectionGraphics.fill();

        // 绘制边框
        this.selectionGraphics.strokeColor.set(100, 150, 255, 255); // 蓝色边框
        this.selectionGraphics.lineWidth = 2;
        this.selectionGraphics.rect(-width / 2, -height / 2, width, height);
        this.selectionGraphics.stroke();
    }

    /**
     * 更新选中的防御单位
     */
    updateSelectedTowers() {
        // 计算选择框范围
        const minX = Math.min(this.startPos.x, this.currentPos.x);
        const maxX = Math.max(this.startPos.x, this.currentPos.x);
        const minY = Math.min(this.startPos.y, this.currentPos.y);
        const maxY = Math.max(this.startPos.y, this.currentPos.y);

        console.log('SelectionManager.updateSelectedTowers: Selection box range:', {
            minX: minX.toFixed(2),
            maxX: maxX.toFixed(2),
            minY: minY.toFixed(2),
            maxY: maxY.toFixed(2),
            width: (maxX - minX).toFixed(2),
            height: (maxY - minY).toFixed(2)
        });

        // 查找所有防御单位
        let towersNode = find('Towers');
        // 如果直接查找失败，尝试递归查找
        if (!towersNode) {
            const findNodeRecursive = (node: Node, name: string): Node | null => {
                if (node.name === name) {
                    return node;
                }
                for (const child of node.children) {
                    const found = findNodeRecursive(child, name);
                    if (found) return found;
                }
                return null;
            };
            const scene = this.node.scene;
            if (scene) {
                towersNode = findNodeRecursive(scene, 'Towers');
            }
        }
        if (!towersNode) {
            console.log('SelectionManager.updateSelectedTowers: Towers node not found!');
            return;
        }

        const towers = towersNode.children || [];
        console.log('SelectionManager.updateSelectedTowers: Found', towers.length, 'tower nodes');

        const newSelectedTowers: Arrower[] = [];

        for (const towerNode of towers) {
            if (!towerNode || !towerNode.isValid || !towerNode.active) {
                console.log('SelectionManager.updateSelectedTowers: Skipping invalid/inactive tower:', towerNode?.name);
                continue;
            }

            const towerScript = towerNode.getComponent(Arrower) as Arrower;
            if (!towerScript) {
                console.log('SelectionManager.updateSelectedTowers: Arrower script not found for:', towerNode.name);
                continue;
            }
            
            if (!towerScript.isAlive || !towerScript.isAlive()) {
                console.log('SelectionManager.updateSelectedTowers: Arrower is not alive:', towerNode.name);
                continue;
            }

            // 检查防御单位是否在选择框范围内
            const towerPos = towerNode.worldPosition;
            const inRangeX = towerPos.x >= minX && towerPos.x <= maxX;
            const inRangeY = towerPos.y >= minY && towerPos.y <= maxY;
            const inRange = inRangeX && inRangeY;
            
            console.log('SelectionManager.updateSelectedTowers: Arrower', towerNode.name, 'at', towerPos, 
                'inRangeX:', inRangeX, 'inRangeY:', inRangeY, 'inRange:', inRange);
            
            if (inRange) {
                newSelectedTowers.push(towerScript);
                console.log('SelectionManager.updateSelectedTowers: Added tower to selection:', towerNode.name);
            }
        }

        // 查找小精灵
        let wispsNode = find('Wisps');
        if (!wispsNode && this.node.scene) {
            const findNodeRecursive = (node: Node, name: string): Node | null => {
                if (node.name === name) {
                    return node;
                }
                for (const child of node.children) {
                    const found = findNodeRecursive(child, name);
                    if (found) return found;
                }
                return null;
            };
            wispsNode = findNodeRecursive(this.node.scene, 'Wisps');
        }
        
        const newSelectedWisps: Wisp[] = [];
        if (wispsNode) {
            const wisps = wispsNode.children || [];
            for (const wispNode of wisps) {
                if (!wispNode || !wispNode.isValid || !wispNode.active) {
                    continue;
                }

                const wispScript = wispNode.getComponent(Wisp) as Wisp;
                if (!wispScript) {
                    continue;
                }
                
                if (!wispScript.isAlive || !wispScript.isAlive()) {
                    continue;
                }

                // 检查小精灵是否在选择框范围内
                const wispPos = wispNode.worldPosition;
                const inRangeX = wispPos.x >= minX && wispPos.x <= maxX;
                const inRangeY = wispPos.y >= minY && wispPos.y <= maxY;
                const inRange = inRangeX && inRangeY;
                
                if (inRange) {
                    newSelectedWisps.push(wispScript);
                }
            }
        }

        console.log('SelectionManager.updateSelectedTowers: Found', newSelectedTowers.length, 'towers and', newSelectedWisps.length, 'wisps in selection box');

        // 更新选中状态
        this.setSelectedTowers(newSelectedTowers);
        this.setSelectedWisps(newSelectedWisps);
    }

    /**
     * 设置选中的小精灵
     */
    setSelectedWisps(wisps: Wisp[]) {
        // 取消之前选中的高亮
        for (const wisp of this.selectedWisps) {
            if (wisp && wisp.node && wisp.node.isValid) {
                wisp.setHighlight(false);
            }
        }

        // 设置新的选中
        this.selectedWisps = wisps;

        // 高亮显示选中的小精灵
        for (const wisp of this.selectedWisps) {
            if (wisp && wisp.node && wisp.node.isValid) {
                wisp.setHighlight(true);
            }
        }
    }

    /**
     * 设置选中的防御单位
     */
    setSelectedTowers(towers: Arrower[]) {
        console.log('SelectionManager.setSelectedTowers: Setting', towers.length, 'towers as selected');
        
        // 取消之前选中的高亮
        for (const tower of this.selectedTowers) {
            if (tower && tower.node && tower.node.isValid) {
                tower.setHighlight(false);
            }
        }

        // 设置新的选中
        this.selectedTowers = towers;

        // 高亮显示选中的防御单位
        let highlightedCount = 0;
        for (const tower of this.selectedTowers) {
            if (tower && tower.node && tower.node.isValid) {
                tower.setHighlight(true);
                highlightedCount++;
                console.log('SelectionManager.setSelectedTowers: Highlighted tower:', tower.node.name, 'at', tower.node.worldPosition);
            } else {
                console.log('SelectionManager.setSelectedTowers: Skipping invalid tower:', tower?.node?.name);
            }
        }
        
        console.log('SelectionManager.setSelectedTowers: Highlighted', highlightedCount, 'out of', this.selectedTowers.length, 'towers');
    }

    /**
     * 清除选择
     */
    clearSelection() {
        // 只在非建造模式下输出日志，避免建造模式下的日志干扰
        if (!this.isBuildingMode()) {
            this.setSelectedTowers([]);
            this.setSelectedWisps([]);
        } else {
            // 建造模式下静默清除，不输出日志
            this.selectedTowers = [];
            this.selectedWisps = [];
            // 取消之前选中的高亮
            for (const tower of this.selectedTowers) {
                if (tower && tower.node && tower.node.isValid) {
                    tower.setHighlight(false);
                }
            }
            for (const wisp of this.selectedWisps) {
                if (wisp && wisp.node && wisp.node.isValid) {
                    wisp.setHighlight(false);
                }
            }
        }
    }

    /**
     * 计算多个单位的分散位置（圆形排列）
     * @param centerPos 中心位置
     * @param towers 单位数组
     * @returns 每个单位的目标位置数组
     */
    calculateFormationPositions(centerPos: Vec3, units: any[]): Vec3[] {
        const positions: Vec3[] = [];
        
        if (units.length === 0) {
            return positions;
        }
        
        // 如果只有一个单位，直接返回中心位置
        if (units.length === 1) {
            positions.push(centerPos.clone());
            return positions;
        }
        
        // 获取最大碰撞半径（用于计算间距，使用最大值确保所有单位都有足够空间）
        let maxRadius = 10; // 默认10像素
        let validUnits = 0;
        for (const unit of units) {
            if (unit && unit.node && unit.node.isValid) {
                const radius = unit.collisionRadius || 10;
                maxRadius = Math.max(maxRadius, radius);
                validUnits++;
            }
        }
        
        if (validUnits === 0) {
            return positions;
        }
        
        // 最小间距 = 两个最大半径之和 * 2（增加安全距离，避免碰撞）
        // 使用更大的安全系数，确保单位之间有足够的空间，避免单位找不到位置
        const minSpacing = maxRadius * 2 * 2;
        
        // 计算圆形排列的半径
        // 根据单位数量计算需要的半径
        let formationRadius = 0;
        if (units.length === 2) {
            // 两个单位对称排列
            formationRadius = minSpacing / 2;
        } else if (units.length === 3) {
            // 三个单位排列成等边三角形（都围绕中心，不放在中心）
            // 等边三角形的边长 = minSpacing
            // 外接圆半径 = 边长 / sqrt(3)
            formationRadius = minSpacing / Math.sqrt(3);
        } else {
            // 多个单位排列成圆形
            // 使用公式：半径 = 间距 / (2 * sin(π/数量))
            formationRadius = minSpacing / (2 * Math.sin(Math.PI / units.length));
        }
        
        // 为每个单位计算位置
        for (let i = 0; i < units.length; i++) {
            if (!units[i] || !units[i].node || !units[i].node.isValid) {
                positions.push(centerPos.clone());
                continue;
            }
            
            if (units.length === 1) {
                // 只有一个单位，在中心
                positions.push(centerPos.clone());
            } else if (units.length === 2) {
                // 两个单位对称排列
                if (i === 0) {
                    // 第一个单位在左侧
                    const pos = new Vec3(
                        centerPos.x - formationRadius,
                        centerPos.y,
                        centerPos.z
                    );
                    positions.push(pos);
                } else {
                    // 第二个单位在右侧
                    const pos = new Vec3(
                        centerPos.x + formationRadius,
                        centerPos.y,
                        centerPos.z
                    );
                    positions.push(pos);
                }
            } else if (units.length === 3) {
                // 三个单位排列成等边三角形（都围绕中心，不放在中心）
                // 角度从上方开始，每个单位间隔120度
                // 单位0: -90度（上方），单位1: 30度（右下），单位2: 150度（左下）
                const angle = (2 * Math.PI * i) / 3 - Math.PI / 2; // 从上方开始
                // 使用sin和cos，注意Y轴向上为正
                const offsetX = Math.sin(angle) * formationRadius;
                const offsetY = Math.cos(angle) * formationRadius;
                
                const pos = new Vec3(
                    centerPos.x + offsetX,
                    centerPos.y + offsetY,
                    centerPos.z
                );
                positions.push(pos);
            } else {
                // 4个及以上单位：第一个在中心，其他围绕中心排列
                if (i === 0) {
                    // 第一个单位在中心
                    positions.push(centerPos.clone());
                } else {
                    // 其他单位围绕中心排列
                    // 计算角度（从上方开始，顺时针排列）
                    // 注意：由于第一个在中心，所以其他单位的角度需要调整
                    const angle = (2 * Math.PI * (i - 1)) / (units.length - 1);
                    const offsetX = Math.sin(angle) * formationRadius;
                    const offsetY = Math.cos(angle) * formationRadius;
                    
                    const pos = new Vec3(
                        centerPos.x + offsetX,
                        centerPos.y + offsetY,
                        centerPos.z
                    );
                    positions.push(pos);
                }
            }
        }
        
        return positions;
    }

    /**
     * 注册移动命令监听（点击时让所有选中的防御单位移动）
     */
    registerMoveCommand() {
        if (!this.canvas) return;

        // 移除之前的监听
        if (this.globalTouchHandler) {
            this.canvas.off(Node.EventType.TOUCH_END, this.globalTouchHandler, this);
        }

        // 创建新的监听（只监听一次）
        this.globalTouchHandler = (event: EventTouch) => {
            // 检查是否点击在UI元素上
            const targetNode = event.target as Node;
            if (this.isUIElement(targetNode)) {
                return; // 点击在UI上，不处理移动
            }

            // 检查是否点击在防御单位或小精灵上（如果是，不处理移动，让单位的点击事件处理）
            if (this.isTowerNode(targetNode) || this.isWispNode(targetNode)) {
                return; // 点击在单位上，不处理移动
            }

            // 获取点击位置（世界坐标）
            const touchLocation = event.getLocation();
            const worldPos = this.screenToWorld(touchLocation);
            
            console.log('SelectionManager.registerMoveCommand: Click at screen (', touchLocation.x.toFixed(1), ',', touchLocation.y.toFixed(1), ') -> world (', worldPos.x.toFixed(1), ',', worldPos.y.toFixed(1), ')');

            // 计算分散位置（包括防御单位和小精灵）
            const allUnits: any[] = [...this.selectedTowers, ...this.selectedWisps];
            const formationPositions = this.calculateFormationPositions(worldPos, allUnits);
            
            console.log('SelectionManager.registerMoveCommand: Moving', this.selectedTowers.length, 'towers and', this.selectedWisps.length, 'wisps to formation positions');

            // 让所有选中的防御单位移动到各自的分散位置
            for (let i = 0; i < this.selectedTowers.length; i++) {
                const tower = this.selectedTowers[i];
                if (tower && tower.node && tower.node.isValid && i < formationPositions.length) {
                    console.log('SelectionManager.registerMoveCommand: Moving tower', i, 'to (', formationPositions[i].x.toFixed(1), ',', formationPositions[i].y.toFixed(1), ')');
                    tower.setManualMoveTargetPosition(formationPositions[i]);
                }
            }

            // 让所有选中的小精灵移动到各自的分散位置
            for (let i = 0; i < this.selectedWisps.length; i++) {
                const wisp = this.selectedWisps[i];
                if (wisp && wisp.node && wisp.node.isValid && this.selectedTowers.length + i < formationPositions.length) {
                    console.log('SelectionManager.registerMoveCommand: Moving wisp', i, 'to (', formationPositions[this.selectedTowers.length + i].x.toFixed(1), ',', formationPositions[this.selectedTowers.length + i].y.toFixed(1), ')');
                    wisp.setManualMoveTargetPosition(formationPositions[this.selectedTowers.length + i]);
                }
            }

            // 移除移动命令监听
            this.canvas.off(Node.EventType.TOUCH_END, this.globalTouchHandler, this);
            this.globalTouchHandler = null!;
            
            // 清除选择，取消高亮状态，确保每次只能移动一次
            this.clearSelection();
        };

        this.canvas.on(Node.EventType.TOUCH_END, this.globalTouchHandler, this);
    }

    /**
     * 屏幕坐标转换为世界坐标
     */
    screenToWorld(screenPos: { x: number, y: number }): Vec3 {
        // 如果相机不存在，尝试重新查找
        if (!this.camera || !this.camera.node || !this.camera.node.isValid) {
            const cameraNode = find('Canvas/Camera') || this.node.scene?.getChildByName('Camera');
            if (cameraNode) {
                this.camera = cameraNode.getComponent(Camera);
            }
        }
        
        if (!this.camera) {
            console.error('SelectionManager.screenToWorld: Camera not found! Cannot convert screen to world coordinates.');
            // 返回一个无效位置，而不是屏幕坐标（避免移动到错误位置）
            return new Vec3(0, 0, 0);
        }

        const screenVec = new Vec3(screenPos.x, screenPos.y, 0);
        const worldVec = new Vec3();
        this.camera.screenToWorld(screenVec, worldVec);
        worldVec.z = 0;
        
        // 调试：检查转换结果
        if (Math.abs(worldVec.x) < 0.1 && Math.abs(worldVec.y) < 0.1) {
            console.warn('SelectionManager.screenToWorld: Warning - converted world position is near origin!', 
                'Screen:', screenPos, 'World:', worldVec, 'Camera:', this.camera.node.name);
        }
        
        return worldVec;
    }

    /**
     * 检查节点是否是UI元素（按钮、选择面板等）
     */
    isUIElement(node: Node | null): boolean {
        if (!node) return false;

        // 检查节点名称
        const nodeName = node.name.toLowerCase();
        if (nodeName.includes('button') || 
            nodeName.includes('panel') || 
            nodeName.includes('label') ||
            nodeName.includes('selection')) {
            return true;
        }

        // 检查父节点
        let parent = node.parent;
        while (parent) {
            const parentName = parent.name.toLowerCase();
            if (parentName.includes('ui') || 
                parentName.includes('panel') ||
                parentName === 'canvas') {
                return true;
            }
            parent = parent.parent;
        }

        return false;
    }

    /**
     * 检查节点是否是防御单位节点
     */
    isTowerNode(node: Node | null): boolean {
        if (!node) return false;

        // 检查节点是否有Tower组件
        const towerScript = node.getComponent(Arrower);
        if (towerScript) {
            return true;
        }

        // 检查父节点（防御单位可能是子节点）
        let parent = node.parent;
        while (parent) {
            const towerScript = parent.getComponent(Arrower);
            if (towerScript) {
                return true;
            }
            // 如果到达Towers容器，停止查找
            if (parent.name === 'Towers') {
                break;
            }
            parent = parent.parent;
        }

        return false;
    }

    /**
     * 检查节点是否是小精灵节点
     */
    isWispNode(node: Node | null): boolean {
        if (!node) return false;

        // 检查节点是否有Wisp组件
        const wispScript = node.getComponent(Wisp);
        if (wispScript) {
            return true;
        }

        // 检查父节点（小精灵可能是子节点）
        let parent = node.parent;
        while (parent) {
            const wispScript = parent.getComponent(Wisp);
            if (wispScript) {
                return true;
            }
            // 如果到达Wisps容器，停止查找
            if (parent.name === 'Wisps') {
                break;
            }
            parent = parent.parent;
        }

        return false;
    }

    /**
     * 检查是否在建造模式下
     */
    isBuildingMode(): boolean {
        try {
            // 使用缓存的节点或重新查找
            let towerBuilderNode = this.towerBuilderNode;
            if (!towerBuilderNode || !towerBuilderNode.isValid) {
                // 尝试重新查找
                towerBuilderNode = find('TowerBuilder');
                if (!towerBuilderNode && this.node.scene) {
                    const findNodeRecursive = (node: Node, name: string): Node | null => {
                        if (node.name === name) {
                            return node;
                        }
                        for (const child of node.children) {
                            const found = findNodeRecursive(child, name);
                            if (found) return found;
                        }
                        return null;
                    };
                    towerBuilderNode = findNodeRecursive(this.node.scene, 'TowerBuilder');
                }
                
                if (!towerBuilderNode || !towerBuilderNode.isValid) {
                    // 只在第一次失败时输出警告，避免刷屏
                    if (Math.random() < 0.01) {
                        console.warn('SelectionManager: TowerBuilder node not found or invalid');
                    }
                    return false;
                }
                // 缓存找到的节点
                this.towerBuilderNode = towerBuilderNode;
            }

            // 获取TowerBuilder组件
            const towerBuilder = towerBuilderNode.getComponent('TowerBuilder') as any;
            if (!towerBuilder) {
                if (Math.random() < 0.01) {
                    console.warn('SelectionManager: TowerBuilder component not found');
                }
                return false;
            }

            // 使用公共方法检查是否在建造模式
            if (towerBuilder.getIsBuildingMode && typeof towerBuilder.getIsBuildingMode === 'function') {
                return towerBuilder.getIsBuildingMode() === true;
            }
            
            // 如果没有公共方法，尝试直接访问属性（向后兼容）
            if (towerBuilder.isBuildingMode !== undefined) {
                return towerBuilder.isBuildingMode === true;
            }
            
            return false;
        } catch (error) {
            console.error('SelectionManager: Error checking building mode:', error);
            return false;
        }
    }
}

