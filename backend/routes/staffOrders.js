const express = require('express')
const pool = require('../db')
const {
  authenticateToken,
  requireRole,
} = require('../middleware/authMiddleware')

const router = express.Router()

const transitions = {
  pending: 'preparing',
  preparing: 'ready',
  ready: 'picked_up',
}

router.use(authenticateToken, requireRole('cafeteria_staff'))

router.get('/orders', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        o.order_id,
        o.queue_number,
        TO_CHAR(o.order_date, 'YYYY-MM-DD') AS order_date,
        TO_CHAR(o.ordered_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS') AS ordered_at,
        o.status,
        o.total_amount,
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

router.patch('/orders/:id/status', async (req, res) => {
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
      'SELECT status FROM orders WHERE order_id = $1',
      [orderId]
    )

    if (existing.rows.length === 0) {
      return res.status(404).json({
        message: 'Order not found.',
      })
    }

    const currentStatus = existing.rows[0].status

    if (transitions[currentStatus] !== body.status) {
      return res.status(409).json({
        message: 'Invalid order status transition.',
      })
    }

    const updated = await pool.query(
      `UPDATE orders
       SET status = $1,
           updated_at = CURRENT_TIMESTAMP
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

module.exports = router
