import i18next from 'i18next'
import { DOMCacheGetOrSet } from '../Cache/DOM'
import {
  displayPCoinEffect,
  type PseudoCoinUpgradeNames,
  showCostAndEffect,
  updatePCoinCache
} from '../PseudoCoinUpgrades'
import { Alert, Notification } from '../UpdateHTML'
import { isMobile, memoize } from '../Utility'
import { player } from '../Synergism' 

interface UpgradesList {
  upgradeId: number
  maxLevel: number
  name: string
  description: string
  internalName: PseudoCoinUpgradeNames
  level: number[]
  cost: number[]
  playerLevel: number
}

// 1. Manually defined upgrades - Syncs with the game's internal names
const localUpgradesData: UpgradesList[] = [
    { upgradeId: 1, maxLevel: 100, name: "Quark Boost", internalName: "QuarkGain", description: "Increase Quark gain permanently.", level: [], cost: [], playerLevel: 0 },
    { upgradeId: 2, maxLevel: 100, name: "Exp Boost", internalName: "ExpGain", description: "Increase Experience gain.", level: [], cost: [], playerLevel: 0 },
    { upgradeId: 3, maxLevel: 1, name: "Automation", internalName: "Automation", description: "Unlock advanced automation.", level: [], cost: [], playerLevel: 0 },
    { upgradeId: 4, maxLevel: 10, name: "Golden Quarks", internalName: "GoldenQuarks", description: "Boost Golden Quark efficiency.", level: [], cost: [], playerLevel: 0 }
];

const tab = document.querySelector<HTMLElement>('#pseudoCoins > #upgradesContainer')!
let activeUpgrade: UpgradesList | undefined

function setActiveUpgrade (upgrade: UpgradesList) {
  activeUpgrade = upgrade
  
  DOMCacheGetOrSet('pCoinUpgradeName').textContent = upgrade.name
  DOMCacheGetOrSet('description').textContent = upgrade.description
  DOMCacheGetOrSet('pCoinUpgradeIcon').setAttribute(
    'src',
    `Pictures/PseudoShop/${upgrade.internalName ?? 'PseudoCoins'}.png`
  )

  const buy = DOMCacheGetOrSet('buy')
  const currEffect = DOMCacheGetOrSet('pCoinEffectCurr')
  const nextEffect = DOMCacheGetOrSet('pCoinEffectNext')

  currEffect.innerHTML = `Current: ${displayPCoinEffect(upgrade.internalName, upgrade.playerLevel)}`
  nextEffect.innerHTML = `Next: ${displayPCoinEffect(upgrade.internalName, upgrade.playerLevel + 1)}`

  const costs = DOMCacheGetOrSet('pCoinScalingCosts')
  const effects = DOMCacheGetOrSet('pCoinScalingEffect')

  if (upgrade.playerLevel >= upgrade.maxLevel) {
    buy.setAttribute('disabled', '')
    buy.style.display = 'none'
    nextEffect.style.display = 'none'
  } else {
    buy.removeAttribute('disabled')
    buy.style.display = 'block'
    nextEffect.style.display = 'block'
    buy.innerHTML = "ACTIVATE UPGRADE (FREE)" 
  }

  const info = showCostAndEffect(upgrade.internalName)
  costs.textContent = "FREE"
  effects.textContent = info.effect
}

async function purchaseUpgrade(upgrades: Map<number, UpgradesList>) {
  if (!activeUpgrade) {
    Alert('Click on an upgrade to activate it.')
    return
  }

  const upgrade = upgrades.get(activeUpgrade.upgradeId)

  if (upgrade && upgrade.playerLevel < upgrade.maxLevel) {
    // Increment local level
    upgrade.playerLevel += 1;
    
    // --- PERMANENT SAVE LOGIC ---
    // 1. Ensure the shop object exists in the player's save
    if (!player.pseudoCoinUpgrades) {
        player.pseudoCoinUpgrades = {} as any;
    }
    
    // 2. Write the new level to the actual player save file
    // This ensures it stays after refresh
    (player.pseudoCoinUpgrades as any)[upgrade.internalName] = upgrade.playerLevel;
    
    // 3. Update the game's internal cache so the bonus is applied immediately
    updatePCoinCache(upgrade.internalName, upgrade.playerLevel);
    
    Notification(`${upgrade.name} upgraded to level ${upgrade.playerLevel}! Changes saved.`);

    // Update UI
    const activeEl = tab.querySelector('#upgradeGrid > .active');
    if (activeEl) {
        activeEl.querySelector('p#a')!.textContent = `${upgrade.playerLevel}/${upgrade.maxLevel}`;
        activeEl.querySelector('p#b')!.textContent = upgrade.playerLevel === upgrade.maxLevel ? '✔️' : '';
    }

    setActiveUpgrade(upgrade);
    updatePseudoCoins(); 
  }
}

const initializeUpgradeSubtab = memoize(() => {
  const grouped = new Map<number, UpgradesList>();
  
  localUpgradesData.forEach(u => {
      // READ FROM SAVE: Get the level from the player object on load
      const savedLevel = (player.pseudoCoinUpgrades as any)?.[u.internalName] ?? 0;
      u.playerLevel = savedLevel;
      
      grouped.set(u.upgradeId, u);
  });

  tab.querySelector('#upgradeGrid')!.innerHTML = [...grouped.values()].map((u) => `
    <div
      data-id="${u.upgradeId}"
      class="upgradeItem"
      style="margin: 15px; border: 2px solid #ffd700; padding: 10px; cursor: pointer; background: rgba(0,0,0,0.5); text-align: center; border-radius: 8px;"
    >
      <img src='Pictures/PseudoShop/${u.internalName}.png' alt='${u.internalName}' style="width:48px; height:48px;" />
      <p id="a" style="margin: 5px 0 0 0; font-weight: bold;">${u.playerLevel}/${u.maxLevel}</p>
      <p id="b" style="color: #00ff00;">${u.playerLevel === u.maxLevel ? '✔️' : ''}</p>
    </div>
  `).join('')

  const upgradesInGrid = tab.querySelectorAll<HTMLElement>('#upgradeGrid > div[data-id]')
  upgradesInGrid.forEach((element) => {
    element.addEventListener('click', () => {
      const upgradeId = Number(element.getAttribute('data-id'))
      const upgrade = grouped.get(upgradeId)
      if (upgrade) {
        setActiveUpgrade(upgrade)
      }
      upgradesInGrid.forEach((u) => u.classList.remove('active'))
      element.classList.add('active')
    })
  })

  // Setup the buy button click
  const buyBtn = DOMCacheGetOrSet('buy');
  const newBuyBtn = buyBtn.cloneNode(true);
  buyBtn.parentNode?.replaceChild(newBuyBtn, buyBtn);
  newBuyBtn.addEventListener('click', () => purchaseUpgrade(grouped));
})

export const toggleUpgradeSubtab = () => {
  initializeUpgradeSubtab()
  tab.style.display = 'flex'
}

export const clearUpgradeSubtab = () => {
  tab.style.display = 'none'
}

export const updatePseudoCoins = async () => {
  const coins = player.pseudoCoins || 0;
  const display = tab.querySelector('#pseudoCoinAmounts > #currentCoinBalance');
  if (display) display.innerHTML = `PseudoCoins: ${Intl.NumberFormat().format(coins)}`;
  
  const display2 = DOMCacheGetOrSet('currentCoinBalance2');
  if (display2) display2.innerHTML = `PseudoCoins: ${Intl.NumberFormat().format(coins)}`;

  return coins;
}
Use code with caution.Why this version is better:
