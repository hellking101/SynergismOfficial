import { type FUNDING_SOURCE, loadScript } from '@paypal/paypal-js'
import i18next from 'i18next'
import { isSynergismCC, platform, prod } from '../Config'
import { Alert, Notification } from '../UpdateHTML'
import { assert, memoize } from '../Utility'
import { products, subscriptionProducts } from './CartTab'
import {
  addToCart,
  calculateGrossPrice,
  clearCart,
  getPrice,
  getProductsInCart,
  getQuantity,
  removeFromCart
} from './CartUtil'
import { initializePayPal_Subscription } from './SubscriptionsSubtab'
import { updatePseudoCoins } from './UpgradesSubtab'

const tab = document.querySelector<HTMLElement>('#pseudoCoins > #cartContainer')!
const form = tab.querySelector('div.cartList')!

const checkoutStripe = form.querySelector<HTMLElement>('button#checkout')
const checkoutNowPayments = form.querySelector<HTMLElement>('button#checkout-nowpayments')
const tosSection = form.querySelector('section#tosSection')!
const radioTOSAgree = form.querySelector<HTMLInputElement>('section > input[type="radio"]')!
const totalCost = form.querySelector('p#totalCost')
const itemList = form.querySelector('#itemList')!

const formatter = Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD'
})

const initializeCheckoutTab = memoize(() => {
  itemList.insertAdjacentHTML(
    'afterend',
    products.map((product) => (`
      <div key="${product.id}">
      <input
          hidden
          name="${product.id}"
          value="${getQuantity(product.id)}"
          type="number"
        />
      </div>
    `)).join('')
  )

  async function submitCheckout (e: MouseEvent) {
    if (!radioTOSAgree.checked) {
      e.preventDefault()
      Notification('You must accept the terms of service first!')
      return
    }

    const fd = new FormData()

    for (const product of getProductsInCart()) {
      fd.set(product.id, `${product.quantity}`)
    }

    fd.set('tosAgree', radioTOSAgree.checked ? 'on' : 'off')

    checkoutStripe?.setAttribute('disabled', '')
    checkoutNowPayments?.setAttribute('disabled', '')

    function reset () {
      checkoutStripe?.removeAttribute('disabled')
      checkoutNowPayments?.removeAttribute('disabled')
    }

    let url: string

    if (e.target === checkoutStripe) {
      url = !prod
        ? 'https://synergism.cc'
        : 'https://synergism.cc'
    } else if (e.target === checkoutNowPayments) {
      url = 'https://synergism.cc'
    } else {
      Notification('You clicked on something that I don\'t know.')
      reset()
      return
    }

    fetch(url, {
      method: 'POST',
      body: fd
    }).then((response) => response.json())
      .then((json: { redirect: string; error: string }) => {
        if (json.redirect) {
          window.location.href = json.redirect
        } else {
          Notification(json.error)
        }
      })
      .catch((err: Error) => {
        console.error(`Error checking out (${url})`, err)

        if (isSynergismCC) {
          Alert(i18next.t('pseudoCoins.error.checkoutGeneric', { error: err.message }))
        } else {
          Alert(i18next.t('pseudoCoins.error.checkoutNotSynergismCC'))
        }
      })
      .finally(reset)
  }

  async function submitCheckoutSteam (_e: MouseEvent) {
    const { submitSteamMicroTxn } = await import('../steam/microtxn')

    const fd = new FormData()

    for (const product of getProductsInCart()) {
      fd.set(product.id, `${product.quantity}`)
    }

    fd.set('tosAgree', radioTOSAgree.checked ? 'on' : 'off')

    const success = await submitSteamMicroTxn(fd)

    if (success) {
      Notification('Transaction completed successfully!')
      clearCart()
      updateItemList()
      updateTotalPriceInCart()
    }
  }

  // Remove rainbow border highlight when TOS is clicked
  radioTOSAgree.addEventListener('change', () => {
    tosSection.classList.remove('rainbow-border-highlight')
  })

  const checkoutButtonsContainer = tab.querySelector<HTMLElement>('#checkout-buttons')!

  if (platform !== 'steam') {
    checkoutStripe?.addEventListener('click', submitCheckout)
    checkoutNowPayments?.addEventListener('click', submitCheckout)

    initializePayPal_OneTime('#checkout-paypal')
  } else {
    // Hide Stripe/PayPal/NowPayments checkout buttons
    checkoutButtonsContainer.querySelectorAll('*').forEach((el) => el.classList.add('none'))

    // Add Steam checkout button
    const checkoutSteam = document.createElement('button')
    checkoutSteam.id = 'checkout-steam'
    checkoutSteam.type = 'submit'
    checkoutSteam.textContent = 'Checkout with Steam'
    checkoutSteam.addEventListener('click', (ev) => {
      checkoutSteam.disabled = true
      submitCheckoutSteam(ev).finally(() => checkoutSteam.disabled = false)
    })
    checkoutButtonsContainer.appendChild(checkoutSteam)
  }

  // --- ADD DEBUG FREE COINS BUTTON HERE ---
  if (!document.getElementById('free-coins-btn')) {
    const freeCoinsBtn = document.createElement('button');
    freeCoinsBtn.id = 'free-coins-btn';
    freeCoinsBtn.textContent = '🎁 DEBUG: +1000 Coins';
    // Match the game's style but with a distinct color
    freeCoinsBtn.style.cssText = 'background: #2e7d32; color: white; margin-top: 10px; padding: 12px; cursor: pointer; width: 100%; border-radius: 4px; border: 1px solid #4caf50; font-weight: bold; font-family: inherit;';

    freeCoinsBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await updatePseudoCoins(1000);
        Notification('Success: 1000 Coins added to local save.');
        updateTotalPriceInCart();
    });

    checkoutButtonsContainer.appendChild(freeCoinsBtn);
  }
})

