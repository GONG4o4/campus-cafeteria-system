const crypto = require('crypto');

const HITPAY_API_URL = process.env.HITPAY_MODE === 'production'
    ? 'https://api.hit-pay.com/v1'
    : 'https://api.sandbox.hit-pay.com/v1';

async function createPaymentRequest(orderId, totalAmount, redirectUrl) {
    const apiKey = process.env.HITPAY_API_KEY ? process.env.HITPAY_API_KEY.trim() : '';
    const currency = process.env.HITPAY_CURRENCY || 'PHP';
    const paymentMethod = process.env.HITPAY_PAYMENT_METHOD || 'paynow_online';
    
    if (!apiKey) {
        throw new Error('HITPAY_API_KEY is missing in .env');
    }

    const formData = new URLSearchParams();
    formData.append('amount', Number(totalAmount).toFixed(2));
    formData.append('currency', currency);
    formData.append('redirect_url', redirectUrl);
    formData.append('reference_number', `ORDER-${orderId}-${Date.now()}`);
    formData.append('purpose', `Order #${orderId}`);
    formData.append('payment_methods[]', paymentMethod);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
        const response = await fetch(`${HITPAY_API_URL}/payment-requests`, {
            method: 'POST',
            headers: {
                'X-BUSINESS-API-KEY': apiKey,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formData.toString(),
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        const text = await response.text();
        
        let data;
        try {
            data = JSON.parse(text);
        } catch (parseError) {
            console.error("HitPay returned HTML instead of JSON:", text);
            throw new Error("Invalid response format from HitPay. Check API URL.");
        }

        if (!response.ok) {
            let errorMessage = "Unknown HitPay error.";
            if (data && Array.isArray(data.errors) && data.errors.length > 0) {
                errorMessage = data.errors[0].detail || data.errors[0].message || JSON.stringify(data.errors[0]);
            } else if (data && data.message) {
                errorMessage = data.message;
            } else {
                errorMessage = JSON.stringify(data);
            }
            throw new Error(errorMessage);
        }

        return {
            checkoutUrl: data.url,
            paymentRequestId: data.id,
            referenceNumber: data.reference_number
        };

    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('HitPay API request timed out after 15 seconds.');
        }
        throw error;
    }
}

function verifyWebhookSignature(rawBody, signatureHeader, webhookSalt) {
    if (!signatureHeader || !webhookSalt) return false;
    try {
        const expectedSignature = crypto.createHmac('sha256', webhookSalt).update(rawBody).digest('hex');
        const expectedBuffer = Buffer.from(expectedSignature, 'hex');
        const receivedBuffer = Buffer.from(signatureHeader, 'hex');
        if (expectedBuffer.length !== receivedBuffer.length) return false;
        return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
    } catch (error) {
        return false;
    }
}

module.exports = {
    createPaymentRequest,
    verifyWebhookSignature
};