import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { getMealErrors } from '../src/utils/menu.js'
import { getMenu, saveMeal, notifyMenuChanged } from '../src/menuApi.js'

const originalFetch = globalThis.fetch
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
const validMeal = {
  name: 'Chicken rice', description: 'Rice and vegetables', price: '75.00', available: true,
}
const savedMeal = {
  menu_item_id: 1, name: 'Chicken rice', description: 'Rice and vegetables',
  price: '75.00', is_available: true,
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: () => 'staff-token', setItem: () => {} },
  })
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { dispatchEvent: () => true },
  })
  globalThis.fetch = async () => {
    throw new Error('Unexpected network request')
  }
})

afterEach(() => {
  globalThis.fetch = originalFetch

  for (const [name, descriptor] of [['localStorage', originalStorage], ['window', originalWindow]]) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else delete globalThis[name]
  }
})

test('valid meal prices include zero, cents, and the database maximum', () => {
  for (const price of ['0', '0.01', '75', '75.50', '99999999.99']) {
    assert.deepEqual(getMealErrors({ ...validMeal, price }), {})
  }
})

test('invalid prices, missing names and invalid availability are rejected', () => {
  for (const price of ['', '-1', '1.001', '1e2', 'NaN', 'Infinity', '100000000', null, true]) {
    assert.ok(getMealErrors({ ...validMeal, price }).price)
  }
  assert.ok(getMealErrors({ ...validMeal, name: '  ' }).name)
  assert.ok(getMealErrors({ ...validMeal, name: 'a'.repeat(101) }).name)
  assert.ok(getMealErrors({ ...validMeal, available: 'false' }).available)
})

test('menu retrieval normalizes API prices and availability', async () => {
  globalThis.fetch = async () => Response.json([savedMeal])
  assert.deepEqual(await getMenu(), [{
    id: 1, name: validMeal.name, description: validMeal.description, price: 75, available: true,
  }])
})

test('invalid menu data and unreadable responses produce clear errors', async () => {
  globalThis.fetch = async () => Response.json([{}])
  await assert.rejects(getMenu(), /invalid menu list/)
  globalThis.fetch = async () => new Response('<html>', { status: 500 })
  await assert.rejects(getMenu(), /unreadable response/)
})

test('cancelled menu loads preserve the AbortError', async () => {
  const error = new DOMException('Cancelled', 'AbortError')
  globalThis.fetch = async () => { throw error }
  await assert.rejects(getMenu(), (caught) => caught === error)
})

test('creating a meal sends only the validated fields and bearer token', async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'http://localhost:3000/api/menu')
    assert.equal(options.method, 'POST')
    assert.equal(options.headers.Authorization, 'Bearer staff-token')
    assert.deepEqual(JSON.parse(options.body), {
      name: validMeal.name, description: validMeal.description, price: '75.00', is_available: true,
    })
    return Response.json({ item: savedMeal }, { status: 201 })
  }
  const result = await saveMeal({ ...validMeal, name: '  Chicken rice  ', user_id: 99, role: 'admin' })
  assert.equal(result.id, 1)
})

test('editing and changing availability uses PUT without deleting the meal', async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'http://localhost:3000/api/menu/1')
    assert.equal(options.method, 'PUT')
    assert.equal(JSON.parse(options.body).is_available, false)
    return Response.json({ item: { ...savedMeal, is_available: false } })
  }
  assert.equal((await saveMeal({ ...validMeal, available: false }, 1)).available, false)
})

test('invalid fields and IDs are rejected before sending a request', async () => {
  await assert.rejects(saveMeal({ ...validMeal, price: '-1' }), /Enter a price/)
  await assert.rejects(saveMeal(validMeal, 0), /invalid ID/)
})

test('missing sessions and rejected staff authorization have useful messages', async () => {
  globalThis.localStorage.getItem = () => null
  await assert.rejects(saveMeal(validMeal), /Please sign in/)
  globalThis.localStorage.getItem = () => 'staff-token'
  globalThis.fetch = async () => new Response('', { status: 401 })
  await assert.rejects(saveMeal(validMeal), /expired/)
  globalThis.fetch = async () => new Response('', { status: 403 })
  await assert.rejects(saveMeal(validMeal), /Only cafeteria staff/)
})

test('server validation errors remain visible without claiming a successful save', async () => {
  globalThis.fetch = async () => Response.json({ message: 'Invalid menu item information' }, { status: 400 })
  await assert.rejects(saveMeal(validMeal), /Invalid menu item information/)
})

test('network, malformed and incomplete save responses are marked uncertain', async () => {
  globalThis.fetch = async () => { throw new Error('Offline') }
  await assert.rejects(saveMeal(validMeal), (error) => error.saveStatusUnknown === true)
  globalThis.fetch = async () => new Response('<html>', { status: 502 })
  await assert.rejects(saveMeal(validMeal), (error) => error.saveStatusUnknown === true)
  globalThis.fetch = async () => Response.json({}, { status: 201 })
  await assert.rejects(saveMeal(validMeal), (error) => error.saveStatusUnknown === true)
  globalThis.fetch = async () => Response.json({ item: { ...savedMeal, menu_item_id: 2 } })
  await assert.rejects(saveMeal(validMeal, 1), (error) => error.saveStatusUnknown === true)
})

test('menu changes notify the current page and other tabs', () => {
  let notified = false
  globalThis.window.dispatchEvent = (event) => { notified = event.type === 'menu-updated' }
  globalThis.localStorage.setItem = (key, value) => {
    assert.equal(key, 'menu-updated-at')
    assert.ok(Number(value) > 0)
  }
  notifyMenuChanged()
  assert.equal(notified, true)
  globalThis.localStorage.setItem = () => { throw new Error('Storage unavailable') }
  assert.doesNotThrow(notifyMenuChanged)
})
