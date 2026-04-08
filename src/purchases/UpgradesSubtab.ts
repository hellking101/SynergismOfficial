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
import { player, format } from '../Synergism' 

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

// 1. Manually defined upgrades using internal names the game engine recognizes
const localUpgradesData: UpgradesList[] = [
    { upgradeId: 1, maxLevel: 100, name: "Quark Boost", internalName: "QuarkGain", description: "Increase Quark gain permanently.", level: [], cost: [], playerLevel: 0 },
    { upgradeId: 2, maxLevel: 100, name: "Exp Boost", internalName: "ExpGain", description: "Increase Experience gain.", level: [], cost: [], playerLevel: 0 },
    { upgradeId: 3, maxLevel: 1, name: "Automation", internalName: "Automation", description: "Unlock advanced automation.", level: [], cost: [], playerLevel: 0 }
];

const tab = document.querySelector<HTMLElement>('#pseudoCoins > #upgradesContainer')!
let activeUpgrade: UpgradesList | undefined

function setActiveUpgrade (upgrade: UpgradesList) {
  activeUpgrade = upgrade
  
  DOMCacheGetOrSet('pCoinUpgradeName').textContent = upgrade.name
  DOMCacheGetOrSet('description').textContent = upgrade.description
  DOMCacheGetOrSet('pCoinUpgradeIcon').setAttribute(
    'src',
    `Pictures/PseudoShop/${upgrade.internalName}.png`
  )

  const buy = DOMCacheGetOrSet('buy')
  const currEffect = DOMCacheGetOrSet('pCoinEffectCurr')
  const nextEffect = DOMCacheGetOrSet('pCoinEffectNext')

  // Pulling logic directly from the game's effect engine
  const currentEffectText = displayPCoinEffect(upgrade.internalName, upgrade.playerLevel);
  const nextEffectText = displayPCoinEffect(upgrade.internalName, upgrade.playerLevel + 1);

  currEffect.innerHTML = `Current: ${currentEffectText ?? 'Active'}`
  nextEffect.innerHTML = `Next: ${nextEffectText ?? 'Maxed'}`

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
    buy.innerHTML = "ACTIVATE FOR FREE" 
  }

  const info = showCostAndEffect(upgrade.internalName)
  costs.textContent = "FREE"
  effects.textContent = info.effect || "Scaling Active"
}

async function purchaseUpgrade(upgrades: Map<number, UpgradesList>) {
  if (!activeUpgrade) {
    Alert('Select an upgrade first!')
    return
  }

  const upgrade = upgrades.get(activeUpgrade.upgradeId)

  if (upgrade && upgrade.playerLevel < upgrade.maxLevel) {
    // Increment level
    upgrade.playerLevel += 1;
    
    // Save to the player's local save file
    if (!player.pseudoCoinUpgrades) {
        player.pseudoCoinUpgrades = {} as any;
    }
    (player.pseudoCoinUpgrades as any)[upgrade.internalName] = upgrade.playerLevel;
    
    // Update game cache to apply the bonus immediately
    updatePCoinCache(upgrade.internalName, upgrade.playerLevel);
    
    Notification(`Success! ${upgrade.name} is now level ${upgrade.playerLevel}`);

    // Update UI elements
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
      // Sync with existing player save
      const savedLevel = (player.pseudoCoinUpgrades as any)?.[u.internalName] ?? 0;
      u.playerLevel = savedLevel;
      grouped.set(u.upgradeId, u);
  });

  tab.querySelector('#upgradeGrid')!.innerHTML = [...grouped.values()].map((u) => `
    <div
      data-id="${u.upgradeId}"
      class="upgradeItem"
      style="margin: 10px; border: 1px solid gold; padding: 10px; cursor: pointer; text-align: center; border-radius: 4px;"
    >
      <img src='Pictures/PseudoShop/${u.internalName}.png' alt='${u.internalName}' style="width:40px; height:40px;" />
      <p id="a" style="margin: 5px 0;">${u.playerLevel}/${u.maxLevel}</p>
      <p id="b" style="color: green;">${u.playerLevel === u.maxLevel ? '✔️' : ''}</p>
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

  // Setup the button replacement to avoid old server listeners
  const buyBtn = DOMCacheGetOrSet('buy');
  const newBuyBtn = buyBtn.cloneNode(true);
  buyBtn.parentNode?.replaceChild(newBuyBtn, buyBtn);
  newBuyBtn.addEventListener('click', () => purchaseUpgrade(grouped));
})

export const toggleUpgradeSubtab = () => {
  initializeUpgradeSubtab()
  tab.style.display = 'flex'
  updatePseudoCoins() // Ensure coins update on tab switch
}

export const clearUpgradeSubtab = () => {
  tab.style.display = 'none'
}

export const updatePseudoCoins = async () => {
  // Directly pull from local save file
  const coins = player.pseudoCoins || 0;
  
  const display = tab.querySelector('#pseudoCoinAmounts > #currentCoinBalance');
  if (display) display.innerHTML = `PseudoCoins: ${format(coins, 0, true)}`;
  
  const display2 = DOMCacheGetOrSet('currentCoinBalance2');
  if (display2) display2.innerHTML = `PseudoCoins: ${format(coins, 0, true)}`;

  return coins;
}
