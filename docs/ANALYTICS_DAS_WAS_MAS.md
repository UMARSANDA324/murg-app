# DAS / WAS / MAS

## Definitions

The endpoint is `GET /api/analytics/sales-activity`.

- **DAS**: distinct qualifying `orders.orderID` values whose order date is the target business day.
- **WAS**: distinct qualifying order IDs from Monday through Sunday of the target business week.
- **MAS**: distinct qualifying order IDs from the first through last day of the target business month.

The backend calculates all three in SQL. The frontend only displays returned values.

## Qualification

The aggregation reads `orders` only and counts distinct `orderID`. A credit/debt sale is included when `payment = 'Credit'` or `status = 0`. A normal completed sale is counted when it is not credit and has a nonzero status. Stock transfers, supplier purchases, goods requests, adjustments, and unrelated movement rows do not count.

The current SQL does not add a separate cancellation/reversal rule beyond the fields present in `orders`; inspect the order status/business workflow before changing that rule.

## Time and Scope

The repository uses Africa/Lagos (`+01:00`) business-date intent and returns period metadata. A `date` query parameter can select the target date. Non-admin requests are forced to the authenticated branch; an Admin can request a branch or omit `branchId` for the application-wide aggregate.

Example query:

```text
GET /api/analytics/sales-activity?branchId=all&date=2026-09-25
```

The response includes `das`, `was`, `mas`, normal/debt breakdowns, `scope`, and period boundaries. Branch authorization is backend-controlled.
