import i18next from 'i18next'
import { DOMCacheGetOrSet } from '../Cache/DOM'
import { updatePCoinCache } from '../PseudoCoinUpgrades'
import { Alert, Notification } from '../UpdateHTML'
import { isMobile, memoize } from '../Utility'
import { player, format } from '../Synergism' 

interface UpgradesList {
  upgradeId: number
  maxLevel: number
  name: string
  description: string
  internalName: string
  playerLevel: number
}

// 1. Manually defined upgrades with fixed descriptions
const localUpgradesData: UpgradesList[] = [
    { upgradeId: 1, maxLevel: 100, name: "Quark Boost", internalName: "QuarkGain", description: "Increase Quark gain permanently.", playerLevel: 0 },
    { upgradeId: 2, maxLevel: 100, name: "Exp Boost", internalName: "ExpGain", description: "Increase Experience gain.", playerLevel: 0 },
    { upgradeId: 3, maxLevel: 1, name: "Automation", internalName: "Automation", description: "Unlock advanced automation.", playerLevel: 0 },
    { upgradeId: 4, maxLevel: 10, name: "Golden Quarks", internalName: "GoldenQuarks", description: "Boost Golden Quark efficiency.", playerLevel: 0 }
];

const tab = document.querySelector<HTMLElement>('#pseudoCoins > #upgradesContainer')!
let activeUpgrade: UpgradesList | undefined

function setActiveUpgrade (upgrade: UpgradesList) {
  activeUpgrade = upgrade
  
  DOMCacheGetOrSet('pCoinUpgradeName').textContent = upgrade.name
  DOMCacheGetOrSet('description').textContent = upgrade.description
  
  // Set Icon with Fallback
  const icon = DOMCacheGetOrSet('pCoinUpgradeIcon');
  icon.setAttribute('src', `Pictures/PseudoShop/${upgrade.internalName}.png`);
  (icon as HTMLImageElement).onerror = () => icon.setAttribute('src', 'Pictures/PseudoShop/PseudoCoins.png');

  const buy = DOMCacheGetOrSet('buy')
  const currEffect = DOMCacheGetOrSet('pCoinEffectCurr')
  const nextEffect = DOMCacheGetOrSet('pCoinEffectNext')

  // Direct Calculation to avoid "undefined"
  const currentMult = (upgrade.internalName === "Automation") ? (upgrade.playerLevel > 0 ? "ON" : "OFF") : (1 + (upgrade.playerLevel * 0.1)).toFixed(2) + "x";
  const nextMult = (upgrade.internalName === "Automation") ? "ON" : (1 + ((upgrade.playerLevel + 1) * 0.1)).toFixed(2) + "x";

  currEffect.innerHTML = `Current: <span style="color: #00ff00">${currentMult}</span>`
  nextEffect.innerHTML = `Next: <span style="color: cyan">${nextMult}</span>`

  if (upgrade.playerLevel >= upgrade.maxLevel) {
    buy.setAttribute('disabled', '')
    buy.style.display = 'none'
    nextEffect.style.display = 'none'
  } else {
    buy.removeAttribute('disabled')
    buy.style.display = 'block'
    nextEffect.style.display = 'block'
    buy.innerHTML = "ACTIVATE (FREE)" 
  }

  DOMCacheGetOrSet('pCoinScalingCosts').textContent = "COST: FREE"
  DOMCacheGetOrSet('pCoinScalingEffect').textContent = "BONUS: ACTIVE"
}

async function purchaseUpgrade(upgrades: Map<number, UpgradesList>) {
  if (!activeUpgrade) return;

  const upgrade = upgrades.get(activeUpgrade.upgradeId)

  if (upgrade && upgrade.playerLevel < upgrade.maxLevel) {
    upgrade.playerLevel += 1;
    
    // Save directly to player object
    if (!player.pseudoCoinUpgrades) player.pseudoCoinUpgrades = {} as any;
    (player.pseudoCoinUpgrades as any)[upgrade.internalName] = upgrade.playerLevel;
    
    // Apply bonus to game engine
    updatePCoinCache(upgrade.internalName as any, upgrade.playerLevel);
    
    Notification(`${upgrade.name} upgraded!`);

    // Update the Grid UI
    const activeDiv = tab.querySelector(`.upgradeItem[data-id="${upgrade.upgradeId}"]`);
    if (activeDiv) {
        activeDiv.querySelector('p#a')!.textContent = `${upgrade.playerLevel}/${upgrade.maxLevel}`;
        if (upgrade.playerLevel === upgrade.maxLevel) activeDiv.querySelector('p#b')!.textContent = '✔️';
    }

    setActiveUpgrade(upgrade);
    updatePseudoCoins(); 
  }
}

const initializeUpgradeSubtab = memoize(() => {
  const grouped = new Map<number, UpgradesList>();
  
  localUpgradesData.forEach(u => {
      u.playerLevel = (player.pseudoCoinUpgrades as any)?.[u.internalName] ?? 0;
      grouped.set(u.upgradeId, u);
  });

  const grid = tab.querySelector('#upgradeGrid')!;
  grid.innerHTML = [...grouped.values()].map((u) => `
    <div data-id="${u.upgradeId}" class="upgradeItem" style="margin: 10px; border: 1px solid gold; padding: 10px; cursor: pointer; text-align: center; min-width: 80px;">
      <img src='Pictures/PseudoShop/${u.internalName}.png' style="width:40px; height:40px;" onerror="this.src='Pictures/PseudoShop/PseudoCoins.png'" />
      <p id="a" style="margin: 5px 0;">${u.playerLevel}/${u.maxLevel}</p>
      <p id="b" style="color: green;">${u.playerLevel === u.maxLevel ? '✔️' : ''}</p>
    </div>
  `).join('')

  grid.querySelectorAll<HTMLElement>('.upgradeItem').forEach((element) => {
    element.addEventListener('click', () => {
      const upgrade = grouped.get(Number(element.getAttribute('data-id')))
      if (upgrade) setActiveUpgrade(upgrade)
      grid.querySelectorAll('.upgradeItem').forEach(el => el.classList.remove('active'))
      element.classList.add('active')
    })
  });

  const buyBtn = DOMCacheGetOrSet('buy');
  const newBuyBtn = buyBtn.cloneNode(true);
  buyBtn.parentNode?.replaceChild(newBuyBtn, buyBtn);
  newBuyBtn.addEventListener('click', () => purchaseUpgrade(grouped));
})

export const toggleUpgradeSubtab = () => {
  initializeUpgradeSubtab()
  tab.style.display = 'flex'
  updatePseudoCoins()
}

export const clearUpgradeSubtab = () => {
  tab.style.display = 'none'
}

export const updatePseudoCoins = async () => {
  const coins = player.pseudoCoins || 0;
  const balance1 = tab.querySelector('#currentCoinBalance');
  const balance2 = DOMCacheGetOrSet('currentCoinBalance2');
  
  if (balance1) balance1.textContent = `PseudoCoins: ${format(coins, 0, true)}`;
  if (balance2) balance2.textContent = `PseudoCoins: ${format(coins, 0, true)}`;

  return coins;
}
