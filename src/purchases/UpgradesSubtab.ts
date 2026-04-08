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
import { player } from '../Synergism' // Ensure player is imported

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

// 1. Manually defined upgrades so the page isn't blank
const localUpgradesData: UpgradesList[] = [
    { upgradeId: 1, maxLevel: 10, name: "Quark Boost", internalName: "QuarkGain", description: "Increase Quark gain permanently.", level: [1,2,3,4,5,6,7,8,9,10], cost: [0,0,0,0,0,0,0,0,0,0], playerLevel: 0 },
    { upgradeId: 2, maxLevel: 5, name: "Exp Boost", internalName: "ExpGain", description: "Increase Experience gain.", level: [1,2,3,4,5], cost: [0,0,0,0,0], playerLevel: 0 },
    { upgradeId: 3, maxLevel: 1, name: "Auto-Buy", internalName: "Automation", description: "Unlock advanced automation.", level: [1], cost: [0], playerLevel: 0 }
];

const tab = document.querySelector<HTMLElement>('#pseudoCoins > #upgradesContainer')!
let activeUpgrade: UpgradesList | undefined

function setActiveUpgrade (upgrade: UpgradesList) {
  activeUpgrade = upgrade
  const name = upgrade.name; // Simplified for local use

  DOMCacheGetOrSet('pCoinUpgradeName').textContent = name
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

  if (upgrade.playerLevel === upgrade.maxLevel) {
    buy.setAttribute('disabled', '')
    buy.style.display = 'none'
    nextEffect.style.display = 'none'
  } else {
    buy.removeAttribute('disabled')
    buy.style.display = 'block'
    nextEffect.style.display = 'block'
    buy.innerHTML = "GET FOR FREE" 
  }

  const info = showCostAndEffect(upgrade.internalName)
  costs.textContent = "FREE"
  effects.textContent = info.effect
}

// 2. Modified to work locally without server requests
async function purchaseUpgrade(upgrades: Map<number, UpgradesList>) {
  if (!activeUpgrade) {
    Alert('Click on an upgrade to buy it.')
    return
  }

  const upgrade = upgrades.get(activeUpgrade.upgradeId)

  if (upgrade && upgrade.playerLevel < upgrade.maxLevel) {
    // Increment level locally
    upgrade.playerLevel += 1;
    
    // Update game cache so the effect actually works
    updatePCoinCache(upgrade.internalName, upgrade.playerLevel);
    
    Notification(`Upgraded ${upgrade.name} to level ${upgrade.playerLevel}!`);

    // Update UI elements
    const activeEl = tab.querySelector('#upgradeGrid > .active');
    if (activeEl) {
        activeEl.querySelector('p#a')!.textContent = `${upgrade.playerLevel}/${upgrade.maxLevel}`;
        activeEl.querySelector('p#b')!.textContent = upgrade.playerLevel === upgrade.maxLevel ? '✔️' : '';
    }

    setActiveUpgrade(upgrade);
    updatePseudoCoins(); // Refresh display
  }
}

const initializeUpgradeSubtab = memoize(() => {
  const grouped = new Map<number, UpgradesList>();
  
  // Load local data into the map
  localUpgradesData.forEach(u => {
      // Sync with player's actual save if possible
      // Assuming player.pseudoCoinUpgrades[u.internalName] exists
      grouped.set(u.upgradeId, u);
  });

  tab.querySelector('#upgradeGrid')!.innerHTML = [...grouped.values()].map((u) => `
    <div
      data-id="${u.upgradeId}"
      data-key="${u.name}"
      class="upgradeItem"
      style="margin: 20px; border: 1px solid gold; padding: 10px; cursor: pointer;"
    >
      <img src='Pictures/PseudoShop/${u.internalName}.png' alt='${u.internalName}' style="width:50px; height:50px;" />
      <p id="a">${u.playerLevel}/${u.maxLevel}</p>
      <p id="b">${u.playerLevel === u.maxLevel ? '✔️' : ''}</p>
    </div>
  `).join('')

  const upgradesInGrid = tab.querySelectorAll<HTMLElement>('#upgradeGrid > div[data-id]')
  upgradesInGrid.forEach((element) => {
    element.addEventListener('click', (e) => {
      const upgradeId = Number(element.getAttribute('data-id'))
      const upgrade = grouped.get(upgradeId)
      if (upgrade) {
        setActiveUpgrade(upgrade)
      }
      upgradesInGrid.forEach((u) => u.classList.remove('active'))
      element.classList.add('active')
    })
  })

  // Replace old listener to use our new local purchase function
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

// 3. Modified to show local coin balance only
export const updatePseudoCoins = async () => {
  const coins = player.pseudoCoins || 0;
  const display = tab.querySelector('#pseudoCoinAmounts > #currentCoinBalance');
  if (display) display.innerHTML = `PseudoCoins: ${Intl.NumberFormat().format(coins)}`;
  
  const display2 = DOMCacheGetOrSet('currentCoinBalance2');
  if (display2) display2.innerHTML = `PseudoCoins: ${Intl.NumberFormat().format(coins)}`;

  return coins;
}
Use code with caution.
