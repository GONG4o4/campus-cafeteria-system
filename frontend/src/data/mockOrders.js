const mockOrders = [
  {
    order_id: 1,
    queue_number: 12,
    status: "pending",
    total_amount: 150.00,
    ordered_at: "2026-10-12T09:30:00",
    items: [
      {
        menu_item_id: 1,
        name: "Chicken Rice",
        quantity: 2,
        price: 75.00,
      },
    ],
  },

  {
    order_id: 2,
    queue_number: 13,
    status: "preparing",
    total_amount: 100.00,
    ordered_at: "2026-10-12T09:35:00",
    items: [
      {
        menu_item_id: 2,
        name: "Pork Adobo Meal",
        quantity: 1,
        price: 100.00,
      },
    ],
  },

  {
    order_id: 3,
    queue_number: 14,
    status: "ready",
    total_amount: 120.00,
    ordered_at: "2026-10-12T09:40:00",
    items: [
      {
        menu_item_id: 3,
        name: "Beef Tapa Meal",
        quantity: 1,
        price: 120.00,
      },
    ],
  },

  {
    order_id: 4,
    queue_number: 8,
    status: "picked_up",
    total_amount: 75.00,
    ordered_at: "2026-10-11T11:00:00",
    items: [
      {
        menu_item_id: 1,
        name: "Chicken Rice",
        quantity: 1,
        price: 75.00,
      },
    ],
  },

  {
    order_id: 5,
    queue_number: 9,
    status: "cancelled",
    total_amount: 85.00,
    ordered_at: "2026-10-11T11:15:00",
    items: [
      {
        menu_item_id: 4,
        name: "Pancit Canton",
        quantity: 1,
        price: 85.00,
      },
    ],
  },
];

export default mockOrders;

const orderHistoryOrders = mockOrders.map((order) => ({
  ...order,
  id: `order-${order.order_id}`,
  reference: `CAF-${String(order.order_id).padStart(4, '0')}`,
  queueNumber: String(order.queue_number).padStart(3, '0'),
  createdAt: `${order.ordered_at}+08:00`,
  items: order.items.map((item) => ({ ...item, id: item.menu_item_id })),
}));

export { orderHistoryOrders as mockOrders };