function addItem (e: MouseEvent) {
  e.preventDefault()
  const key = (e.target as HTMLButtonElement).closest('div[key]')?.getAttribute('key')
  if (key == null || !products.some((product) => product.id === key)) {
    Alert('Stop touching the HTML! Validation is active.')
    return
  } else if (subscriptionProducts.some((product) => getQuantity(product.id) !== 0)) {
    Alert('You can only subscribe to 1 subscription tier!')
    return
  }
  addToCart(key)
  updateItemList()
  updateTotalPriceInCart()
}

function removeItem (e: MouseEvent) {
  e.preventDefault()
  const key = (e.target as HTMLButtonElement).closest('div[key]')?.getAttribute('key')
  if (key == null || !products.some((product) => product.id === key)) {
    Alert('Stop touching the HTML! Validation is active.')
    return
  }
  removeFromCart(key)
  updateItemList()
  updateTotalPriceInCart()
}

function updateItemList () {
  itemList.querySelectorAll<HTMLButtonElement>('.cartListElementContainer > button').forEach((button) => {
    button.removeEventListener('click', button.id === 'add' ? addItem : removeItem)
  })

  itemList.innerHTML = getProductsInCart().map((product) => (`
    <div class="cartListElementContainer" key="${product.id}">
      <img src="Pictures/Default/BackedQuark.png" width="32px" height="32px" alt="Backed Quark" />
      <span class="cartListElement">${product.name}</span>
      <span style="color:cyan">
        ${product.quantity > 0 ? `x${product.quantity}` : ''}
      </span>
      <button id="add" ${product.subscription ? 'disabled' : ''}>+</button>
      <button id="sub">-</button>
    </div>
  `)).join('')

  itemList.querySelectorAll<HTMLButtonElement>('.cartListElementContainer > button').forEach((button) => {
    button.addEventListener('click', button.id === 'add' ? addItem : removeItem)
  })
}

export const toggleCheckoutTab = () => {
  initializeCheckoutTab()
  updateTotalPriceInCart()
  updateItemList()
  tab.style.display = 'flex'
}

export const clearCheckoutTab = () => {
  tab.style.display = 'none'
  itemList.querySelectorAll<HTMLButtonElement>('.cartListElementContainer > button').forEach((button) => {
    button.removeEventListener('click', button.id === 'add' ? addItem : removeItem)
  })
}

const updateTotalPriceInCart = () => {
  totalCost!.textContent = `${formatter.format(calculateGrossPrice(getPrice() / 100))} USD`
}

async function initializePayPal_OneTime (selector: string | HTMLElement) {
  assert(platform !== 'steam', 'Cannot use PayPal on steam')
  const paypal = await loadScript({
    clientId: 'AS1HYTVcH3Kqt7IVgx7DkjgG8lPMZ5kyPWamSBNEowJ-AJPpANNTJKkB_mF0C4NmQxFuWQ9azGbqH2Gr',
    disableFunding: ['paylater', 'credit', 'card'] satisfies FUNDING_SOURCE[],
    enableFunding: ['venmo'] satisfies FUNDING_SOURCE[],
    dataNamespace: 'paypal_one_time'
  })

  paypal?.Buttons?.({
    style: {
      shape: 'rect',
      layout: 'vertical',
      color: 'gold',
      label: 'paypal'
    },
    async createOrder () {
        // PayPal logic follows...
    }
  })
}
