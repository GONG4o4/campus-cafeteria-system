// temporary lng to BUSENGGG!!!!!!!!!!

export const mockOrders = [
  {
    id: 'order-1048',
    reference: 'CAF-1048',
    queueNumber: '028',
    createdAt: '2026-10-13T11:42:00+08:00',
    status: 'ready',
    items: [
      {
        id: 'chicken',
        name: 'Chicken adobo with rice',
        quantity: 1,
        price: 85,
      },
      { id: 'tea', name: 'Iced tea', quantity: 1, price: 25 },
    ],
  },
  {
    id: 'order-1045',
    reference: 'CAF-1045',
    queueNumber: '025',
    createdAt: '2026-10-13T11:35:00+08:00',
    status: 'preparing',
    items: [
      { id: 'pancit', name: 'Pancit canton', quantity: 1, price: 55 },
      { id: 'water', name: 'Bottled water', quantity: 1, price: 20 },
    ],
  },
  {
    id: 'order-1042',
    reference: 'CAF-1042',
    queueNumber: '022',
    createdAt: '2026-10-13T11:30:00+08:00',
    status: 'pending',
    items: [{ id: 'sandwich', name: 'Egg sandwich', quantity: 2, price: 35 }],
  },
  {
    id: 'order-1021',
    reference: 'CAF-1021',
    queueNumber: '014',
    createdAt: '2026-10-12T12:05:00+08:00',
    status: 'picked_up',
    items: [
      { id: 'pork', name: 'Pork sisig with rice', quantity: 1, price: 95 },
      { id: 'juice', name: 'Calamansi juice', quantity: 1, price: 25 },
    ],
  },
  {
    id: 'order-0986',
    reference: 'CAF-0986',
    queueNumber: '009',
    createdAt: '2026-10-10T10:18:00+08:00',
    status: 'cancelled',
    items: [{ id: 'tuna', name: 'Tuna sandwich', quantity: 1, price: 45 }],
  },
  {
    id: 'order-0964',
    reference: 'CAF-0964',
    queueNumber: '017',
    createdAt: '2026-10-09T12:15:00+08:00',
    status: 'picked_up',
    items: [
      {
        id: 'chicken',
        name: 'Chicken adobo with rice',
        quantity: 2,
        price: 85,
      },
    ],
  },
]
