const crypto = require('crypto');

const PAYMONGO_API_URL = 'https://api.paymongo.com/v1';

async function createCheckoutSession(orderId, totalAmount, lineItems, successUrl, cancelUrl) {
    const secretKey = process.env.PAYMONGO_SECRET_KEY;
    

    if (!secretKey) {
        throw new Error('PAYMONGO_SECRET_KEY is not configured');
    }

    const authString = Buffer.from(`${secretKey}:`).toString('base64');

    const payload = {
        data: {
            attributes: {
                line_items: lineItems.map(item => ({
                    currency: 'PHP',
                    amount: Math.round(Number(item.unit_price) * 100) * item.quantity,
                    name: item.name,
                    quantity: item.quantity,
                })),
                payment_method_types: ['card', 'gcash', 'paymaya', 'qrph'],
                success_url: successUrl,
                cancel_url: cancelUrl,
                description: `Order #${orderId} - Campus Cafeteria`,
                reference_number: `ORDER-${orderId}-${Date.now()}`,
                metadata: {
                    order_id: String(orderId)
                }
            }
        }
    };

    const response = await fetch(`${PAYMONGO_API_URL}/checkout_sessions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${authString}`
        },
        body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.errors?.[0]?.detail || 'Failed to create PayMongo checkout session');
    }

    return {
        checkoutUrl: data.data.attributes.checkout_url,
        checkoutSessionId: data.data.id,
        referenceNumber: data.data.attributes.reference_number
    };
}

function verifyWebhookSignature(rawBody, signatureHeader, webhookSecret) {
    if (!signatureHeader || !webhookSecret) {
        return false;
    }

    try {
        const parts = signatureHeader.split(',');
        let timestamp = '';
        let testSignature = '';
        let liveSignature = '';

        for (const part of parts) {
            const [key, value] = part.split('=');
            if (key === 't') timestamp = value;
            if (key === 'te') testSignature = value;
            if (key === 'li') liveSignature = value;
        }

        if (!timestamp) {
            return false;
        }

        const payload = `${timestamp}.${rawBody.toString()}`;
        
        const expectedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(payload)
            .digest('hex');

        const signatureToCompare = testSignature || liveSignature;

        if (!signatureToCompare) {
            return false;
        }

        const expectedBuffer = Buffer.from(expectedSignature, 'hex');
        const receivedBuffer = Buffer.from(signatureToCompare, 'hex');

        if (expectedBuffer.length !== receivedBuffer.length) {
            return false;
        }

        return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
    } catch (error) {
        return false;
    }
}

module.exports = {
    createCheckoutSession,
    verifyWebhookSignature
};