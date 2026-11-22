import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { getBestSellerIds } from '../src/menuApi.js'

const originalFetch = globalThis.fetch

let reply
let requestedUrl

beforeEach(() => {
  requestedUrl = null
  globalThis.fetch = async (url) => {
    requestedUrl = url
    return reply
  }
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

function jsonReply(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

test('returns the IDs of the best sellers from the backend', async () => {
  reply = jsonReply(200, {
    items: [
      { menu_item_id: 4, name: 'Chicken Adobo', image_url: null, quantity_sold: 12, rank: 1 },
      { menu_item_id: 2, name: 'Test Rice Meal', image_url: null, quantity_sold: 5, rank: 2 },
    ],
    period: { type: 'rolling_days', days: 30 },
  })

  const ids = await getBestSellerIds()

  assert.equal(requestedUrl, 'http://localhost:3000/api/menu/best-sellers')
  assert.deepEqual(ids, [4, 2])
})

test('returns an empty list when there are no best sellers', async () => {
  reply = jsonReply(200, { items: [], period: { type: 'rolling_days', days: 30 } })

  assert.deepEqual(await getBestSellerIds(), [])
})

test('throws the backend message when the request fails', async () => {
  reply = jsonReply(500, { message: 'Failed to load best sellers' })

  await assert.rejects(getBestSellerIds(), /Failed to load best sellers/)
})

test('throws when the response is not a valid list', async () => {
  reply = jsonReply(200, { items: [{ menu_item_id: 'four' }] })

  await assert.rejects(getBestSellerIds(), /invalid list/)
})

test('throws when the response is not JSON', async () => {
  reply = {
    ok: false,
    status: 502,
    json: async () => {
      throw new Error('not json')
    },
  }

  await assert.rejects(getBestSellerIds(), /Unable to load best sellers/)
})
