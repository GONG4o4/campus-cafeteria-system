const { test, before, after, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')
const jwt = require('jsonwebtoken')
const pool = require('../db')
const staffOrders = require('../routes/staffOrders')
const { decidePolicyResult } = require('../services/noShow')

const originalConnect = pool.connect
const previousSecret = process.env.JWT_SECRET
const secret = 'no-show-tests-only-secret'
const STAFF_ID = 5

let server
let baseUrl

// Fake database state. The mock client below reads and changes it.
let db
let saved
let queries
let databaseFailure

function freshDatabase() {
  return {
    policy: {
      pickup_window_minutes: 30,
      grace_period_minutes: 15,
      offense_threshold: 3,
      offense_window_days: 30,
      restriction_days: 7,
    },
    // deadline_passed / grace_passed are what the real SQL works out
    // from ready_at and CURRENT_TIMESTAMP.
    order: {
      order_id: 10,
      user_id: 3,
      queue_number: 4,
      status: 'ready',
      deadline_passed: true,
      grace_passed: true,
    },
    priorNoShows: 0,
    records: [],
    restrictions: [],
    auditLogs: [],
  }
}

function createMockClient() {
  return {
    async query(sql, params = []) {
      const statement = sql.replace(/\s+/g, ' ').trim()
      queries.push(statement)

      if (databaseFailure) {
        throw new Error('private database details')
      }

      // Simple transaction support: ROLLBACK puts the old state back.
      if (statement === 'BEGIN') {
        saved = structuredClone(db)
        return { rows: [] }
      }

      if (statement === 'COMMIT') {
        return { rows: [] }
      }

      if (statement === 'ROLLBACK') {
        db = saved
        return { rows: [] }
      }

      if (statement.includes('FROM no_show_policy')) {
        return { rows: [{ ...db.policy }] }
      }

      if (statement.includes('FROM orders WHERE order_id = $1 FOR UPDATE')) {
        assert.match(statement, /CURRENT_TIMESTAMP/)

        if (params[0] !== db.order.order_id) {
          return { rows: [] }
        }

        // Window (30) and window + grace (45) come from the policy.
        assert.equal(params[1], 30)
        assert.equal(params[2], 45)

        return {
          rows: [{
            ...db.order,
            pickup_deadline: '2026-11-22T10:30:00',
            no_show_after: '2026-11-22T10:45:00',
          }],
        }
      }

      if (statement.includes('FROM users WHERE user_id = $1 FOR UPDATE')) {
        return { rows: [{ user_id: params[0] }] }
      }

      if (statement.startsWith('UPDATE orders')) {
        assert.match(statement, /status = 'no_show'/)
        assert.match(statement, /AND status = 'ready'/)

        if (db.order.status !== 'ready') {
          return { rows: [] }
        }

        db.order.status = 'no_show'

        return {
          rows: [{
            order_id: db.order.order_id,
            queue_number: db.order.queue_number,
            status: db.order.status,
          }],
        }
      }

      if (statement.includes('COUNT(*)::int AS total FROM no_show_records')) {
        assert.equal(params[1], 30)
        return { rows: [{ total: db.priorNoShows + db.records.length }] }
      }

      if (statement.startsWith('INSERT INTO no_show_records')) {
        assert.match(statement, /ON CONFLICT \(order_id\) DO NOTHING/)

        const [orderId, userId, recordedBy, offenseCount, policyResult] = params

        if (db.records.some((record) => record.order_id === orderId)) {
          return { rows: [] }
        }

        const record = {
          no_show_id: db.records.length + 1,
          order_id: orderId,
          user_id: userId,
          recorded_by: recordedBy,
          offense_count: offenseCount,
          policy_result: policyResult,
        }

        db.records.push(record)

        return {
          rows: [{ no_show_id: record.no_show_id, recorded_at: '2026-11-22T11:00:00' }],
        }
      }

      if (statement.startsWith('INSERT INTO customer_restrictions')) {
        const [userId, noShowId, reason, days] = params

        db.restrictions.push({ user_id: userId, no_show_id: noShowId, reason, days })

        return {
          rows: [{
            restriction_id: db.restrictions.length,
            reason,
            starts_at: '2026-11-22T11:00:00',
            ends_at: '2026-11-29T11:00:00',
          }],
        }
      }

      if (statement.startsWith('INSERT INTO audit_logs')) {
        db.auditLogs.push({ actor: params[0], order_id: params[1], details: JSON.parse(params[2]) })
        return { rows: [] }
      }

      throw new Error(`Unexpected SQL query: ${statement}`)
    },

    release() {},
  }
}

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
  db = freshDatabase()
  saved = null
  queries = []
  databaseFailure = false
  pool.connect = async () => createMockClient()
})

