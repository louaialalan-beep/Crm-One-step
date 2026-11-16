# رواق CRM — Firestore Security Specification

## 1. Data Invariants
1. **Default-Deny Baseline**: Every unmapped path is denied by `match /{document=**} { allow read, write: if false; }`.
2. **PII Isolation (`users`)**: User documents contain `email` and `fullName` PII. Only the owning user (`userId == request.auth.uid`) or verified admin can read/list/write a user record.
3. **Tenant / Owner Boundary**: Every workspace document in `profiles`, `roles`, `custom_fields`, `leads`, `contacts`, `accounts`, `deals`, `quotes`, `sales_orders`, `invoices`, `touchpoints`, `messages`, `tasks`, `blueprints`, `workflows`, and `recycle_bin` must carry `ownerId == request.auth.uid` on creation and maintain immutable `ownerId` and `createdAt` across updates.
4. **Query Enforcer (`allow list`)**: Every `allow list` rule evaluates `resource.data.ownerId == request.auth.uid` (or `resource.data.uid == request.auth.uid` for `users`) directly without `get()` or `exists()` lookups.
5. **Temporal Integrity**: `createdAt == request.time` on creation; `updatedAt == request.time` and `createdAt == existing().createdAt` on updates.
6. **Lead ID Pattern**: Every `leads` document requires `unique_id.matches('^RWQ-[0-9]{5}$')`.
7. **Strict Key & Size Guards**: Every `create` checks `keys().hasAll(...)` and `keys().hasOnly(...)`; every `update` uses `affectedKeys().hasOnly(...)` action branches and passes `isValid[Entity](incoming())`. Every string field has explicit `.size()` bounds.

## 2. Adversarial "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated read/write**: `request.auth == null` on `/deals/deal_1` -> Denied.
2. **Unverified email write**: `request.auth.token.email_verified == false` on `/leads/lead_1` -> Denied.
3. **Path ID poisoning**: `/leads/../../etc/passwd` or 300-char ID -> Denied by `isValidId()`.
4. **Owner spoofing on create**: `/deals/deal_x` with `ownerId: "other-uid"` -> Denied.
5. **Shadow / Ghost field injection**: `/deals/deal_x` with extra field `isApprovedOverride: true` -> Denied by `keys().hasOnly(...)`.
6. **Timestamp forgery**: `/leads/lead_x` with backdated `createdAt` instead of `request.time` -> Denied.
7. **Owner mutation on update**: Updating `ownerId` on an existing `/accounts/acc_1` -> Denied.
8. **Lead ID format violation**: `/leads/lead_x` with `unique_id: "INVALID-1"` -> Denied by regex `^RWQ-[0-9]{5}$`.
9. **Oversized string DoS**: `/messages/msg_1` with `body` > 2000 chars -> Denied by `.size()`.
10. **Cross-tenant `list` scrape**: Querying `/invoices` without `where('ownerId', '==', auth.uid)` -> Denied by `resource.data.ownerId == request.auth.uid`.
11. **PII cross-user read**: Reading `/users/other-uid` as non-admin -> Denied.
12. **Terminal state bypass**: Modifying an already `مكتملة` invoice amount without admin status -> Denied by terminal lock.
