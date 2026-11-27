const express = require('express');
const pool = require('../db');
const { verifyWebhookSignature } = require('../services/hitpay');
const { confirmPayment } = require('../services/paymentConfirm');

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

        const result = await confirmPayment(client, paymentRequestId, event.amount, eventId);

        if (result === 'paid') {
            await client.query('COMMIT');
            return res.status(200).send('Payment processed successfully');
        }

        await client.query('ROLLBACK');

        if (result === 'amount_mismatch') {
            return res.status(400).send('Amount mismatch');
        }
        if (result === 'already_paid') {
            return res.status(200).send('Already processed');
        }
        return res.status(200).send('Event ignored: payment record not found');

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