after(async () => {
  pool.connect = originalConnect

  if (server) {
    await new Promise((resolve) => server.close(resolve))
  }

  if (previousSecret === undefined) {
    delete process.env.JWT_SECRET
  } else {
    process.env.JWT_SECRET = previousSecret
  }
})

function markNoShow(orderId = 10, { role = 'cafeteria_staff', body } = {}) {
  const headers = {}

  if (role !== null) {
    const token = jwt.sign(
      { user_id: role === 'student' ? 3 : STAFF_ID, role },
      secret,
      { expiresIn: '1h' }
    )
    headers.Authorization = `Bearer ${token}`
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  return fetch(`${baseUrl}/orders/${orderId}/no-show`, {
    method: 'POST',
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

test('no-show rejects unauthenticated users', async () => {
  const response = await markNoShow(10, { role: null })

  assert.equal(response.status, 401)
  assert.equal(queries.length, 0)
})

test('student cannot call the staff no-show endpoint', async () => {
  const response = await markNoShow(10, { role: 'student' })

  assert.equal(response.status, 403)
  assert.equal(queries.length, 0)
  assert.equal(db.order.status, 'ready')
})

test('super admin cannot record a no-show', async () => {
  const response = await markNoShow(10, { role: 'super_admin' })

  assert.equal(response.status, 403)
  assert.equal(queries.length, 0)
})

test('no-show rejects invalid order IDs', async () => {
  for (const id of ['abc', '0', '-1', '1.5', '99999999999']) {
    const response = await markNoShow(id)
    assert.equal(response.status, 400)
  }

  assert.equal(queries.length, 0)
})

test('no-show rejects a request body (no client-supplied data is trusted)', async () => {
  const response = await markNoShow(10, { body: { user_id: 1, offense_count: 0 } })

  assert.equal(response.status, 400)
  assert.equal(queries.length, 0)
})

test('no-show returns 404 for a missing order', async () => {
  const response = await markNoShow(999)

  assert.equal(response.status, 404)
  assert.equal(db.records.length, 0)
})

test('ready order before the pickup deadline cannot be marked no-show', async () => {
  db.order.deadline_passed = false
  db.order.grace_passed = false

  const response = await markNoShow()
  const data = await response.json()

  assert.equal(response.status, 409)
  assert.match(data.message, /pickup deadline has not passed/)
  assert.equal(data.no_show_after, '2026-11-22T10:45:00')
  assert.equal(db.order.status, 'ready')
  assert.equal(db.records.length, 0)
})

test('ready order before the grace period ends cannot be marked no-show', async () => {
  db.order.grace_passed = false

  const response = await markNoShow()
  const data = await response.json()

  assert.equal(response.status, 409)
  assert.match(data.message, /grace period has not ended/)
  assert.equal(db.order.status, 'ready')
  assert.equal(db.records.length, 0)
})

test('staff can mark an eligible ready order as a no-show (first offense = warning)', async () => {
  const response = await markNoShow()
  const data = await response.json()

  assert.equal(response.status, 200)
  assert.equal(data.order.status, 'no_show')
  assert.equal(data.no_show.offense_count, 1)
  assert.equal(data.no_show.policy_result, 'warning')
  assert.equal(data.no_show.recorded_by, STAFF_ID)
  assert.equal(data.restriction, null)

  assert.equal(db.order.status, 'no_show')
  assert.equal(db.records.length, 1)
  assert.equal(db.records[0].user_id, 3)
  assert.equal(db.records[0].recorded_by, STAFF_ID)
  assert.equal(db.restrictions.length, 0)

  // Audit trail
  assert.equal(db.auditLogs.length, 1)
  assert.equal(db.auditLogs[0].actor, STAFF_ID)
  assert.equal(db.auditLogs[0].order_id, 10)
  assert.equal(db.auditLogs[0].details.customer_id, 3)
  assert.equal(db.auditLogs[0].details.policy_result, 'warning')

  assert.ok(queries.includes('COMMIT'))
})

test('reaching the offense threshold creates a temporary restriction', async () => {
  db.priorNoShows = 2

  const response = await markNoShow()
  const data = await response.json()

  assert.equal(response.status, 200)
  assert.equal(data.no_show.offense_count, 3)
  assert.equal(data.no_show.policy_result, 'restricted')
  assert.equal(data.restriction.ends_at, '2026-11-29T11:00:00')
  assert.match(data.restriction.reason, /3 uncollected orders within 30 days/)

  assert.equal(db.restrictions.length, 1)
  assert.equal(db.restrictions[0].user_id, 3)
  assert.equal(db.restrictions[0].days, 7)
  assert.equal(db.restrictions[0].no_show_id, db.records[0].no_show_id)
  assert.equal(db.auditLogs[0].details.restriction_id, 1)
})

test('below the threshold only a warning is recorded', async () => {
  db.priorNoShows = 1

  const response = await markNoShow()
  const data = await response.json()

  assert.equal(response.status, 200)
  assert.equal(data.no_show.offense_count, 2)
  assert.equal(data.no_show.policy_result, 'warning')
  assert.equal(db.restrictions.length, 0)
})

test('picked up, cancelled, pending and preparing orders cannot be marked no-show', async () => {
  for (const status of ['picked_up', 'cancelled', 'pending', 'preparing']) {
    db = freshDatabase()
    db.order.status = status

    const response = await markNoShow()
    const data = await response.json()

    assert.equal(response.status, 409)
    assert.match(data.message, /ready for pickup/)
    assert.equal(db.order.status, status)
    assert.equal(db.records.length, 0)
    assert.equal(db.restrictions.length, 0)
  }
})

test('an order already marked no-show cannot be marked again', async () => {
  db.order.status = 'no_show'

  const response = await markNoShow()
  const data = await response.json()

  assert.equal(response.status, 409)
  assert.match(data.message, /already marked/)
  assert.equal(db.records.length, 0)
})

test('duplicate requests do not create duplicate penalties', async () => {
  db.priorNoShows = 2

  const first = await markNoShow()
  const second = await markNoShow()
  const third = await markNoShow()

  assert.equal(first.status, 200)
  assert.equal(second.status, 409)
  assert.equal(third.status, 409)
  assert.equal(db.records.length, 1)
  assert.equal(db.restrictions.length, 1)
  assert.equal(db.auditLogs.length, 1)
})

test('no-show handles database failures safely and rolls back', async () => {
  databaseFailure = true

  const response = await markNoShow()
  const data = await response.json()

  assert.equal(response.status, 500)
  assert.ok(data.message)
  assert.doesNotMatch(JSON.stringify(data), /private database details/)
})

test('policy result is warning below the threshold and restricted at or above it', () => {
  const policy = { offense_threshold: 3 }

  assert.equal(decidePolicyResult(1, policy), 'warning')
  assert.equal(decidePolicyResult(2, policy), 'warning')
  assert.equal(decidePolicyResult(3, policy), 'restricted')
  assert.equal(decidePolicyResult(4, policy), 'restricted')
  assert.equal(decidePolicyResult(1, { offense_threshold: 1 }), 'restricted')
})
