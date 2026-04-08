import i18next from 'i18next'
import { DOMCacheGetOrSet } from '../Cache/DOM'
import { getOwnedLotus, getUsedLotus } from '../Login'
import { format, player } from '../Synergism'
import { Alert, Confirm, Notification } from '../UpdateHTML'
import { memoize } from '../Utility'
import { updatePseudoCoins } from './UpgradesSubtab'

interface ConsumableListItems {
  name: string
  description: string
  internalName: string
  length: string
  cost: number
}

type TimeSkipCategories = 'GLOBAL' | 'ASCENSION' | 'AMBROSIA'

const tab = document.querySelector<HTMLElement>('#pseudoCoins > #consumablesSection')!

// Manually defined Lotus items so they work without the synergism.cc server
const localLotusItems: ConsumableListItems[] = [
  { name: "Small Lotus Box", description: "Contains 1 Lotus.", internalName: "LOTUS_1", length: "1", cost: 100 },
  { name: "Medium Lotus Box", description: "Contains 10 Lotuses.", internalName: "LOTUS_10", length: "10", cost: 900 },
  { name: "Large Lotus Box", description: "Contains 100 Lotuses.", internalName: "LOTUS_100", length: "100", cost: 8000 }
]

const initializeConsumablesTab = memoize(() => {
    // Update coin count on load
    updatePseudoCoins()

    const grid = tab.querySelector('#consumablesGrid')!
    grid.innerHTML = `
    <div id="topRowConsumables">
        ${createLotusHTML(localLotusItems)}
    </div>
    `
    
    // Setup the click listeners for Lotus buttons
    tab.querySelectorAll('.lotusOptions div > button').forEach((element) => {
        const parent = element.parentElement!
        const key = parent.getAttribute('data-key')!
        const cost = parseInt(parent.getAttribute('data-cost')!)
        const name = parent.getAttribute('data-name')!
        const amount = parseInt(parent.getAttribute('data-amount')!)

        element.addEventListener('click', async () => {
            const confirmed = await Confirm(`Buy ${name} for ${cost} PseudoCoins?`)
            
            if (!confirmed) return;

            // Check if player has enough coins
            if (player.pseudoCoins < cost) {
                return Alert("You don't have enough PseudoCoins!");
            }

            // --- LOCAL IMPLEMENTATION (No Server Needed) ---
            // 1. Subtract Coins
            await updatePseudoCoins(-cost);
            
            // 2. Add Lotus to save file
            player.lotus += amount;
            
            Notification(`Successfully purchased ${amount} Lotus!`);
            
            // 3. Update the UI
            updateLotusDisplay();
        })
    })

    updateLotusDisplay()
})

const createLotusHTML = (lotusItems: ConsumableListItems[]) => {
  const orderedLotus = lotusItems.sort((a, b) => +a.length - +b.length)
  return `
    <div class="lotusContainer purchaseConsumableContainer" style="width: 100%">
      <div class="iconAndNameContainer">
        <img src='Pictures/PseudoShop/LOTUS.png' alt='Lotus Box' />
        <p class="gradientText lotusGradient">Lotus Flower</p>
      </div>
      <div style="padding:5px;">
        <div class="lotusHeaderText">
          <p id="lotusOwned">Owned: ${format(player.lotus, 0, true)}</p>
          <p id="lotusUsed">Lifetime: ${format(getUsedLotus(), 0, true)}</p>
        </div>
        <p style="text-align: center; min-height: 55px">Purchase Lotus to boost your progression!</p>
      </div>
      <div class="lotusOptions" style="display: flex; justify-content: space-around;">
        ${
    orderedLotus.map((u) => `
          <div data-key="${u.internalName}" data-cost="${u.cost}" data-name="${u.name}" data-amount="${u.length}">
            <button class="consumablePurchaseBtn" style="width: 190px; cursor: pointer;"> 
              <p style="text-align: center; width: 180px">
                Buy ${u.length} for ${u.cost} Coins
              </p>
            </button>
          </div>
        `).join('')
  }
      </div>
    </div>
  `
}

export const toggleConsumablesTab = () => {
  initializeConsumablesTab()
  tab.style.display = 'flex'
}

export const clearConsumablesTab = () => {
  tab.style.display = 'none'
}

export const updateLotusDisplay = () => {
  const ownedEl = DOMCacheGetOrSet('lotusOwned');
  const usedEl = DOMCacheGetOrSet('lotusUsed');
  
  if (ownedEl) ownedEl.textContent = `Owned: ${format(player.lotus, 0, true)}`;
  if (usedEl) usedEl.textContent = `Lifetime: ${format(getUsedLotus(), 0, true)}`;
}
