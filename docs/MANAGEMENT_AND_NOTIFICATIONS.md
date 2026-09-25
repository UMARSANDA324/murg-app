# Management and Notifications

## Management

`/management` is an Admin-only React page backed by `GET /api/management/overview`, audit-log retrieval, and the bridge-ticket endpoint. The overview repository aggregates operational data such as sales, stock, debts, active staff, shipments, and received stock according to its current SQL. It is an administrative view, not a second business-calculation engine.

`GET /api/management/audit-logs` is Admin-only and supports pagination plus action/branch filters. `POST /api/management/bridge-ticket` issues a short-lived, single-use ticket only for allowlisted legacy destinations. Admin targets may include supported `/system` screens; non-admin targets are restricted to supported `/sub` screens.

## Notifications

`notifications` stores target user, target role/branch, title/message/type, reference ID, read flag, read timestamp, and creation time. `notificationRepository` resolves notifications for the authenticated user/role/branch. The dashboard layout fetches unread count and recent notifications, marks visible notifications read when the panel opens, and supports mark-one, mark-list, and mark-all operations.

Goods-request mutations publish notifications and branch events where implemented. Notifications are in-app persistence; email is handled separately by the password-reset email service.
