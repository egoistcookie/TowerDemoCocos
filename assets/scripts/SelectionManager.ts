import { _decorator, Component, Node, Vec3, Graphics, UITransform, EventTouch, find, Camera, input, Input, Sprite, Label } from 'cc';
import { Arrower } from './Arrower';
import { Wisp } from './Wisp';
import { Hunter } from './Hunter';
import { ElfSwordsman } from './ElfSwordsman';
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
    private selectedHunters: Hunter[] = []; // 选中的女猎手数组
    private selectedWisps: Wisp[] = []; // 选中的小精灵数组
    private selectedSwordsmen: ElfSwordsman[] = []; // 选中的精灵剑士数组
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
                console.debug('SelectionManager: Found TowerBuilder node:', this.towerBuilderNode.name);
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

        // 监听触摸开始
        this.canvas.on(Node.EventType.TOUCH_START, this.onTouchStart, this); // 不使用capture阶段，避免干扰相机
        // 监听触摸移动
        this.canvas.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this); // 不使用capture阶段，避免干扰相机
        // 监听触摸结束 - 不使用capture阶段，确保在建筑物点击事件之后触发
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
        
        // 检查是否正在拖拽建筑物（通过TowerBuilder）
        const isDraggingBuilding = this.isDraggingBuilding();
        
        if (buildingMode || isDraggingBuilding) {
            // 如果正在选择，清除选择状态
            if (this.isSelecting) {
                this.isSelecting = false;
                if (this.selectionBox && this.selectionBox.isValid) {
                    this.selectionBox.active = false;
                }
                this.clearSelection();
            }
            return; // 建造模式或拖拽建筑物时，不处理多选
        }

        // 检查是否点击在UI元素上（如按钮、选择面板等）
        const targetNode = event.target as Node;
        if (this.isUIElement(targetNode)) {
            return; // 点击在UI上，不处理选择
        }

        // 获取触摸位置（世界坐标）
        const touchLocation = event.getLocation();
        const worldPos = this.screenToWorld(touchLocation);
        
        this.startPos = worldPos.clone();
        this.currentPos = worldPos.clone();
        // 不立即开始选择，等待触摸移动超过一定距离
        this.isSelecting = false;

        // console.debug('SelectionManager.onTouchStart: Start selecting at', this.startPos);

        // 不立即显示选择框，等待触摸移动
        if (this.selectionBox && this.selectionBox.isValid) {
            this.selectionBox.active = false;
        }

        // 如果之前没有选中的单位，清除之前的选择
        // 如果有选中的单位，保留选择（等待拖拽或点击来决定是重新选择还是移动）
        if (this.selectedTowers.length === 0 && this.selectedHunters.length === 0 && this.selectedWisps.length === 0 && this.selectedSwordsmen.length === 0) {
            this.clearSelection();
        }
    }

    /**
     * 触摸移动
     */
    onTouchMove(event: EventTouch) {
        // 优先检查是否在建造模式下（如果是，完全不处理）
        const buildingMode = this.isBuildingMode();
        
        // 检查是否正在拖拽建筑物（通过TowerBuilder）
        const isDraggingBuilding = this.isDraggingBuilding();
        
        if (buildingMode || isDraggingBuilding) {
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

        // 获取当前触摸位置（世界坐标）
        const touchLocation = event.getLocation();
        this.currentPos = this.screenToWorld(touchLocation);

        if (!this.isSelecting) {
            // 计算移动距离
            const deltaX = Math.abs(this.currentPos.x - this.startPos.x);
            const deltaY = Math.abs(this.currentPos.y - this.startPos.y);
            
            // 只有当移动距离超过一定阈值时才开始选择
            const SELECTION_THRESHOLD = 20; // 选择阈值，单位：像素
            if (deltaX > SELECTION_THRESHOLD || deltaY > SELECTION_THRESHOLD) {
                this.isSelecting = true;
                // 显示选择框
                if (this.selectionBox && this.selectionBox.isValid) {
                    this.selectionBox.active = true;
                    this.selectionBox.setWorldPosition(this.startPos);
                }
            } else {
                return; // 移动距离太小，不处理选择
            }
        }

        // 如果之前有选中的单位，检测到拖拽时清除之前的选择（开始新的选择）
        if (this.selectedTowers.length > 0 || this.selectedHunters.length > 0 || this.selectedWisps.length > 0 || this.selectedSwordsmen.length > 0) {
            const dragDistance = Vec3.distance(this.startPos, this.currentPos);
            if (dragDistance > 5) { // 检测到拖拽（移动超过5像素）
                console.debug('SelectionManager.onTouchMove: Detected drag, clearing previous selection');
                this.clearSelection();
            }
        }

        // 更新选择框
        this.updateSelectionBox();

        // 更新选中的防御单位
        this.updateSelectedTowers();
        
        // console.debug('SelectionManager.onTouchMove: Current pos', this.currentPos, 'Selected towers:', this.selectedTowers.length);
    }

    /**
     * 触摸结束
     */
    onTouchEnd(event: EventTouch) {
        // console.debug('SelectionManager.onTouchEnd: Touch end event received, isSelecting:', this.isSelecting, 'selectedTowers:', this.selectedTowers.length, 'selectedHunters:', this.selectedHunters.length, 'selectedWisps:', this.selectedWisps.length);
        
        // 检查是否有选中的单位（小精灵、防御塔、女猎手或精灵剑士）
        const hasSelectedUnits = this.selectedTowers.length > 0 || this.selectedHunters.length > 0 || this.selectedWisps.length > 0 || this.selectedSwordsmen.length > 0;
        
        // 优先检查是否在建造模式下（如果是，且没有选中单位，完全不处理，让建造系统处理）
        const buildingMode = this.isBuildingMode();
        const draggingBuilding = this.isDraggingBuilding();
        console.info('[SelectionManager] onTouchEnd - 触摸结束事件, buildingMode:', buildingMode, 'draggingBuilding:', draggingBuilding, 'hasSelectedUnits:', hasSelectedUnits);
        // console.debug('SelectionManager.onTouchEnd: Building mode:', buildingMode);
        
        if ((buildingMode || draggingBuilding) && !hasSelectedUnits) {
            // 如果正在选择，清除选择状态
            if (this.isSelecting) {
                this.isSelecting = false;
                if (this.selectionBox && this.selectionBox.isValid) {
                    this.selectionBox.active = false;
                }
                this.clearSelection();
            }
            // 不阻止事件传播，让TowerBuilder可以处理
            console.info('[SelectionManager] onTouchEnd - 在建造模式或拖拽建筑物模式下，且没有选中单位，不处理，让TowerBuilder处理');
            // console.debug('SelectionManager.onTouchEnd: In building mode and no selected units, returning without handling move');
            return;
        }
        
        // 如果有选中单位，即使处于建造模式，也处理移动命令
        if (buildingMode && hasSelectedUnits) {
            // console.debug('SelectionManager.onTouchEnd: In building mode but has selected units, continuing to handle move');
        }
        
        // console.debug('SelectionManager.onTouchEnd: Continuing to handle touch, hasSelectedUnits:', hasSelectedUnits);
        // console.debug('SelectionManager.onTouchEnd: hasSelectedUnits:', hasSelectedUnits, 'selectedTowers:', this.selectedTowers.length, 'selectedHunters:', this.selectedHunters.length, 'selectedWisps:', this.selectedWisps.length);
        
        if (!this.isSelecting && !hasSelectedUnits) {
            // console.debug('SelectionManager.onTouchEnd: Not selecting and no selected units, returning');
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
        // console.debug('SelectionManager.onTouchEnd: Drag distance:', dragDistance.toFixed(2), 'Start:', this.startPos, 'End:', this.currentPos);
        
        // 记录拖拽开始前是否有选中的单位（包括防御单位、女猎手、小精灵和精灵剑士）
        const hadPreviousSelection = this.selectedTowers.length > 0 || this.selectedHunters.length > 0 || this.selectedWisps.length > 0 || this.selectedSwordsmen.length > 0;
        // console.debug('SelectionManager.onTouchEnd: Had previous selection:', hadPreviousSelection);
        
        // console.debug('SelectionManager.onTouchEnd: Has selected units:', hasSelectedUnits, 'selectedTowers:', this.selectedTowers.length, 'selectedHunters:', this.selectedHunters.length, 'selectedWisps:', this.selectedWisps.length);
        
        // 如果是拖拽选择，更新选中的单位
        if (dragDistance > 10) { // 至少拖动10像素才认为是有效的选择
            // console.debug('SelectionManager.onTouchEnd: Drag distance > 10, updating selected towers...');
            this.updateSelectedTowers();
            // console.debug('SelectionManager.onTouchEnd: After update, selected towers count:', this.selectedTowers.length);
            
            // 框选完成后，不立即注册移动命令，等待下一次点击
            // 保留选中状态，不清除选择
            return;
        } 
        // 如果有选中的单位，且是点击（不是拖拽），直接处理移动逻辑
        else if (hasSelectedUnits) {
            // console.debug('SelectionManager.onTouchEnd: Click detected with selected units, processing move command immediately');
            
            // 获取点击位置（世界坐标）
            const touchLocation = event.getLocation();
            const worldPos = this.screenToWorld(touchLocation);
            // console.debug('SelectionManager.onTouchEnd: Click position:', touchLocation, 'worldPos:', worldPos);
            
            // 检查点击位置是否在建筑物占地区域内
            const clickedBuilding = this.findBuildingAtPosition(worldPos);
            // console.debug('SelectionManager.onTouchEnd: Clicked building:', clickedBuilding ? clickedBuilding.name : 'null');
            
            // 计算分散位置（包括防御单位、女猎手、小精灵和精灵剑士）
            const allUnits: any[] = [...this.selectedTowers, ...this.selectedHunters, ...this.selectedWisps, ...this.selectedSwordsmen];
            const formationPositions = this.calculateFormationPositions(worldPos, allUnits);
            console.debug('SelectionManager.onTouchEnd: Calculated formation positions:', formationPositions);
            
            console.debug('SelectionManager.onTouchEnd: Moving', this.selectedTowers.length, 'towers,', this.selectedHunters.length, 'hunters,', this.selectedWisps.length, 'wisps and', this.selectedSwordsmen.length, 'swordsmen to formation positions');

            // 让所有选中的防御单位移动到各自的分散位置
            for (let i = 0; i < this.selectedTowers.length; i++) {
                const tower = this.selectedTowers[i];
                if (tower && tower.node && tower.node.isValid && i < formationPositions.length) {
                    console.debug('SelectionManager.onTouchEnd: Moving tower', i, 'to (', formationPositions[i].x.toFixed(1), ',', formationPositions[i].y.toFixed(1), ')');
                    tower.setManualMoveTargetPosition(formationPositions[i]);
                }
            }

            // 让所有选中的女猎手移动到各自的分散位置
            console.debug('SelectionManager.onTouchEnd: Moving', this.selectedHunters.length, 'hunters');
            console.debug('SelectionManager.onTouchEnd: selectedHunters array:', this.selectedHunters);
            for (let i = 0; i < this.selectedHunters.length; i++) {
                const hunter = this.selectedHunters[i];
                console.debug('SelectionManager.onTouchEnd: Processing hunter', i, ':', hunter);
                if (hunter && hunter.node && hunter.node.isValid) {
                    console.debug('SelectionManager.onTouchEnd: Hunter', i, 'is valid, node name:', hunter.node.name);
                    if ((this.selectedTowers.length + i) < formationPositions.length) {
                        const targetPos = formationPositions[this.selectedTowers.length + i];
                        console.debug('SelectionManager.onTouchEnd: Moving hunter', i, 'to (', targetPos.x.toFixed(1), ',', targetPos.y.toFixed(1), ')');
                        console.debug('SelectionManager.onTouchEnd: Calling hunter.setManualMoveTargetPosition with targetPos:', targetPos);
                        hunter.setManualMoveTargetPosition(targetPos);
                        console.debug('SelectionManager.onTouchEnd: After calling setManualMoveTargetPosition');
                    } else {
                        console.debug('SelectionManager.onTouchEnd: No formation position available for hunter', i, 'total formation positions:', formationPositions.length, 'selectedTowers.length:', this.selectedTowers.length, 'selectedHunters.length:', this.selectedHunters.length);
                    }
                } else {
                    console.debug('SelectionManager.onTouchEnd: Skipping hunter', i, 'because:', 
                        hunter ? 'hunter exists' : 'hunter is null', 
                        hunter && hunter.node ? 'node exists' : 'node is null', 
                        hunter && hunter.node && hunter.node.isValid ? 'node is valid' : 'node is invalid');
                }
            }

            // 让所有选中的小精灵移动到各自的分散位置或建筑物身边
            for (let i = 0; i < this.selectedWisps.length; i++) {
                const wisp = this.selectedWisps[i];
                if (wisp && wisp.node && wisp.node.isValid) {
                    console.debug('SelectionManager.onTouchEnd: Processing wisp', i, 'movement');
                    if (clickedBuilding) {
                        // 如果点击在建筑物上，让小精灵移动到建筑物附近1的位置
                        console.debug('SelectionManager.onTouchEnd: Wisp moving to building at (', clickedBuilding.worldPosition.x.toFixed(1), ',', clickedBuilding.worldPosition.y.toFixed(1), ')');
                        // 设置移动目标为建筑物附近1的位置，小精灵会在到达后自动依附
                        const buildingPos = clickedBuilding.worldPosition.clone();
                        // 计算到建筑物的方向向量，然后移动到距离建筑物1的位置
                        const direction = new Vec3();
                        Vec3.subtract(direction, worldPos, buildingPos);
                        console.debug('SelectionManager.onTouchEnd: Direction to building:', direction);
                        if (direction.length() > 0) {
                            direction.normalize();
                            // 移动到距离建筑物1的位置
                            const targetPos = new Vec3();
                            Vec3.scaleAndAdd(targetPos, buildingPos, direction, 1);
                            console.debug('SelectionManager.onTouchEnd: Setting wisp manual move target to:', targetPos);
                            wisp.setManualMoveTargetPosition(targetPos);
                        } else {
                            // 如果点击位置就是建筑物位置，直接使用建筑物位置
                            console.debug('SelectionManager.onTouchEnd: Setting wisp manual move target to building position:', buildingPos);
                            wisp.setManualMoveTargetPosition(buildingPos);
                        }
                    } else if ((this.selectedTowers.length + this.selectedHunters.length + i) < formationPositions.length) {
                        // 否则，移动到目标位置
                        console.debug('SelectionManager.onTouchEnd: Moving wisp', i, 'to (', formationPositions[this.selectedTowers.length + this.selectedHunters.length + i].x.toFixed(1), ',', formationPositions[this.selectedTowers.length + this.selectedHunters.length + i].y.toFixed(1), ')');
                        wisp.setManualMoveTargetPosition(formationPositions[this.selectedTowers.length + this.selectedHunters.length + i]);
                    }
                } else {
                    console.debug('SelectionManager.onTouchEnd: Wisp', i, 'is invalid');
                }
            }

            // 让所有选中的精灵剑士移动到各自的分散位置
            for (let i = 0; i < this.selectedSwordsmen.length; i++) {
                const swordsman = this.selectedSwordsmen[i];
                if (swordsman && swordsman.node && swordsman.node.isValid) {
                    if ((this.selectedTowers.length + this.selectedHunters.length + this.selectedWisps.length + i) < formationPositions.length) {
                        const targetPos = formationPositions[this.selectedTowers.length + this.selectedHunters.length + this.selectedWisps.length + i];
                        console.debug('SelectionManager.onTouchEnd: Moving swordsman', i, 'to (', targetPos.x.toFixed(1), ',', targetPos.y.toFixed(1), ')');
                        swordsman.setManualMoveTargetPosition(targetPos);
                    }
                }
            }
            
            // 清除选择，取消高亮状态，确保每次只能移动一次
            console.debug('SelectionManager.onTouchEnd: Clearing selection after move');
            this.clearSelection();
            return;
        } 
        // 如果没有选中的单位，且是点击（不是拖拽），检查是否点击了女猎手
        else {
            // 检查是否点击了女猎手
            const touchLocation = event.getLocation();
            const worldPos = this.screenToWorld(touchLocation);
            
            // 查找点击位置的女猎手
            const hunter = this.findHunterAtPosition(worldPos);
            if (hunter) {
                console.debug('SelectionManager.onTouchEnd: Clicked on hunter, adding to selectedHunters');
                // 添加到选中的女猎手数组
                this.selectedHunters = [hunter];
                // 设置高亮
                this.setSelectedHunters([hunter]);
                return;
            }
            
            // 如果之前没有选中的单位，清除选择状态
            console.debug('SelectionManager.onTouchEnd: Drag distance too small and no selected units, clearing selection');
            this.clearSelection();
        }
        console.debug('SelectionManager.onTouchEnd: Touch end event processed');
    }
    
    /**
     * 查找指定位置的女猎手
     * @param worldPos 世界坐标位置
     * @returns 找到的女猎手组件，找不到返回null
     */
    private findHunterAtPosition(worldPos: Vec3): any {
        console.debug('SelectionManager.findHunterAtPosition: Looking for hunter at (', worldPos.x.toFixed(1), ',', worldPos.y.toFixed(1), ')');
        
        // 查找女猎手
        let huntersNode = find('Hunters');
        console.debug('SelectionManager.findHunterAtPosition: Direct find Hunters node:', huntersNode ? huntersNode.name : 'null');
        
        if (!huntersNode && this.node.scene) {
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
            huntersNode = findNodeRecursive(this.node.scene, 'Hunters');
            console.debug('SelectionManager.findHunterAtPosition: Recursive find Hunters node:', huntersNode ? huntersNode.name : 'null');
        }
        
        if (huntersNode) {
            const hunters = huntersNode.children || [];
            console.debug('SelectionManager.findHunterAtPosition: Found', hunters.length, 'hunter nodes in Hunters container');
            
            for (const hunterNode of hunters) {
                console.debug('SelectionManager.findHunterAtPosition: Processing hunter node:', hunterNode.name, 'active:', hunterNode.active, 'valid:', hunterNode.isValid);
                
                if (!hunterNode || !hunterNode.isValid) {
                    console.debug('SelectionManager.findHunterAtPosition: Skipping invalid hunter node:', hunterNode?.name);
                    continue;
                }
                
                if (!hunterNode.active) {
                    console.debug('SelectionManager.findHunterAtPosition: Skipping inactive hunter node:', hunterNode.name);
                    continue;
                }
                
                const hunterScript = hunterNode.getComponent('Hunter') as any;
                if (!hunterScript) {
                    console.debug('SelectionManager.findHunterAtPosition: No Hunter script found for node:', hunterNode.name);
                    continue;
                }
                
                console.debug('SelectionManager.findHunterAtPosition: Found Hunter script for node:', hunterNode.name);
                
                // 检查isAlive方法是否存在
                if (!hunterScript.isAlive) {
                    console.debug('SelectionManager.findHunterAtPosition: Hunter script has no isAlive method, assuming alive');
                } else {
                    // 检查isAlive方法是否是函数
                    if (typeof hunterScript.isAlive === 'function') {
                        const isAlive = hunterScript.isAlive();
                        console.debug('SelectionManager.findHunterAtPosition: Hunter isAlive():', isAlive);
                        if (!isAlive) {
                            console.debug('SelectionManager.findHunterAtPosition: Hunter is not alive:', hunterNode.name);
                            continue;
                        }
                    } else {
                        // 如果isAlive是属性而不是方法
                        console.debug('SelectionManager.findHunterAtPosition: Hunter isAlive property:', hunterScript.isAlive);
                        if (!hunterScript.isAlive) {
                            console.debug('SelectionManager.findHunterAtPosition: Hunter is not alive (property):', hunterNode.name);
                            continue;
                        }
                    }
                }
                
                // 检查女猎手是否在点击位置附近
                const hunterPos = hunterNode.worldPosition;
                console.debug('SelectionManager.findHunterAtPosition: Hunter position:', hunterPos);
                const distance = Vec3.distance(hunterPos, worldPos);
                console.debug('SelectionManager.findHunterAtPosition: Distance to hunter:', distance.toFixed(1));
                
                if (distance <= 100) { // 点击范围扩大到100像素
                    console.debug('SelectionManager.findHunterAtPosition: Found hunter at distance', distance.toFixed(1), 'returning hunterScript');
                    return hunterScript;
                }
            }
        } else {
            console.debug('SelectionManager.findHunterAtPosition: Hunters node not found, searching all nodes...');
            // 如果没有找到Hunters节点，直接搜索所有节点
            const allNodes = this.node.scene?.children || [];
            for (const node of allNodes) {
                if (node.name.includes('Hunter') || node.name.includes('hunter')) {
                    console.debug('SelectionManager.findHunterAtPosition: Found potential hunter node:', node.name);
                    const hunterScript = node.getComponent('Hunter') as any;
                    if (hunterScript) {
                        const hunterPos = node.worldPosition;
                        const distance = Vec3.distance(hunterPos, worldPos);
                        if (distance <= 100) {
                            console.debug('SelectionManager.findHunterAtPosition: Found hunter node directly at distance', distance.toFixed(1), 'returning hunterScript');
                            return hunterScript;
                        }
                    }
                }
            }
        }
        
        console.debug('SelectionManager.findHunterAtPosition: No hunter found at (', worldPos.x.toFixed(1), ',', worldPos.y.toFixed(1), ')');
        return null;
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

        console.debug('SelectionManager.updateSelectedTowers: Selection box range:', {
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
            console.debug('SelectionManager.updateSelectedTowers: Towers node not found!');
            return;
        }

        const towers = towersNode.children || [];
        console.debug('SelectionManager.updateSelectedTowers: Found', towers.length, 'tower nodes');

        const newSelectedTowers: Arrower[] = [];

        for (const towerNode of towers) {
            if (!towerNode || !towerNode.isValid || !towerNode.active) {
                console.debug('SelectionManager.updateSelectedTowers: Skipping invalid/inactive tower:', towerNode?.name);
                continue;
            }

            const towerScript = towerNode.getComponent(Arrower) as Arrower;
            if (!towerScript) {
                console.debug('SelectionManager.updateSelectedTowers: Arrower script not found for:', towerNode.name);
                continue;
            }
            
            if (!towerScript.isAlive || !towerScript.isAlive()) {
                console.debug('SelectionManager.updateSelectedTowers: Arrower is not alive:', towerNode.name);
                continue;
            }

            // 检查防御单位是否在选择框范围内
            const towerPos = towerNode.worldPosition;
            const inRangeX = towerPos.x >= minX && towerPos.x <= maxX;
            const inRangeY = towerPos.y >= minY && towerPos.y <= maxY;
            const inRange = inRangeX && inRangeY;
            
            console.debug('SelectionManager.updateSelectedTowers: Arrower', towerNode.name, 'at', towerPos, 
                'inRangeX:', inRangeX, 'inRangeY:', inRangeY, 'inRange:', inRange);
            
            if (inRange) {
                newSelectedTowers.push(towerScript);
                console.debug('SelectionManager.updateSelectedTowers: Added tower to selection:', towerNode.name);
            }
        }

        // 查找女猎手
        console.debug('SelectionManager.updateSelectedTowers: Looking for hunters');
        
        const newSelectedHunters: Hunter[] = [];
        
        // 先尝试直接查找Hunters容器
        let huntersNode = find('Hunters');
        if (!huntersNode && this.node.scene) {
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
            huntersNode = findNodeRecursive(this.node.scene, 'Hunters');
        }
        
        console.debug('SelectionManager.updateSelectedTowers: Found huntersNode:', huntersNode ? huntersNode.name : 'null');
        
        // 如果找到Hunters容器，先处理其中的女猎手
        if (huntersNode) {
            const hunters = huntersNode.children || [];
            console.debug('SelectionManager.updateSelectedTowers: Found', hunters.length, 'hunter nodes in Hunters container');
            
            for (const hunterNode of hunters) {
                console.debug('SelectionManager.updateSelectedTowers: Processing hunter node from Hunters container:', hunterNode.name, 'active:', hunterNode.active, 'valid:', hunterNode.isValid);
                
                if (!hunterNode || !hunterNode.isValid || !hunterNode.active) {
                    console.debug('SelectionManager.updateSelectedTowers: Skipping invalid/inactive hunter node:', hunterNode?.name);
                    continue;
                }
                
                const hunterScript = hunterNode.getComponent(Hunter) as Hunter;
                if (!hunterScript) {
                    console.debug('SelectionManager.updateSelectedTowers: No Hunter script found for node:', hunterNode.name);
                    continue;
                }
                
                if (hunterScript.isAlive && hunterScript.isAlive()) {
                    // 检查女猎手是否在选择框范围内
                    const hunterPos = hunterNode.worldPosition;
                    const inRangeX = hunterPos.x >= minX && hunterPos.x <= maxX;
                    const inRangeY = hunterPos.y >= minY && hunterPos.y <= maxY;
                    const inRange = inRangeX && inRangeY;
                    
                    console.debug('SelectionManager.updateSelectedTowers: Hunter', hunterNode.name, 'at (', hunterPos.x.toFixed(1), ',', hunterPos.y.toFixed(1), ') in range:', inRange, 'inRangeX:', inRangeX, 'inRangeY:', inRangeY);
                    
                    if (inRange) {
                        newSelectedHunters.push(hunterScript);
                        console.debug('SelectionManager.updateSelectedTowers: Added hunter to selection:', hunterNode.name);
                    }
                } else {
                    console.debug('SelectionManager.updateSelectedTowers: Hunter is not alive:', hunterNode.name);
                }
            }
        }
        
        // 同时，从场景根节点开始递归查找所有女猎手，确保没有遗漏
        console.debug('SelectionManager.updateSelectedTowers: Recursively searching all nodes for hunters');
        
        // 查找所有女猎手节点，无论它们在哪个容器中
        const findAllHunters = (node: Node) => {
            // 检查当前节点是否是女猎手
            const hunterScript = node.getComponent(Hunter) as Hunter;
            if (hunterScript) {
                // 检查是否已经添加过这个女猎手
                const isAlreadyAdded = newSelectedHunters.some(hunter => hunter.node === node);
                if (!isAlreadyAdded) {
                    console.debug('SelectionManager.updateSelectedTowers: Found hunter node:', node.name, 'active:', node.active, 'valid:', node.isValid);
                    
                    if (node.isValid && node.active) {
                        if (hunterScript.isAlive && hunterScript.isAlive()) {
                            // 检查女猎手是否在选择框范围内
                            const hunterPos = node.worldPosition;
                            const inRangeX = hunterPos.x >= minX && hunterPos.x <= maxX;
                            const inRangeY = hunterPos.y >= minY && hunterPos.y <= maxY;
                            const inRange = inRangeX && inRangeY;
                            
                            console.debug('SelectionManager.updateSelectedTowers: Hunter', node.name, 'at (', hunterPos.x.toFixed(1), ',', hunterPos.y.toFixed(1), ') in range:', inRange, 'inRangeX:', inRangeX, 'inRangeY:', inRangeY);
                            
                            if (inRange) {
                                newSelectedHunters.push(hunterScript);
                                console.debug('SelectionManager.updateSelectedTowers: Added hunter to selection:', node.name);
                            }
                        } else {
                            console.debug('SelectionManager.updateSelectedTowers: Hunter is not alive:', node.name);
                        }
                    } else {
                        console.debug('SelectionManager.updateSelectedTowers: Skipping invalid/inactive hunter node:', node.name);
                    }
                }
            }
            
            // 递归检查子节点
            for (const child of node.children) {
                findAllHunters(child);
            }
        };
        
        // 从场景根节点开始查找所有女猎手
        if (this.node.scene) {
            findAllHunters(this.node.scene);
        }
        
        console.debug('SelectionManager.updateSelectedTowers: Found', newSelectedHunters.length, 'hunters in selection box');
        console.debug('SelectionManager.updateSelectedTowers: Selection box range:', {
            minX: minX.toFixed(2),
            maxX: maxX.toFixed(2),
            minY: minY.toFixed(2),
            maxY: maxY.toFixed(2)
        });
        

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

        // 查找精灵剑士
        let swordsmenNode = find('ElfSwordsmans');
        if (!swordsmenNode && this.node.scene) {
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
            swordsmenNode = findNodeRecursive(this.node.scene, 'ElfSwordsmans');
        }
        
        const newSelectedSwordsmen: ElfSwordsman[] = [];
        if (swordsmenNode) {
            const swordsmen = swordsmenNode.children || [];
            for (const swordsmanNode of swordsmen) {
                if (!swordsmanNode || !swordsmanNode.isValid || !swordsmanNode.active) {
                    continue;
                }

                const swordsmanScript = swordsmanNode.getComponent(ElfSwordsman) as ElfSwordsman;
                if (!swordsmanScript) {
                    continue;
                }
                
                if (!swordsmanScript.isAlive || !swordsmanScript.isAlive()) {
                    continue;
                }

                // 检查精灵剑士是否在选择框范围内
                const swordsmanPos = swordsmanNode.worldPosition;
                const inRangeX = swordsmanPos.x >= minX && swordsmanPos.x <= maxX;
                const inRangeY = swordsmanPos.y >= minY && swordsmanPos.y <= maxY;
                const inRange = inRangeX && inRangeY;
                
                if (inRange) {
                    newSelectedSwordsmen.push(swordsmanScript);
                }
            }
        }

        console.debug('SelectionManager.updateSelectedTowers: Found', newSelectedTowers.length, 'towers,', newSelectedHunters.length, 'hunters,', newSelectedWisps.length, 'wisps and', newSelectedSwordsmen.length, 'swordsmen in selection box');

        // 更新选中状态
        this.setSelectedTowers(newSelectedTowers);
        this.setSelectedHunters(newSelectedHunters);
        this.setSelectedWisps(newSelectedWisps);
        this.setSelectedSwordsmen(newSelectedSwordsmen);
        
        // 移除之前注册的移动命令，确保不会自动触发移动
        if (this.globalTouchHandler) {
            this.canvas.off(Node.EventType.TOUCH_END, this.globalTouchHandler, this);
            this.globalTouchHandler = null!;
        }
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
     * 设置选中的精灵剑士
     */
    setSelectedSwordsmen(swordsmen: ElfSwordsman[]) {
        // 取消之前选中的高亮
        for (const swordsman of this.selectedSwordsmen) {
            if (swordsman && swordsman.node && swordsman.node.isValid) {
                swordsman.setHighlight(false);
            }
        }

        // 设置新的选中
        this.selectedSwordsmen = swordsmen;

        // 高亮显示选中的精灵剑士
        for (const swordsman of this.selectedSwordsmen) {
            if (swordsman && swordsman.node && swordsman.node.isValid) {
                swordsman.setHighlight(true);
            }
        }
    }

    /**
     * 设置选中的女猎手
     */
    setSelectedHunters(hunters: Hunter[]) {
        console.debug('SelectionManager.setSelectedHunters: Setting', hunters.length, 'hunters as selected');
        console.debug('SelectionManager.setSelectedHunters: Received hunters array:', hunters);
        
        // 取消之前选中的高亮
        console.debug('SelectionManager.setSelectedHunters: Clearing previous selection highlights for', this.selectedHunters.length, 'hunters');
        for (const hunter of this.selectedHunters) {
            if (hunter && hunter.node && hunter.node.isValid) {
                console.debug('SelectionManager.setSelectedHunters: Clearing highlight for hunter:', hunter.node.name);
                hunter.setHighlight(false);
            }
        }

        // 设置新的选中
        this.selectedHunters = hunters;
        console.debug('SelectionManager.setSelectedHunters: Updated selectedHunters array, now contains', this.selectedHunters.length, 'hunters');
        console.debug('SelectionManager.setSelectedHunters: selectedHunters array content:', this.selectedHunters);

        // 高亮显示选中的女猎手
        let highlightedCount = 0;
        console.debug('SelectionManager.setSelectedHunters: Highlighting', this.selectedHunters.length, 'hunters');
        for (const hunter of this.selectedHunters) {
            if (hunter && hunter.node && hunter.node.isValid) {
                console.debug('SelectionManager.setSelectedHunters: Highlighting hunter:', hunter.node.name, 'at', hunter.node.worldPosition);
                hunter.setHighlight(true);
                highlightedCount++;
                console.debug('SelectionManager.setSelectedHunters: Highlighted hunter:', hunter.node.name);
            } else {
                console.debug('SelectionManager.setSelectedHunters: Skipping invalid hunter:', hunter?.node?.name);
            }
        }
        
        console.debug('SelectionManager.setSelectedHunters: Highlighted', highlightedCount, 'out of', this.selectedHunters.length, 'hunters');
        
        // 检查是否有选中的女猎手，如果有，注册移动命令
        if (this.selectedHunters.length > 0) {
            console.debug('SelectionManager.setSelectedHunters: Found', this.selectedHunters.length, 'selected hunters, registering move command');
            this.registerMoveCommand();
        } else {
            console.debug('SelectionManager.setSelectedHunters: No hunters selected, not registering move command');
        }
    }

    /**
     * 设置选中的防御单位
     */
    setSelectedTowers(towers: Arrower[]) {
        console.debug('SelectionManager.setSelectedTowers: Setting', towers.length, 'towers as selected');
        
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
                console.debug('SelectionManager.setSelectedTowers: Highlighted tower:', tower.node.name, 'at', tower.node.worldPosition);
            } else {
                console.debug('SelectionManager.setSelectedTowers: Skipping invalid tower:', tower?.node?.name);
            }
        }
        
        console.debug('SelectionManager.setSelectedTowers: Highlighted', highlightedCount, 'out of', this.selectedTowers.length, 'towers');
    }

    /**
     * 清除选择
     */
    clearSelection() {
        // 移除之前注册的移动命令监听器
        if (this.globalTouchHandler) {
            this.canvas.off(Node.EventType.TOUCH_END, this.globalTouchHandler, this);
            this.globalTouchHandler = null!;
        }
        
        // 只在非建造模式下输出日志，避免建造模式下的日志干扰
        if (!this.isBuildingMode()) {
            this.setSelectedTowers([]);
            this.setSelectedHunters([]);
            this.setSelectedWisps([]);
            this.setSelectedSwordsmen([]);
        } else {
            // 建造模式下静默清除，不输出日志
            this.selectedTowers = [];
            this.selectedHunters = [];
            this.selectedWisps = [];
            this.selectedSwordsmen = [];
            // 取消之前选中的高亮
            for (const tower of this.selectedTowers) {
                if (tower && tower.node && tower.node.isValid) {
                    tower.setHighlight(false);
                }
            }
            for (const hunter of this.selectedHunters) {
                if (hunter && hunter.node && hunter.node.isValid) {
                    hunter.setHighlight(false);
                }
            }
            for (const wisp of this.selectedWisps) {
                if (wisp && wisp.node && wisp.node.isValid) {
                    wisp.setHighlight(false);
                }
            }
            for (const swordsman of this.selectedSwordsmen) {
                if (swordsman && swordsman.node && swordsman.node.isValid) {
                    swordsman.setHighlight(false);
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
        console.debug('SelectionManager.registerMoveCommand: Entering method');
        if (!this.canvas) {
            console.debug('SelectionManager.registerMoveCommand: Canvas is null, returning');
            return;
        }

        // 移除之前的监听
        if (this.globalTouchHandler) {
            console.debug('SelectionManager.registerMoveCommand: Removing previous global touch handler');
            this.canvas.off(Node.EventType.TOUCH_END, this.globalTouchHandler, this);
        }

        // 创建新的监听（只监听一次）
        this.globalTouchHandler = (event: EventTouch) => {
            console.debug('SelectionManager.registerMoveCommand.globalTouchHandler: Entering handler');
            // 优先检查是否在建造模式下（如果是，完全不处理，让建造系统处理）
            const buildingMode = this.isBuildingMode();
            const draggingBuilding = this.isDraggingBuilding();
            console.debug('SelectionManager.registerMoveCommand.globalTouchHandler: Building mode:', buildingMode, 'Dragging building:', draggingBuilding);
            if (buildingMode || draggingBuilding) {
                // 移除移动命令监听
                this.canvas.off(Node.EventType.TOUCH_END, this.globalTouchHandler, this);
                this.globalTouchHandler = null!;
                console.debug('SelectionManager.registerMoveCommand.globalTouchHandler: In building mode or dragging building, returning');
                return; // 建造模式或拖拽建筑物模式下，不处理移动
            }
            
            // 阻止事件传播，确保不会触发建筑物的点击事件
            event.propagationStopped = true;
            console.debug('SelectionManager.registerMoveCommand.globalTouchHandler: Event propagation stopped');
            
            // 检查是否点击在UI元素上
            const targetNode = event.target as Node;
            const isUI = this.isUIElement(targetNode);
            console.debug('SelectionManager.registerMoveCommand.globalTouchHandler: Clicked on node:', targetNode?.name, 'isUI:', isUI);
            if (isUI) {
                console.debug('SelectionManager.registerMoveCommand.globalTouchHandler: Clicked on UI, returning');
                return; // 点击在UI上，不处理移动
            }

            // 获取点击位置（世界坐标）
            const touchLocation = event.getLocation();
            const worldPos = this.screenToWorld(touchLocation);
            
            console.debug('SelectionManager.registerMoveCommand.globalTouchHandler: Click at screen (', touchLocation.x.toFixed(1), ',', touchLocation.y.toFixed(1), ') -> world (', worldPos.x.toFixed(1), ',', worldPos.y.toFixed(1), ')');

            // 检查点击位置是否在建筑物占地区域内
            const clickedBuilding = this.findBuildingAtPosition(worldPos);
            console.debug('SelectionManager.registerMoveCommand.globalTouchHandler: Clicked building:', clickedBuilding ? clickedBuilding.name : 'null');
            
            // 检查当前选中的单位
            console.debug('SelectionManager.registerMoveCommand.globalTouchHandler: Current selected towers:', this.selectedTowers.length, 'selected hunters:', this.selectedHunters.length, 'selected wisps:', this.selectedWisps.length);
            
            // 计算分散位置（包括防御单位、女猎手、小精灵和精灵剑士）
            const allUnits: any[] = [...this.selectedTowers, ...this.selectedHunters, ...this.selectedWisps, ...this.selectedSwordsmen];
            const formationPositions = this.calculateFormationPositions(worldPos, allUnits);
            console.debug('SelectionManager.registerMoveCommand.globalTouchHandler: Calculated', formationPositions.length, 'formation positions');
            
            console.debug('SelectionManager.registerMoveCommand.globalTouchHandler: Moving', this.selectedTowers.length, 'towers,', this.selectedHunters.length, 'hunters,', this.selectedWisps.length, 'wisps and', this.selectedSwordsmen.length, 'swordsmen to formation positions');

            // 让所有选中的防御单位移动到各自的分散位置
            for (let i = 0; i < this.selectedTowers.length; i++) {
                const tower = this.selectedTowers[i];
                if (tower && tower.node && tower.node.isValid && i < formationPositions.length) {
                    console.debug('SelectionManager.registerMoveCommand.globalTouchHandler: Moving tower', i, 'to (', formationPositions[i].x.toFixed(1), ',', formationPositions[i].y.toFixed(1), ')');
                    tower.setManualMoveTargetPosition(formationPositions[i]);
                }
            }

            // 让所有选中的女猎手移动到各自的分散位置
            console.debug('SelectionManager.registerMoveCommand.globalTouchHandler: Moving', this.selectedHunters.length, 'hunters');
            for (let i = 0; i < this.selectedHunters.length; i++) {
                const hunter = this.selectedHunters[i];
                if (hunter && hunter.node && hunter.node.isValid && (this.selectedTowers.length + i) < formationPositions.length) {
                    const targetPos = formationPositions[this.selectedTowers.length + i];
                    console.debug('SelectionManager.registerMoveCommand.globalTouchHandler: Moving hunter', i, 'to (', targetPos.x.toFixed(1), ',', targetPos.y.toFixed(1), ')');
                    console.debug('SelectionManager.registerMoveCommand.globalTouchHandler: Calling hunter.setManualMoveTargetPosition with targetPos:', targetPos);
                    hunter.setManualMoveTargetPosition(targetPos);
                    console.debug('SelectionManager.registerMoveCommand.globalTouchHandler: After calling setManualMoveTargetPosition');
                } else {
                    console.debug('SelectionManager.registerMoveCommand.globalTouchHandler: Skipping hunter', i, 'because:', 
                        hunter ? 'hunter exists' : 'hunter is null', 
                        hunter && hunter.node ? 'node exists' : 'node is null', 
                        hunter && hunter.node && hunter.node.isValid ? 'node is valid' : 'node is invalid', 
                        (this.selectedTowers.length + i) < formationPositions.length ? 'has formation position' : 'no formation position');
                }
            }

            // 让所有选中的小精灵移动到各自的分散位置或建筑物身边
            for (let i = 0; i < this.selectedWisps.length; i++) {
                const wisp = this.selectedWisps[i];
                if (wisp && wisp.node && wisp.node.isValid) {
                    console.debug('SelectionManager.registerMoveCommand.globalTouchHandler: Processing wisp', i, 'movement');
                    if (clickedBuilding) {
                        // 如果点击在建筑物上，让小精灵移动到建筑物附近1的位置
                        console.debug('SelectionManager.registerMoveCommand.globalTouchHandler: Wisp moving to building', clickedBuilding.name, 'at (', clickedBuilding.worldPosition.x.toFixed(1), ',', clickedBuilding.worldPosition.y.toFixed(1), ')');
                        // 设置移动目标为建筑物附近1的位置，小精灵会在到达后自动依附
                        const buildingPos = clickedBuilding.worldPosition.clone();
                        // 计算到建筑物的方向向量，然后移动到距离建筑物1的位置
                        const direction = new Vec3();
                        Vec3.subtract(direction, worldPos, buildingPos);
                        console.debug('SelectionManager.registerMoveCommand.globalTouchHandler: Direction vector:', direction);
                        if (direction.length() > 0) {
                            direction.normalize();
                            // 移动到距离建筑物1的位置
                            const targetPos = new Vec3();
                            Vec3.scaleAndAdd(targetPos, buildingPos, direction, 1);
                            console.debug('SelectionManager.registerMoveCommand.globalTouchHandler: Setting wisp target to building proximity at (', targetPos.x.toFixed(1), ',', targetPos.y.toFixed(1), ')');
                            wisp.setManualMoveTargetPosition(targetPos);
                        } else {
                            // 如果点击位置就是建筑物位置，直接使用建筑物位置
                            console.debug('SelectionManager.registerMoveCommand.globalTouchHandler: Setting wisp target to building position at (', buildingPos.x.toFixed(1), ',', buildingPos.y.toFixed(1), ')');
                            wisp.setManualMoveTargetPosition(buildingPos);
                        }
                    } else if ((this.selectedTowers.length + this.selectedHunters.length + i) < formationPositions.length) {
                        // 否则，移动到目标位置
                        console.debug('SelectionManager.registerMoveCommand.globalTouchHandler: Moving wisp', i, 'to (', formationPositions[this.selectedTowers.length + this.selectedHunters.length + i].x.toFixed(1), ',', formationPositions[this.selectedTowers.length + this.selectedHunters.length + i].y.toFixed(1), ')');
                        wisp.setManualMoveTargetPosition(formationPositions[this.selectedTowers.length + this.selectedHunters.length + i]);
                    } else {
                        console.debug('SelectionManager.registerMoveCommand.globalTouchHandler: No formation position available for wisp', i);
                    }
                } else {
                    console.debug('SelectionManager.registerMoveCommand.globalTouchHandler: Wisp', i, 'is invalid');
                }
            }

            // 让所有选中的精灵剑士移动到各自的分散位置
            for (let i = 0; i < this.selectedSwordsmen.length; i++) {
                const swordsman = this.selectedSwordsmen[i];
                if (swordsman && swordsman.node && swordsman.node.isValid) {
                    if ((this.selectedTowers.length + this.selectedHunters.length + this.selectedWisps.length + i) < formationPositions.length) {
                        const targetPos = formationPositions[this.selectedTowers.length + this.selectedHunters.length + this.selectedWisps.length + i];
                        console.debug('SelectionManager.registerMoveCommand.globalTouchHandler: Moving swordsman', i, 'to (', targetPos.x.toFixed(1), ',', targetPos.y.toFixed(1), ')');
                        swordsman.setManualMoveTargetPosition(targetPos);
                    }
                }
            }

            // 移除移动命令监听
            console.debug('SelectionManager.registerMoveCommand.globalTouchHandler: Removing global touch handler');
            this.canvas.off(Node.EventType.TOUCH_END, this.globalTouchHandler, this);
            this.globalTouchHandler = null!;
            
            // 清除选择，取消高亮状态，确保每次只能移动一次
            console.debug('SelectionManager.registerMoveCommand.globalTouchHandler: Clearing selection');
            this.clearSelection();
            console.debug('SelectionManager.registerMoveCommand.globalTouchHandler: Handler completed');
        };

        // 不使用capture阶段监听，避免与onTouchEnd方法冲突
        console.debug('SelectionManager.registerMoveCommand: Adding global touch handler to canvas');
        this.canvas.on(Node.EventType.TOUCH_END, this.globalTouchHandler, this);
        console.debug('SelectionManager.registerMoveCommand: Method completed');
        console.debug('SelectionManager.registerMoveCommand: globalTouchHandler is now set:', !!this.globalTouchHandler);
    }
    
    /**
     * 查找指定位置的建筑物
     * @param worldPos 世界坐标位置
     * @returns 找到的建筑物节点，找不到返回null
     */
    private findBuildingAtPosition(worldPos: Vec3): Node | null {
        // 查找战争古树
        let treesNode = find('WarAncientTrees');
        if (treesNode) {
            const trees = treesNode.children || [];
            for (const tree of trees) {
                if (tree && tree.isValid && tree.active) {
                    const treeScript = tree.getComponent('WarAncientTree') as any;
                    if (treeScript && treeScript.isAlive && treeScript.isAlive()) {
                        const distance = Vec3.distance(worldPos, tree.worldPosition);
                        const collisionRadius = treeScript.collisionRadius || 50;
                        if (distance <= collisionRadius) {
                            return tree;
                        }
                    }
                }
            }
        }
        
        // 查找月亮井
        let wellsNode = find('MoonWells');
        if (wellsNode) {
            const wells = wellsNode.children || [];
            for (const well of wells) {
                if (well && well.isValid && well.active) {
                    const wellScript = well.getComponent('MoonWell') as any;
                    if (wellScript && wellScript.isAlive && wellScript.isAlive()) {
                        const distance = Vec3.distance(worldPos, well.worldPosition);
                        const collisionRadius = wellScript.collisionRadius || 40;
                        if (distance <= collisionRadius) {
                            return well;
                        }
                    }
                }
            }
        }
        
        return null;
    }

    /**
     * 检查是否有选中的小精灵
     */
    hasSelectedWisps(): boolean {
        return this.selectedWisps.length > 0;
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
        if (!node) {
            console.debug('SelectionManager.isUIElement: Node is null, returning false');
            return false;
        }

        const nodeName = node.name;
        console.debug('SelectionManager.isUIElement: Checking node:', nodeName);
        
        // 检查节点名称
        const lowerName = nodeName.toLowerCase();
        if (lowerName.includes('button') || 
            lowerName.includes('panel') || 
            lowerName.includes('label') ||
            lowerName.includes('selection') ||
            lowerName.includes('healthbar') ||
            lowerName.includes('damage') ||
            lowerName.includes('heal')) {
            console.debug('SelectionManager.isUIElement: Node', nodeName, 'is UI element due to name');
            return true;
        }

        // 检查是否是游戏对象（直接排除建筑物和单位）
        if (lowerName.includes('warancienttree') || 
            lowerName.includes('moonwell') ||
            lowerName.includes('arrower') ||
            lowerName.includes('enemy') ||
            lowerName.includes('wisp') ||
            lowerName.includes('hunter')) {
            console.debug('SelectionManager.isUIElement: Node', nodeName, 'is game object, returning false');
            return false;
        }

        // 检查父节点
        let parent = node.parent;
        while (parent) {
            const parentName = parent.name.toLowerCase();
            console.debug('SelectionManager.isUIElement: Checking parent:', parentName);
            
            if (parentName.includes('ui') || 
                parentName.includes('panel') ||
                parentName.includes('selection')) {
                console.debug('SelectionManager.isUIElement: Node', nodeName, 'is UI element due to parent', parentName);
                return true;
            }
            
            // 不再将所有Canvas子节点都判断为UI元素
            if (parentName === 'canvas') {
                // 检查节点本身是否有UITransform组件，并且不是游戏对象
                const uiTransform = node.getComponent(UITransform);
                console.debug('SelectionManager.isUIElement: Node', nodeName, 'has UITransform:', !!uiTransform);
                
                // 对于Canvas的直接子节点，只有明确的UI元素才返回true
                if (uiTransform) {
                    // 检查是否是UI元素的特定类型
                    const hasSprite = node.getComponent(Sprite);
                    const hasLabel = node.getComponent(Label);
                    const hasGraphics = node.getComponent(Graphics);
                    
                    console.debug('SelectionManager.isUIElement: Node', nodeName, 'has Sprite:', !!hasSprite, 'Label:', !!hasLabel, 'Graphics:', !!hasGraphics);
                    
                    // 如果只有Graphics组件，可能是范围显示或血条，需要进一步判断
                    if (hasGraphics && !hasSprite && !hasLabel) {
                        // 检查是否是血条或范围显示
                        if (nodeName.toLowerCase().includes('healthbar') || 
                            nodeName.toLowerCase().includes('range')) {
                            console.debug('SelectionManager.isUIElement: Node', nodeName, 'is UI element due to graphics component');
                            return true;
                        }
                    } else if (hasSprite || hasLabel) {
                        // 有Sprite或Label组件的通常是UI元素
                        console.debug('SelectionManager.isUIElement: Node', nodeName, 'is UI element due to sprite/label component');
                        return true;
                    }
                }
                break;
            }
            parent = parent.parent;
        }

        console.debug('SelectionManager.isUIElement: Node', nodeName, 'is not UI element, returning false');
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
     * 检查节点是否是女猎手节点
     */
    isHunterNode(node: Node | null): boolean {
        if (!node) return false;

        // 检查节点是否有Hunter组件
        const hunterScript = node.getComponent(Hunter);
        if (hunterScript) {
            return true;
        }

        // 检查父节点（女猎手可能是子节点）
        let parent = node.parent;
        while (parent) {
            const hunterScript = parent.getComponent(Hunter);
            if (hunterScript) {
                return true;
            }
            // 如果到达Hunters容器，停止查找
            if (parent.name === 'Hunters') {
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
            // 每次都重新查找TowerBuilder节点，不使用缓存，确保获取到的是正确的实例
            let towerBuilderNode = find('TowerBuilder');
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

            // 获取TowerBuilder组件
            const towerBuilder = towerBuilderNode.getComponent('TowerBuilder') as any;
            if (!towerBuilder) {
                if (Math.random() < 0.01) {
                    console.warn('SelectionManager: TowerBuilder component not found');
                }
                return false;
            }

            // 优先直接访问属性，而不是调用方法，确保获取到最新值
            if (towerBuilder.isBuildingMode !== undefined) {
                return towerBuilder.isBuildingMode === true;
            }
            
            // 如果没有属性，再尝试使用公共方法检查是否在建造模式
            if (towerBuilder.getIsBuildingMode && typeof towerBuilder.getIsBuildingMode === 'function') {
                return towerBuilder.getIsBuildingMode() === true;
            }
            
            return false;
        } catch (error) {
            console.error('SelectionManager: Error checking building mode:', error);
            return false;
        }
    }
    
    /**
     * 检查是否正在拖拽建筑物
     */
    isDraggingBuilding(): boolean {
        try {
            // 查找TowerBuilder节点
            let towerBuilderNode = find('TowerBuilder');
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
                return false;
            }

            // 获取TowerBuilder组件
            const towerBuilder = towerBuilderNode.getComponent('TowerBuilder') as any;
            if (!towerBuilder) {
                return false;
            }

            // 检查是否正在拖拽建筑物
            if (towerBuilder.isDraggingBuilding !== undefined) {
                return towerBuilder.isDraggingBuilding === true;
            }
            
            return false;
        } catch (error) {
            // 静默处理错误，避免影响正常流程
            return false;
        }
    }
}

