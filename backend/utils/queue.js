async function assignQueueNumber(client, orderDate) {
    await client.query("SELECT pg_advisory_xact_lock(34034, 1)");

    const queueResult = await client.query(
        `SELECT COALESCE(MAX(queue_number), 0) + 1 AS next_number 
         FROM orders 
         WHERE order_date = $1::date`,
        [orderDate]
    );

    return Number(queueResult.rows[0].next_number);
}

module.exports = {
    assignQueueNumber
};