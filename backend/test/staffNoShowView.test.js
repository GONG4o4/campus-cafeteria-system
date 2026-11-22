// Checks what staff see on GET /api/staff/orders for no-show handling,
// using a real database. Every test runs inside a transaction that is
// always rolled back, so nothing is saved. Skipped when no database
// is available.
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')
const jwt = require('jsonwebtoken')
const pool = require('../db')
const staffOrders = require('../routes/staffOrders')

const originalQuery = pool.query
const previousSecret = process.env.JWT_SECRET
const secret = 'staff-no-show-view-tests-only-secret'

let server
let baseUrl
let databaseReady = false

before(async () => {
  process.env.JWT_SECRET = secret

  try {
    const client = await pool.connect()
    await client.query('SELECT 1 FROM no_show_records LIMIT 1')
    client.release()
    databaseReady = true
  } catch {
    databaseReady = false
  }

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

after(async () => {
  pool.query = originalQuery
  await new Promise((resolve) => server.close(resolve))
  await pool.end()

  if (previousSecret === undefined) {
    delete process.env.JWT_SECRET
  } else {
    process.env.JWT_SECRET = previousSecret
  }
})

function getOrders(role) {
  const token = jwt.sign({ user_id: 1, role }, secret, { expiresIn: '1h' })

  return fetch(`${baseUrl}/orders`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

// Runs one test inside a transaction. The route's queries are sent
// through the same transaction so they can see the test data.
async function withTestData(t, run) {
  if (!databaseReady) {
    t.skip('No database available')
    return
  }

  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    pool.query = (...args) => client.query(...args)

    // Only show this test's orders.
    await client.query("UPDATE payments SET status = 'cancelled' WHERE status = 'paid'")

    const user = await client.query(
      `INSERT INTO users (password, role, email, fname, lname)
       VALUES ('x', 'student', $1, 'Private', 'Name')
       RETURNING user_id`,
      [`no-show-view-test-${Date.now()}@example.com`]
    )

    const item = await client.query(
      `INSERT INTO menu_items (name, price, is_available)
       VALUES ('Test Meal', 75, true)
       RETURNING menu_item_id`
    )

    const policy = await client.query(
      'SELECT pickup_window_minutes, grace_period_minutes FROM no_show_policy WHERE policy_id = 1'
    )

    const h = {
      client,
      userId: user.rows[0].user_id,
      itemId: item.rows[0].menu_item_id,
      policy: policy.rows[0],
      nextQueue: 9000,
    }

    await run(h)
  } finally {
    pool.query = originalQuery
    await client.query('ROLLBACK')
    client.release()
  }
}

// readyMinutesAgo: how long ago the order became ready
async function addPaidOrder(h, status, readyMinutesAgo = null) {
  h.nextQueue++

  const order = await h.client.query(
    `INSERT INTO orders (user_id, queue_number, status, total_amount, order_date, ready_at)
     VALUES ($1, $2, $3, 75, CURRENT_DATE,
             CASE WHEN $4::int IS NULL THEN NULL
                  ELSE CURRENT_TIMESTAMP - make_interval(mins => $4::int) END)
     RETURNING order_id`,
    [h.userId, h.nextQueue, status, readyMinutesAgo]
  )

  const orderId = order.rows[0].order_id

  await h.client.query(
    `INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, subtotal)
     VALUES ($1, $2, 1, 75, 75)`,
    [orderId, h.itemId]
  )

  await h.client.query(
    // Same columns the real checkout fills in. Some databases have an older
    // payments table where reference_number is required, so always set it.
    `INSERT INTO payments (order_id, checkout_session_id, reference_number, amount, status)
     VALUES ($1, $2, $3, 75, 'paid')`,
    [orderId, `test-${orderId}`, `TEST-REF-${orderId}`]
  )

  return orderId
}

async function findOrder(orderId) {
  const response = await getOrders('cafeteria_staff')
  assert.equal(response.status, 200)

  const orders = await response.json()

  return orders.find((order) => order.order_id === orderId)
}

test('ready order still inside its pickup window cannot be marked no-show yet', async (t) => {
  await withTestData(t, async (h) => {
    const orderId = await addPaidOrder(h, 'ready', 1)

    const order = await findOrder(orderId)

    assert.equal(order.status, 'ready')
    assert.equal(order.can_mark_no_show, false)
    assert.match(order.pickup_deadline, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)
    assert.match(order.no_show_after, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)
    assert.ok(order.no_show_after > order.pickup_deadline)
  })
})

test('ready order past the grace period can be marked no-show', async (t) => {
  await withTestData(t, async (h) => {
    const overdue = h.policy.pickup_window_minutes + h.policy.grace_period_minutes + 5
    const orderId = await addPaidOrder(h, 'ready', overdue)

    const order = await findOrder(orderId)

    assert.equal(order.can_mark_no_show, true)
  })
})

test('picked-up order cannot be marked no-show and has no deadline', async (t) => {
  await withTestData(t, async (h) => {
    const orderId = await addPaidOrder(h, 'picked_up', 120)

    const order = await findOrder(orderId)

    assert.equal(order.can_mark_no_show, false)
    assert.equal(order.pickup_deadline, null)
    assert.equal(order.no_show_recorded_at, null)
  })
})

test('no-show order shows when it was recorded and the penalty outcome', async (t) => {
  await withTestData(t, async (h) => {
    const orderId = await addPaidOrder(h, 'no_show', 120)

    const record = await h.client.query(
      `INSERT INTO no_show_records (order_id, user_id, recorded_by, offense_count, policy_result)
       VALUES ($1, $2, $2, 3, 'restricted')
       RETURNING no_show_id`,
      [orderId, h.userId]
    )

    await h.client.query(
      `INSERT INTO customer_restrictions (user_id, no_show_id, reason, starts_at, ends_at)
       VALUES ($1, $2, 'test', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + interval '7 days')`,
      [h.userId, record.rows[0].no_show_id]
    )

    const order = await findOrder(orderId)

    assert.equal(order.status, 'no_show')
    assert.equal(order.can_mark_no_show, false)
    assert.match(order.no_show_recorded_at, /^\d{4}-\d{2}-\d{2}T/)
    assert.equal(order.no_show_offense_count, 3)
    assert.equal(order.no_show_policy_result, 'restricted')
    assert.equal(typeof order.no_show_offense_threshold, 'number')
    assert.match(order.restriction_ends_at, /^\d{4}-\d{2}-\d{2}T/)
  })
})

test('no-show warning has no restriction end date', async (t) => {
  await withTestData(t, async (h) => {
    const orderId = await addPaidOrder(h, 'no_show', 120)

    await h.client.query(
      `INSERT INTO no_show_records (order_id, user_id, recorded_by, offense_count, policy_result)
       VALUES ($1, $2, $2, 1, 'warning')`,
      [orderId, h.userId]
    )

    const order = await findOrder(orderId)

    assert.equal(order.no_show_policy_result, 'warning')
    assert.equal(order.restriction_ends_at, null)
  })
})

test('staff never receive the customer name, email or ID', async (t) => {
  await withTestData(t, async (h) => {
    const orderId = await addPaidOrder(h, 'ready', 1)

    const response = await getOrders('cafeteria_staff')
    const text = await response.text()

    assert.doesNotMatch(text, /Private|no-show-view-test-/)

    const order = JSON.parse(text).find((row) => row.order_id === orderId)

    assert.equal(order.user_id, undefined)
    assert.equal(order.email, undefined)
  })
})

test('students cannot load the staff order list', async (t) => {
  await withTestData(t, async () => {
    const response = await getOrders('student')

    assert.equal(response.status, 403)
  })
})
