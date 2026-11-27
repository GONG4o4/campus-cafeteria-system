const { assignQueueNumber } = require('../utils/queue');

// Marks a HitPay payment as paid and gives the order a queue number.
// Used by both the webhook and the "verify payment" check, so the
// queue number is assigned the same way no matter which one runs first.
// The caller must already have started a transaction (BEGIN) on this client.
//
// Returns one of: 'not_found', 'already_paid', 'amount_mismatch', 'paid'
async function confirmPayment(client, paymentRequestId, paidAmount, eventId) {
    const paymentResult = await client.query(
        'SELECT * FROM payments WHERE checkout_session_id = $1 FOR UPDATE',
        [paymentRequestId]
    );

    if (paymentResult.rows.length === 0) {
        return 'not_found';
    }

    const payment = paymentResult.rows[0];

    if (payment.status === 'paid') {
        return 'already_paid';
    }

    if (Number(paidAmount) !== Number(payment.amount)) {
        console.error(`Amount mismatch: expected ${payment.amount}, got ${paidAmount}`);
        return 'amount_mismatch';
    }

    await client.query(
        `UPDATE payments
         SET status = 'paid', last_webhook_event_id = $1, updated_at = CURRENT_TIMESTAMP
         WHERE payment_id = $2`,
        [eventId, payment.payment_id]
    );

    const dateResult = await client.query(
        `SELECT TO_CHAR((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date, 'YYYY-MM-DD') AS order_date`
    );
    const orderDate = dateResult.rows[0].order_date;

    const queueNumber = await assignQueueNumber(client, orderDate);

    await client.query(
        `UPDATE orders
         SET queue_number = $1, status = 'pending', updated_at = CURRENT_TIMESTAMP
         WHERE order_id = $2`,
        [queueNumber, payment.order_id]
    );

    return 'paid';
}

module.exports = {
    confirmPayment
};
