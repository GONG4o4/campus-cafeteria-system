const crypto = require('crypto');

const HITPAY_API_URL = process.env.HITPAY_MODE === 'production'
    ? 'https://api.hit-pay.com/v1'
    : 'https://api.sandbox.hit-pay.com/v1';

async function createPaymentRequest(orderId, totalAmount, redirectUrl) {

    const apiKey = process.env.HITPAY_API_KEY;
    if (!apiKey) {
        throw new Error('HITPAY_API_KEY is not configured');
    }

    const formData = new URLSearchParams();
    formData.append('amount', Number(totalAmount).toFixed(2));
    formData.append('currency', 'PHP');
    formData.append('redirect_url', redirectUrl);
    formData.append('reference_number', `ORDER-${orderId}-${Date.now()}`);
    formData.append('purpose', `Order #${orderId} - Campus Cafeteria`);

    const response = await fetch(`${HITPAY_API_URL}/payment-requests`, {
        method: 'POST',
        headers: {
            'X-BUSINESS-API-KEY': apiKey,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString()
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || 'Failed to create HitPay payment request');
    }

    return {
        checkoutUrl: data.url,
        paymentRequestId: data.id,
        referenceNumber: data.reference_number
    };
}

function verifyWebhookSignature(rawBody, signatureHeader, webhookSalt) {
    if (!signatureHeader || !webhookSalt) {
        return false;
    }

    try {
        const expectedSignature = crypto
            .createHmac('sha256', webhookSalt)
            .update(rawBody)
            .digest('hex');

        const expectedBuffer = Buffer.from(expectedSignature, 'hex');
        const receivedBuffer = Buffer.from(signatureHeader, 'hex');

        if (expectedBuffer.length !== receivedBuffer.length) {
            return false;
        }

        return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
    } catch (error) {
        return false;
    }
}

module.exports = {
    createPaymentRequest,
    verifyWebhookSignature
};