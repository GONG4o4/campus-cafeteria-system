# Best sellers API

Returns the Top 10 best-selling menu items. The customer menu uses it to show
the **Best Seller** badge. The backend is the only place the ranking is
calculated. The frontend must not count sales itself.

## Endpoint

```
GET /api/menu/best-sellers
```

- Public, no login needed (same as `GET /api/menu`).
- Read-only. It never changes orders or sales.
- No query parameters.

## Response

```json
{
  "items": [
    {
      "menu_item_id": 12,
      "name": "Chicken Rice",
      "image_url": null,
      "quantity_sold": 48,
      "rank": 1
    }
  ],
  "period": {
    "type": "rolling_days",
    "days": 30
  }
}
```

| Field | Meaning |
|---|---|
| `items` | Up to 10 items, best seller first. Empty array `[]` when nothing qualifies. |
| `menu_item_id` | Match this to `menu_item_id` from `GET /api/menu`. Match by ID, never by name. |
| `quantity_sold` | Units sold in the window. |
| `rank` | 1 = best seller. |
| `period.days` | Size of the window in days. |

On a server error it returns `500` with `{ "message": "Failed to load best sellers" }`.
The menu should still work without badges when this happens.

## Ranking rules

1. **What counts as a sale:** only orders with status `picked_up`. Pending,
   preparing, ready, cancelled and no-show orders are never counted.
2. **Window:** the last 30 days in Asia/Manila time, counting today. It uses
   `orders.order_date`, which is already saved as the Manila date.
3. **Order:** most units sold first. Ties go to higher revenue, then to the
   lower `menu_item_id`, so the order is always the same.
4. **Limit:** at most 10 items. Fewer if fewer items have sales.

To change the window or the limit, edit `BEST_SELLER_DAYS` or
`BEST_SELLER_LIMIT` in `backend/services/bestSellers.js`.

## Unavailable and deleted items

- **Unavailable items are still ranked.** Turning an item off does not erase
  its sales history, and it keeps its badge while it is in the Top 10.
- **Deleted items cannot appear.** The menu API refuses to delete an item that
  was ever ordered, so every item with sales still exists.

## Performance

The query joins `orders` and `order_items` and groups by menu item. At campus
cafeteria volume this is fast without new indexes, so none were added. If
`order_items` grows very large, an index on `order_items (order_id)` is the
first one to add.
