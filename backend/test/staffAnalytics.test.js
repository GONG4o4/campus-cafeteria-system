const { test, before, after, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')
const jwt = require('jsonwebtoken')
const pool = require('../db')
const staffAnalytics = require('../routes/staffAnalytics')

const originalQuery = pool.query
const previousSecret = process.env.JWT_SECRET
const secret = 'staff-analytics-tests-only-secret'

let server
let baseUrl
let queryCount
let lastParams
let databaseFailure
let emptyDatabase

before(async () => {
  process.env.JWT_SECRET = secret

  const app = express()
  app.use(express.json())
  app.use('/api/staff', staffAnalytics)

  server = app.listen(0, '127.0.0.1')

  await new Promise((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })

  baseUrl = `http://127.0.0.1:${server.address().port}/api/staff`
})

beforeEach(() => {
  queryCount = 0
  lastParams = null
  databaseFailure = false
  emptyDatabase = false

  pool.query = async (sql, params = []) => {
    queryCount++
    lastParams = params

    if (databaseFailure) {
      throw new Error('private database details')
    }

    // Every analytics query must be parameterized by date.
    assert.match(sql, /BETWEEN \$1::date AND \$2::date/)

    if (/AS total_orders/.test(sql)) {
      assert.match(sql, /FILTER \(WHERE status <> 'cancelled'\)/)
      assert.doesNotMatch(sql, /order_items/)

      if (emptyDatabase) {
        return {
          rows: [{
            total_orders: 0,
            cancelled_orders: 0,
            order_value: '0.00',
            average_order_value: '0.00',
          }],
        }
      }

      return {
        rows: [{
          total_orders: 4,
          cancelled_orders: 1,
          order_value: '300.00',
          average_order_value: '100.00',
        }],
      }
    }

    if (/GROUP BY status/.test(sql)) {
      if (emptyDatabase) return { rows: [] }

      return {
        rows: [
          { status: 'pending', count: 1 },
          { status: 'picked_up', count: 2 },
          { status: 'cancelled', count: 1 },
        ],
      }
    }

    if (/total_quantity/.test(sql)) {
      assert.match(sql, /o\.status <> 'cancelled'/)
      assert.match(sql, /SUM\(oi\.quantity\)/)
      assert.match(sql, /ORDER BY total_quantity DESC/)
      assert.match(sql, /LIMIT 5/)

      if (emptyDatabase) return { rows: [] }

      return {
        rows: [{
          menu_item_id: 2,
          name: 'Chicken Adobo',
          total_quantity: 5,
          order_count: 2,
          order_value: '250.00',
        }],
      }
    }

    if (/AS hour/.test(sql)) {
      assert.match(sql, /Asia\/Manila/)

      if (emptyDatabase) return { rows: [] }

      return { rows: [{ hour: 11, count: 3 }, { hour: 12, count: 1 }] }
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

function request(path, role = 'cafeteria_staff') {
  const headers = {}

  if (role !== null) {
    const token = jwt.sign({ user_id: 5, role }, secret, { expiresIn: '1h' })
    headers.Authorization = `Bearer ${token}`
  }

  return fetch(`${baseUrl}${path}`, { headers })
}

test('analytics rejects unauthenticated users', async () => {
  const response = await request('/analytics', null)

  assert.equal(response.status, 401)
  assert.equal(queryCount, 0)
})

test('analytics rejects students and general staff', async () => {
  for (const role of ['student', 'staff']) {
    const response = await request('/analytics', role)
    assert.equal(response.status, 403)
  }

  assert.equal(queryCount, 0)
})

test('analytics returns the full report for cafeteria staff', async () => {
  const response = await request('/analytics?startDate=2026-11-01&endDate=2026-11-10')
  const data = await response.json()

  assert.equal(response.status, 200)
  assert.deepEqual(lastParams, ['2026-11-01', '2026-11-10'])
  assert.deepEqual(data.period, { startDate: '2026-11-01', endDate: '2026-11-10' })
  assert.deepEqual(data.summary, {
    totalOrders: 4,
    cancelledOrders: 1,
    orderValue: '300.00',
    averageOrderValue: '100.00',
  })
  assert.deepEqual(data.ordersByStatus, [
    { status: 'pending', count: 1 },
    { status: 'preparing', count: 0 },
    { status: 'ready', count: 0 },
    { status: 'picked_up', count: 2 },
    { status: 'cancelled', count: 1 },
  ])
  assert.deepEqual(data.topDishes, [{
    menuItemId: 2,
    name: 'Chicken Adobo',
    totalQuantity: 5,
    orderCount: 2,
    orderValue: '250.00',
  }])
  assert.deepEqual(data.ordersByHour, [{ hour: 11, count: 3 }, { hour: 12, count: 1 }])
})

test('status breakdown adds up to total orders', async () => {
  const response = await request('/analytics?startDate=2026-11-01&endDate=2026-11-10')
  const data = await response.json()

  let sum = 0
  for (const item of data.ordersByStatus) sum += item.count

  assert.equal(sum, data.summary.totalOrders)
})

test('analytics defaults to today in Manila for a single day', async () => {
  const response = await request('/analytics')
  const data = await response.json()

  assert.equal(response.status, 200)
  assert.match(data.period.startDate, /^\d{4}-\d{2}-\d{2}$/)
  assert.equal(data.period.startDate, data.period.endDate)
})

test('analytics uses startDate as endDate when only one date is given', async () => {
  const response = await request('/analytics?startDate=2026-11-05')
  const data = await response.json()

  assert.equal(response.status, 200)
  assert.deepEqual(lastParams, ['2026-11-05', '2026-11-05'])
})

test('analytics returns zeros and empty arrays when there are no orders', async () => {
  emptyDatabase = true

  const response = await request('/analytics?startDate=2026-01-01')
  const data = await response.json()

  assert.equal(response.status, 200)
  assert.equal(data.summary.totalOrders, 0)
  assert.equal(data.summary.orderValue, '0.00')
  assert.equal(data.summary.averageOrderValue, '0.00')
  assert.equal(data.ordersByStatus.length, 5)
  assert.ok(data.ordersByStatus.every((item) => item.count === 0))
  assert.deepEqual(data.topDishes, [])
  assert.deepEqual(data.ordersByHour, [])
})

test('analytics rejects invalid dates', async () => {
  const badQueries = [
    '?startDate=2026-13-01',
    '?startDate=2026-02-30',
    '?startDate=11-10-2026',
    '?startDate=yesterday',
    '?startDate=',
    '?startDate=2026-11-01&endDate=nope',
    '?startDate=2026-11-01&startDate=2026-11-02',
    "?startDate=2026-11-01'; DROP TABLE orders;--",
  ]

  for (const query of badQueries) {
    const response = await request('/analytics' + query)
    assert.equal(response.status, 400, query)
  }

  assert.equal(queryCount, 0)
})

test('analytics rejects a start date after the end date', async () => {
  const response = await request('/analytics?startDate=2026-11-10&endDate=2026-11-01')
  const data = await response.json()

  assert.equal(response.status, 400)
  assert.match(data.message, /start date/)
  assert.equal(queryCount, 0)
})

test('analytics handles database failures safely', async () => {
  databaseFailure = true

  const response = await request('/analytics?startDate=2026-11-01')
  const data = await response.json()

  assert.equal(response.status, 500)
  assert.ok(data.message)
  assert.doesNotMatch(JSON.stringify(data), /private database details/)
})
