const { test, before, after, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')
const jwt = require('jsonwebtoken')
const pool = require('../db')
const staffOrders = require('../routes/staffOrders')

const originalQuery = pool.query
const previousSecret = process.env.JWT_SECRET
const secret = 'staff-orders-tests-only-secret'

let server
let baseUrl
let storedOrder
let queryCount
let databaseFailure
let updateConflict

before(async () => {
  process.env.JWT_SECRET = secret

  const app = express()
  app.use(express.json())
  app.use('/api/staff', staffOrders)

  server = app.listen(0, '127.0.0.1')

  await new Promise((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })

  baseUrl = `http://127.0.0.1:${server.address().port}/api/staff`
})

beforeEach(() => {
  storedOrder = {
    order_id: 6,
    queue_number: 5,
    order_date: '2026-10-26',
    ordered_at: '2026-10-26T10:03:00.000',
    status: 'pending',
    total_amount: '75.00',
    items: [
      {
        menu_item_id: 2,
        name: 'Test Rice Meal',
        quantity: 1,
        unit_price: '75.00',
        subtotal: '75.00',
      },
    ],
  }

  queryCount = 0
  databaseFailure = false
  updateConflict = false

  pool.query = async (sql, params = []) => {
    queryCount++

    if (databaseFailure) {
      throw new Error('private database details')
    }

    if (/SELECT\s+o\.order_id/i.test(sql)) {
      assert.match(sql, /order_items/)
      assert.match(sql, /menu_items/)
      assert.match(sql, /oi\.unit_price/)
      assert.match(sql, /oi\.subtotal/)

      return { rows: [structuredClone(storedOrder)] }
    }

    if (/SELECT status FROM orders/i.test(sql)) {
      if (params[0] !== storedOrder.order_id) {
        return { rows: [] }
      }

      return {
        rows: [{ status: storedOrder.status }],
      }
    }

    if (/UPDATE orders/i.test(sql)) {
      assert.match(sql, /WHERE order_id = \$2/)
      assert.match(sql, /AND status = \$3/)

      const [newStatus, orderId, expectedStatus] = params

      if (
        updateConflict ||
        orderId !== storedOrder.order_id ||
        expectedStatus !== storedOrder.status
      ) {
        return { rows: [] }
      }

      storedOrder.status = newStatus

      return {
        rows: [{
          order_id: storedOrder.order_id,
          queue_number: storedOrder.queue_number,
          status: storedOrder.status,
          total_amount: storedOrder.total_amount,
          order_date: storedOrder.order_date,
        }],
      }
    }

    throw new Error(`Unexpected SQL query: ${sql}`)
  }
})

after(async () => {
  pool.query = originalQuery

  if (server) {
    await new Promise((resolve) => server.close(resolve))
  }

  if (previousSecret === undefined) {
    delete process.env.JWT_SECRET
  } else {
    process.env.JWT_SECRET = previousSecret
  }
})

function request(path, {
  method = 'GET',
  role = 'cafeteria_staff',
  body,
} = {}) {
  const headers = {}

  if (role !== null) {
    const token = jwt.sign(
      {
        user_id: role === 'cafeteria_staff' ? 5 : 3,
        role,
      },
      secret,
      { expiresIn: '1h' }
    )

    headers.Authorization = `Bearer ${token}`
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  return fetch(`${baseUrl}${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

function patchOrder(status, options = {}) {
  return request('/orders/6/status', {
    method: 'PATCH',
    body: { status },
    ...options,
  })
}

test('GET staff orders rejects unauthenticated users', async () => {
  const response = await request('/orders', { role: null })

  assert.equal(response.status, 401)
  assert.equal(queryCount, 0)
})

test('GET staff orders rejects students', async () => {
  const response = await request('/orders', { role: 'student' })

  assert.equal(response.status, 403)
  assert.equal(queryCount, 0)
})

test('GET staff orders returns trusted order information', async () => {
  const response = await request('/orders')
  const data = await response.json()

  assert.equal(response.status, 200)
  assert.ok(Array.isArray(data))
  assert.equal(data.length, 1)
  assert.equal(data[0].order_id, 6)
  assert.equal(data[0].queue_number, 5)
  assert.equal(data[0].total_amount, '75.00')
  assert.equal(data[0].status, 'pending')
  assert.equal(data[0].items[0].name, 'Test Rice Meal')
  assert.equal(data[0].items[0].quantity, 1)
  assert.equal(data[0].items[0].unit_price, '75.00')
  assert.equal(data[0].items[0].subtotal, '75.00')
})

test('GET staff orders handles database failures safely', async () => {
  databaseFailure = true

  const response = await request('/orders')
  const data = await response.json()

  assert.equal(response.status, 500)
  assert.ok(data.message)
  assert.doesNotMatch(JSON.stringify(data), /private database details/)
})

test('PATCH rejects unauthenticated users', async () => {
  const response = await patchOrder('preparing', { role: null })

  assert.equal(response.status, 401)
  assert.equal(queryCount, 0)
  assert.equal(storedOrder.status, 'pending')
})

test('PATCH rejects student users', async () => {
  const response = await patchOrder('preparing', {
    role: 'student',
  })

  assert.equal(response.status, 403)
  assert.equal(queryCount, 0)
  assert.equal(storedOrder.status, 'pending')
})

test('PATCH rejects invalid order IDs', async () => {
  const response = await request('/orders/abc/status', {
    method: 'PATCH',
    body: { status: 'preparing' },
  })

  assert.equal(response.status, 400)
  assert.equal(queryCount, 0)
})

test('PATCH rejects unsupported status values', async () => {
  for (const status of ['delivered', 'pending', '', null, 123]) {
    const response = await patchOrder(status)

    assert.equal(response.status, 400)
  }

  assert.equal(queryCount, 0)
  assert.equal(storedOrder.status, 'pending')
})

test('PATCH rejects attempts to submit fabricated totals', async () => {
  const response = await request('/orders/6/status', {
    method: 'PATCH',
    body: {
      status: 'preparing',
      total_amount: '0.01',
    },
  })

  assert.equal(response.status, 400)
  assert.equal(queryCount, 0)
  assert.equal(storedOrder.total_amount, '75.00')
})

test('PATCH returns 404 for nonexistent orders', async () => {
  const response = await request('/orders/999/status', {
    method: 'PATCH',
    body: { status: 'preparing' },
  })

  assert.equal(response.status, 404)
  assert.equal(storedOrder.status, 'pending')
})

test('PATCH supports the complete valid workflow', async () => {
  for (const status of ['preparing', 'ready', 'picked_up']) {
    const response = await patchOrder(status)
    const data = await response.json()

    assert.equal(response.status, 200)
    assert.equal(data.order.order_id, 6)
    assert.equal(data.order.status, status)
    assert.equal(data.order.total_amount, '75.00')
    assert.equal(storedOrder.status, status)
  }
})

test('PATCH rejects skipped transitions', async () => {
  const response = await patchOrder('ready')
  const data = await response.json()

  assert.equal(response.status, 409)
  assert.match(data.message, /Invalid order status transition/)
  assert.equal(storedOrder.status, 'pending')
})

test('PATCH rejects backward transitions', async () => {
  storedOrder.status = 'ready'

  const response = await patchOrder('preparing')
  const data = await response.json()

  assert.equal(response.status, 409)
  assert.match(data.message, /Invalid order status transition/)
  assert.equal(storedOrder.status, 'ready')
})

test('PATCH rejects stale concurrent updates', async () => {
  updateConflict = true

  const response = await patchOrder('preparing')
  const data = await response.json()

  assert.equal(response.status, 409)
  assert.match(data.message, /Order status changed/)
  assert.equal(storedOrder.status, 'pending')
})

test('PATCH handles database failures safely', async () => {
  databaseFailure = true

  const response = await patchOrder('preparing')
  const data = await response.json()

  assert.equal(response.status, 500)
  assert.ok(data.message)
  assert.doesNotMatch(JSON.stringify(data), /private database details/)
})
