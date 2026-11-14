const express = require('express');
const pool = require('../db');
const { verifyWebhookSignature } = require('../services/hitpay');
const { assignQueueNumber } = require('../utils/queue');

const router = express.Router();

router.post('/webhook', async (req, res) => {
    const signatureHeader = req.get('Hitpay-Signature');
    const webhookSalt = process.env.HITPAY_WEBHOOK_SALT;

    if (!webhookSalt) {
        console.error('Webhook salt is not configured.');
        return res.status(500).send('Webhook configuration error');
    }

    if (!signatureHeader || !req.body) {
        return res.status(400).send('Missing signature or body');
    }

    const isValid = verifyWebhookSignature(req.body, signatureHeader, webhookSalt);

    if (!isValid) {
        console.error('Invalid HitPay webhook signature');
        return res.status(400).send('Invalid signature');
    }

    let event;
    try {
        event = JSON.parse(req.body.toString());
    } catch (error) {
        return res.status(400).send('Invalid JSON payload');
    }

    const eventObject = req.get('Hitpay-Event-Object');
    const paymentRequestId = event.id;
    const eventId = event.id + '_' + Date.now();

    if (eventObject !== 'payment_request' || event.status !== 'completed' || !paymentRequestId) {
        return res.status(200).send('Event ignored: not a completed payment request');
    }

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        const paymentResult = await client.query(
            'SELECT * FROM payments WHERE checkout_session_id = $1 FOR UPDATE',
            [paymentRequestId]
        );

        if (paymentResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(200).send('Event ignored: payment record not found');
        }

        const payment = paymentResult.rows[0];

        if (payment.status === 'paid') {
            await client.query('ROLLBACK');
            return res.status(200).send('Already processed');
        }

        const paidAmount = event.amount;
        const expectedAmount = Number(payment.amount);

        if (Number(paidAmount) !== expectedAmount) {
            await client.query('ROLLBACK');
            console.error(`Amount mismatch: expected ${expectedAmount}, got ${paidAmount}`);
            return res.status(400).send('Amount mismatch');
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

        await client.query('COMMIT');
        return res.status(200).send('Payment processed successfully');

    } catch (error) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error('Webhook processing failed:', error.message);
        return res.status(500).send('Internal server error');
    } finally {
        if (client) {
            client.release();
        }
    }
});

module.exports = router;