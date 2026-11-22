import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { getNoShowPolicyLines, canPlaceOrder, isValidPolicy } from '../src/utils/noShowPolicy.js'
import { createCheckoutSession } from '../src/checkoutApi.js'

const originalFetch = globalThis.fetch
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')

const policy = {
  pickup_window_minutes: 30,
  grace_period_minutes: 15,
  offense_threshold: 3,
  offense_window_days: 30,
  restriction_days: 7,
  policy_version: 1,
}

let requests

beforeEach(() => {
  requests = []
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: () => 'student-token', setItem: () => {} },
  })
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options })
    return {
      ok: true,
      status: 201,
      json: async () => ({
        order_id: 7,
        checkout_url: 'https://sandbox.example/checkout/7',
        total_amount: '75.00',
      }),
    }
  }
})

afterEach(() => {
  globalThis.fetch = originalFetch

  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage)
  else delete globalThis.localStorage
})

test('warning text uses the policy numbers from the backend', () => {
  const text = getNoShowPolicyLines(policy).join(' ')

  assert.match(text, /within 30 minutes after its status changes to Ready/)
  assert.match(text, /15 minutes after that/)
  assert.match(text, /3 no-shows within 30 days/)
  assert.match(text, /for 7 days/)
  assert.match(text, /not be charged/)
})

test('warning text uses singular words for a value of 1', () => {
  const text = getNoShowPolicyLines({ ...policy, offense_threshold: 1, restriction_days: 1 }).join(' ')

  assert.match(text, /1 no-show within/)
  assert.match(text, /for 1 day\./)
})

test('warning text has no made-up durations when the policy is missing', () => {
  for (const missing of [null, undefined, {}, { ...policy, grace_period_minutes: '15' }]) {
    const text = getNoShowPolicyLines(missing).join(' ')

    assert.doesNotMatch(text, /\d/)
    assert.match(text, /no-show/)
    assert.match(text, /temporary ordering restriction/)
  }
})

test('isValidPolicy only accepts whole numbers', () => {
  assert.equal(isValidPolicy(policy), true)
  assert.equal(isValidPolicy({ ...policy, restriction_days: -1 }), false)
  assert.equal(isValidPolicy({ ...policy, offense_threshold: 2.5 }), false)
})

test('Place Order stays disabled until the policy is acknowledged', () => {
  const ready = { acknowledged: true, loading: false, orderStatusUnknown: false, itemCount: 2 }

  assert.equal(canPlaceOrder(ready), true)
  assert.equal(canPlaceOrder({ ...ready, acknowledged: false }), false)
  assert.equal(canPlaceOrder({ ...ready, acknowledged: undefined }), false)
  assert.equal(canPlaceOrder({ ...ready, loading: true }), false)
  assert.equal(canPlaceOrder({ ...ready, orderStatusUnknown: true }), false)
  assert.equal(canPlaceOrder({ ...ready, itemCount: 0 }), false)
})

test('order cannot be submitted without the acknowledgment', async () => {
  await assert.rejects(
    createCheckoutSession([{ menu_item_id: 1, quantity: 1 }], false),
    /confirm the pickup and no-show policy/,
  )
  await assert.rejects(createCheckoutSession([{ menu_item_id: 1, quantity: 1 }]))

  assert.equal(requests.length, 0)
})

test('acknowledged order sends the acknowledgment flag to the backend', async () => {
  const result = await createCheckoutSession([{ menu_item_id: 1, quantity: 2 }], true)
  const body = JSON.parse(requests[0].options.body)

  assert.equal(result.order_id, 7)
  assert.equal(body.acknowledge_no_show_policy, true)
  assert.deepEqual(body.items, [{ menu_item_id: 1, quantity: 2 }])
  // The browser never sends its own acknowledgment time.
  assert.equal('no_show_ack_at' in body, false)
})
