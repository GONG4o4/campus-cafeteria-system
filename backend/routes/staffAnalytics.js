const express = require('express')
const pool = require('../db')
const {
  authenticateToken,
  requireRole,
} = require('../middleware/authMiddleware')

const router = express.Router()

const statusList = ['pending', 'preparing', 'ready', 'picked_up', 'cancelled', 'no_show']

// Orders are saved before HitPay confirms the payment. Like the staff
// order queue, only count orders that have a paid payment, so abandoned
// checkouts are not shown as pending orders or added to the order value.
const paidOrder = `EXISTS (
  SELECT 1 FROM payments p
  WHERE p.order_id = o.order_id AND p.status = 'paid'
)`

// Same business date rule as the queue: the date in Asia/Manila.
function getTodayInManila() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())

  let year = ''
  let month = ''
  let day = ''

  for (const part of parts) {
    if (part.type === 'year') year = part.value
    if (part.type === 'month') month = part.value
    if (part.type === 'day') day = part.value
  }

  return `${year}-${month}-${day}`
}

// Accepts only real calendar dates written as YYYY-MM-DD.
function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const date = new Date(value + 'T00:00:00Z')

  return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

/*
  GET /api/staff/analytics?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD

  Rules:
  - Only paid orders are counted (same rule as GET /api/staff/orders).
  - Dates use orders.order_date, the Asia/Manila business date.
  - Both start and end dates are included.
  - Cancelled orders are left out of order value, average order value,
    and the top dishes. They are still counted in totalOrders,
    cancelledOrders, ordersByStatus, and ordersByHour.
*/
router.get(
  '/analytics',
  authenticateToken,
  requireRole('cafeteria_staff'),
  async (req, res) => {
    const today = getTodayInManila()
    const startDate = req.query.startDate === undefined ? today : req.query.startDate
    const endDate = req.query.endDate === undefined ? startDate : req.query.endDate

    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      return res.status(400).json({
        message: 'Dates must be valid and use the YYYY-MM-DD format.',
      })
    }

    if (startDate > endDate) {
      return res.status(400).json({
        message: 'The start date cannot be after the end date.',
      })
    }

    const dates = [startDate, endDate]

    try {
      // Order totals come from the orders table only, so order items
      // cannot double count an order's total_amount.
      const summaryResult = await pool.query(
        `SELECT
           COUNT(*)::int AS total_orders,
           COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled_orders,
           COALESCE(SUM(total_amount) FILTER (WHERE status <> 'cancelled'), 0)::numeric(12,2)::text AS order_value,
           COALESCE(
             SUM(total_amount) FILTER (WHERE status <> 'cancelled')
               / NULLIF(COUNT(*) FILTER (WHERE status <> 'cancelled'), 0),
             0
           )::numeric(12,2)::text AS average_order_value
         FROM orders o
         WHERE o.order_date BETWEEN $1::date AND $2::date
           AND ${paidOrder}`,
        dates
      )

      const statusResult = await pool.query(
        `SELECT o.status, COUNT(*)::int AS count
         FROM orders o
         WHERE o.order_date BETWEEN $1::date AND $2::date
           AND ${paidOrder}
         GROUP BY o.status`,
        dates
      )

      // Popularity is ranked by quantity, not by number of orders.
      const dishesResult = await pool.query(
        `SELECT
           mi.menu_item_id,
           mi.name,
           SUM(oi.quantity)::int AS total_quantity,
           COUNT(DISTINCT oi.order_id)::int AS order_count,
           SUM(oi.subtotal)::numeric(12,2)::text AS order_value
         FROM order_items oi
         JOIN orders o ON o.order_id = oi.order_id
         JOIN menu_items mi ON mi.menu_item_id = oi.menu_item_id
         WHERE o.order_date BETWEEN $1::date AND $2::date
           AND o.status <> 'cancelled'
           AND ${paidOrder}
         GROUP BY mi.menu_item_id, mi.name
         ORDER BY total_quantity DESC, mi.name ASC
         LIMIT 5`,
        dates
      )

      // ordered_at is saved in the database's own time zone,
      // so convert it to Asia/Manila before taking the hour.
      const hourResult = await pool.query(
        `SELECT
           EXTRACT(HOUR FROM (o.ordered_at AT TIME ZONE current_setting('TimeZone')) AT TIME ZONE 'Asia/Manila')::int AS hour,
           COUNT(*)::int AS count
         FROM orders o
         WHERE o.order_date BETWEEN $1::date AND $2::date
           AND ${paidOrder}
         GROUP BY hour
         ORDER BY hour`,
        dates
      )

      const summary = summaryResult.rows[0]

      // Always send every status, using 0 when there are no orders.
      const ordersByStatus = statusList.map((status) => {
        const row = statusResult.rows.find((item) => item.status === status)

        return {
          status,
          count: row ? row.count : 0,
        }
      })

      return res.json({
        period: {
          startDate,
          endDate,
        },
        summary: {
          totalOrders: summary.total_orders,
          cancelledOrders: summary.cancelled_orders,
          orderValue: summary.order_value,
          averageOrderValue: summary.average_order_value,
        },
        ordersByStatus,
        topDishes: dishesResult.rows.map((dish) => ({
          menuItemId: dish.menu_item_id,
          name: dish.name,
          totalQuantity: dish.total_quantity,
          orderCount: dish.order_count,
          orderValue: dish.order_value,
        })),
        ordersByHour: hourResult.rows.map((row) => ({
          hour: row.hour,
          count: row.count,
        })),
      })
    } catch (error) {
      console.error('Staff analytics failed:', error.message)

      return res.status(500).json({
        message: 'Unable to load cafeteria analytics.',
      })
    }
  }
)

module.exports = router
