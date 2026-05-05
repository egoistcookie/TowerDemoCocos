import { find, Node } from 'cc';
import { getWatchTowerFamilyScript } from './WatchTowerFamily';

/**
 * 投矛手穿透攻击：收集与 Enemy.findTargetInRange 一致的可攻击我方单位节点（用于线段穿透检测）。
 */
export function gatherSpearPierceCandidateNodes(): Node[] {
    const allTargets: Node[] = [];

    const stoneWallsNode = find('Canvas/StoneWalls');
    if (stoneWallsNode) {
        for (const wall of stoneWallsNode.children) {
            if (wall?.active && wall.isValid) {
                const wallScript = wall.getComponent('StoneWall') as any;
                if (wallScript?.isAlive?.()) {
                    if (wallScript.isSpikeTrapActive?.()) {
                        continue;
                    }
                    allTargets.push(wall);
                }
            }
        }
    }

    const watchTowersNode = find('Canvas/WatchTowers');
    if (watchTowersNode) {
        for (const tower of watchTowersNode.children) {
            if (tower?.active && tower.isValid) {
                const towerScript = getWatchTowerFamilyScript(tower);
                if (towerScript?.isAlive?.()) {
                    allTargets.push(tower);
                }
            }
        }
    }

    const iceTowersNode = find('Canvas/IceTowers');
    if (iceTowersNode) {
        for (const tower of iceTowersNode.children) {
            if (tower?.active && tower.isValid) {
                const towerScript = tower.getComponent('IceTower') as any;
                if (towerScript?.isAlive?.()) {
                    allTargets.push(tower);
                }
            }
        }
    }

    const thunderTowersNode = find('Canvas/ThunderTowers');
    if (thunderTowersNode) {
        for (const tower of thunderTowersNode.children) {
            if (tower?.active && tower.isValid) {
                const towerScript = tower.getComponent('ThunderTower') as any;
                if (towerScript?.isAlive?.()) {
                    allTargets.push(tower);
                }
            }
        }
    }

    const towersNode = find('Canvas/Towers');
    if (towersNode) {
        for (const tower of towersNode.children) {
            if (tower?.active && tower.isValid) {
                const arrowerScript = tower.getComponent('Arrower') as any;
                const priestScript = tower.getComponent('Priest') as any;
                if (
                    (arrowerScript?.isAlive?.()) ||
                    (priestScript?.isAlive?.())
                ) {
                    allTargets.push(tower);
                }
            }
        }
    }

    const eagleArchersNode = find('Canvas/EagleArchers');
    if (eagleArchersNode) {
        for (const unit of eagleArchersNode.children) {
            if (unit?.active && unit.isValid) {
                const s = unit.getComponent('EagleArcher') as any;
                if (s?.isAlive?.()) {
                    allTargets.push(unit);
                }
            }
        }
    }

    const huntersNode = find('Canvas/Hunters');
    if (huntersNode) {
        for (const hunter of huntersNode.children) {
            if (hunter?.active && hunter.isValid) {
                const hunterScript = hunter.getComponent('Hunter') as any;
                if (hunterScript?.isAlive?.()) {
                    allTargets.push(hunter);
                }
            }
        }
    }

    const magesNode = find('Canvas/Mages') || find('Mages');
    if (magesNode) {
        for (const mage of magesNode.children) {
            if (mage?.active && mage.isValid) {
                const mageScript = mage.getComponent('Mage') as any;
                if (mageScript?.isAlive?.()) {
                    allTargets.push(mage);
                }
            }
        }
    }

    const swordsmenNode = find('Canvas/ElfSwordsmans');
    if (swordsmenNode) {
        for (const swordsman of swordsmenNode.children) {
            if (swordsman?.active && swordsman.isValid) {
                const swordsmanScript = swordsman.getComponent('ElfSwordsman') as any;
                if (swordsmanScript?.isAlive?.()) {
                    allTargets.push(swordsman);
                }
            }
        }
    }

    const treesNode = find('Canvas/WarAncientTrees');
    if (treesNode) {
        for (const tree of treesNode.children) {
            if (tree?.active && tree.isValid) {
                const treeScript = tree.getComponent('WarAncientTree') as any;
                if (treeScript?.isAlive?.()) {
                    allTargets.push(tree);
                }
            }
        }
    }

    const hallsNode = find('Canvas/HunterHalls');
    if (hallsNode) {
        for (const hall of hallsNode.children) {
            if (hall?.active && hall.isValid) {
                const hallScript = hall.getComponent('HunterHall') as any;
                if (hallScript?.isAlive?.()) {
                    allTargets.push(hall);
                }
            }
        }
    }

    const mageTowersNode = find('Canvas/MageTowers');
    if (mageTowersNode) {
        for (const tower of mageTowersNode.children) {
            if (tower?.active && tower.isValid) {
                const towerScript = tower.getComponent('MageTower') as any;
                if (towerScript?.isAlive?.()) {
                    allTargets.push(tower);
                }
            }
        }
    }

    const swordsmanHallsNode = find('Canvas/SwordsmanHalls');
    if (swordsmanHallsNode) {
        for (const hall of swordsmanHallsNode.children) {
            if (hall?.active && hall.isValid) {
                const hallScript = hall.getComponent('SwordsmanHall') as any;
                if (hallScript?.isAlive?.()) {
                    allTargets.push(hall);
                }
            }
        }
    }

    const churchesNode = find('Canvas/Churches');
    if (churchesNode) {
        for (const church of churchesNode.children) {
            if (church?.active && church.isValid) {
                const churchScript = church.getComponent('Church') as any;
                if (churchScript?.isAlive?.()) {
                    allTargets.push(church);
                }
            }
        }
    }

    const bearsNode = find('Canvas/Bears');
    if (bearsNode) {
        for (const bear of bearsNode.children) {
            if (bear?.active && bear.isValid) {
                const bearScript = bear.getComponent('Bear') as any;
                if (bearScript?.isAlive?.() && !bearScript.isDead && !bearScript.isDestroyed) {
                    allTargets.push(bear);
                }
            }
        }
    }

    const eaglesNode = find('Canvas/Eagles') || find('Eagles');
    if (eaglesNode) {
        for (const eagle of eaglesNode.children) {
            if (eagle?.active && eagle.isValid) {
                const eagleScript = eagle.getComponent('Eagle') as any;
                if (eagleScript?.isAlive?.()) {
                    allTargets.push(eagle);
                }
            }
        }
    }

    const crystal = find('Canvas/Crystal') || find('Crystal');
    if (crystal?.isValid) {
        const crystalScript = crystal.getComponent('Crystal') as any;
        if (crystalScript?.isAlive?.()) {
            allTargets.push(crystal);
        }
    }

    return allTargets;
}
