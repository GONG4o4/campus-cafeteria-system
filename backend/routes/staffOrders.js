const express = require('express')
const pool = require('../db')
const {
  authenticateToken,
  requireRole,
} = require('../middleware/authMiddleware')
const { markOrderNoShow, getPenaltySummary } = require('../services/noShow')

const router = express.Router()

const transitions = {
  pending: 'preparing',
  preparing: 'ready',
  ready: 'picked_up',
}

router.use(authenticateToken)

// Super admins can view the staff dashboard, but only staff update orders.
router.get('/orders', requireRole('cafeteria_staff', 'super_admin'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        o.order_id,
        o.queue_number,
        TO_CHAR(o.order_date, 'YYYY-MM-DD') AS order_date,
        TO_CHAR(o.ordered_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS') AS ordered_at,
        o.status,
        o.total_amount,
        'paid' AS payment_status,
        TO_CHAR(o.ready_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS ready_at,
        COALESCE(
          o.status = 'ready' AND CURRENT_TIMESTAMP >= COALESCE(o.ready_at, o.updated_at) + make_interval(mins => (
            SELECT pickup_window_minutes + grace_period_minutes
            FROM no_show_policy
            WHERE policy_id = 1
          )),
          false
        ) AS can_mark_no_show,
        COALESCE((
          SELECT json_agg(
            json_build_object(
              'menu_item_id', oi.menu_item_id,
              'name', mi.name,
              'quantity', oi.quantity,
              'unit_price', oi.unit_price,
              'subtotal', oi.subtotal
            )
            ORDER BY oi.order_item_id
          )
          FROM order_items oi
          JOIN menu_items mi
            ON mi.menu_item_id = oi.menu_item_id
          WHERE oi.order_id = o.order_id
        ), '[]'::json) AS items
      FROM orders o
      WHERE EXISTS (
        SELECT 1 FROM payments p 
        WHERE p.order_id = o.order_id AND p.status = 'paid'
      )
      ORDER BY o.order_date DESC, o.queue_number ASC
    `)

    return res.json(result.rows)
  } catch (error) {
    console.error('Staff orders failed:', error.message)

    return res.status(500).json({
      message: 'Unable to load cafeteria orders.',
    })
  }
})

router.patch('/orders/:id/status', requireRole('cafeteria_staff'), async (req, res) => {
  const orderId = Number(req.params.id)

  if (
    !/^[1-9]\d*$/.test(req.params.id) ||
    !Number.isSafeInteger(orderId) ||
    orderId > 2147483647
  ) {
    return res.status(400).json({
      message: 'Invalid order ID.',
    })
  }

  const body = req.body

  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.keys(body).length !== 1 ||
    typeof body.status !== 'string' ||
    !Object.values(transitions).includes(body.status)
  ) {
    return res.status(400).json({
      message: 'Invalid status update request.',
    })
  }

  try {
    const existing = await pool.query(
      `SELECT o.status, p.status AS payment_status
       FROM orders o
       LEFT JOIN payments p ON p.order_id = o.order_id AND p.status = 'paid'
       WHERE o.order_id = $1
       LIMIT 1`,
      [orderId]
    )

    if (existing.rows.length === 0) {
      return res.status(404).json({
        message: 'Order not found.',
      })
    }

    const currentStatus = existing.rows[0].status
    const paymentStatus = existing.rows[0].payment_status

    if (paymentStatus !== 'paid') {
      return res.status(409).json({
        message: 'Cannot update status. Payment has not been confirmed.',
      })
    }

    if (transitions[currentStatus] !== body.status) {
      return res.status(409).json({
        message: 'Invalid order status transition.',
      })
    }

    const updated = await pool.query(
      `UPDATE orders
       SET status = $1,
           updated_at = CURRENT_TIMESTAMP,
           ready_at = CASE WHEN $1::varchar = 'ready' THEN CURRENT_TIMESTAMP ELSE ready_at END
       WHERE order_id = $2
         AND status = $3
       RETURNING
         order_id,
         queue_number,
         status,
         total_amount,
         TO_CHAR(order_date, 'YYYY-MM-DD') AS order_date`,
      [body.status, orderId, currentStatus]
    )

    if (updated.rows.length === 0) {
      return res.status(409).json({
        message: 'Order status changed. Refresh and try again.',
      })
    }

    return res.json({
      message: 'Order status updated successfully.',
      order: updated.rows[0],
    })
  } catch (error) {
    console.error('Staff status update failed:', error.message)

    return res.status(500).json({
      message: 'Unable to update order status.',
    })
  }
})

function isValidId(text) {
  const id = Number(text)

  return /^[1-9]\d*$/.test(text) && Number.isSafeInteger(id) && id <= 2147483647
}

// Staff marks a ready order as not collected. Only cafeteria staff can do this.
// The backend checks the deadline and grace period itself.
router.post('/orders/:id/no-show', requireRole('cafeteria_staff'), async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(400).json({
      message: 'Invalid order ID.',
    })
  }

  // This action takes no input. Reject anything extra that was sent.
  const body = req.body

  if (
    body !== undefined &&
    (body === null || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length > 0)
  ) {
    return res.status(400).json({
      message: 'This request does not accept a body.',
    })
  }

  const orderId = Number(req.params.id)
  let client

  try {
    client = await pool.connect()
    await client.query('BEGIN')

    const result = await markOrderNoShow(client, orderId, req.user.user_id)

    if (result.error) {
      await client.query('ROLLBACK')

      const response = { message: result.error.message }

      if (result.error.no_show_after) {
        response.no_show_after = result.error.no_show_after
      }

      return res.status(result.error.status).json(response)
    }

    await client.query('COMMIT')

    let message = 'Order marked as a no-show. A warning was recorded for the customer.'

    if (result.restriction) {
      message = 'Order marked as a no-show. The customer is temporarily restricted from ordering.'
    }

    return res.json({
      message,
      order: result.order,
      no_show: result.no_show,
      restriction: result.restriction,
    })
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK')
      } catch (rollbackError) {
        console.error('No-show rollback failed:', rollbackError.message)
      }
    }

    console.error('Mark no-show failed:', error.message)

    return res.status(500).json({
      message: 'Unable to mark this order as a no-show.',
    })
  } finally {
    if (client) {
      client.release()
    }
  }
})

// Staff and super admins can look up one customer's no-show history.
router.get('/customers/:id/no-shows', requireRole('cafeteria_staff', 'super_admin'), async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(400).json({
      message: 'Invalid customer ID.',
    })
  }

  const customerId = Number(req.params.id)

  try {
    const customer = await pool.query(
      "SELECT user_id FROM users WHERE user_id = $1 AND role = 'student'",
      [customerId]
    )

    if (customer.rows.length === 0) {
      return res.status(404).json({
        message: 'Customer not found.',
      })
    }

    const summary = await getPenaltySummary(pool, customerId)

    return res.json({
      customer_id: customerId,
      ...summary,
    })
  } catch (error) {
    console.error('Customer no-show history failed:', error.message)

    return res.status(500).json({
      message: 'Unable to load no-show history.',
    })
  }
})

module.exports = router