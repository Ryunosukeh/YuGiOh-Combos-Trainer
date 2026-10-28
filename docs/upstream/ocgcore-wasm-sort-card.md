# Entwurf: Fehlermeldung für n1xx1/ocgcore-wasm

> Noch nicht eingereicht. Erst nach Freigabe als Issue auf https://github.com/n1xx1/ocgcore-wasm öffnen.

**Titel:** SORT_CARD response writes a length byte that the core does not expect (always MSG_RETRY)

**Version:** ocgcore-wasm 0.1.6 (core baa3881)

`createResponse` serializes `OcgResponseType.SORT_CARD` as `i8(order.length)` followed by the order bytes:

```ts
case OcgResponseType.SORT_CARD:
  if (!response.order) { writer.i8(-1); break; }
  writer.i8(response.order.length);   // <- extra byte
  for (const i of response.order) writer.i8(i);
```

`field::process(Processors::SortCard&)` in ygopro-core reads the order directly from offset 0
(`returns.at<int8_t>(i)` for `i < select_cards.size()`), so the first value it sees is the length,
which is always `>= m` and the core answers with `MSG_RETRY`. Every non-default sort
(e.g. "Card Advance", SORT_CHAIN) is therefore impossible.

**Fix:** drop the `writer.i8(response.order.length)` line. Verified with "Card Advance" (52112003):
with the fix the deck top is reordered as requested; without it the core rejects every order.

---

# Second issue: MSG_MOVE drops the `reason` field

**Title:** MSG_MOVE: `reason` (u32) is not parsed

ygopro-core writes `code, from (loc_info), to (loc_info), reason (u32)` for MSG_MOVE (see `operations.cpp`,
`message->write<uint32_t>(pcard->current.reason)`), but `readMessage` only returns `{ card, from, to }`.
The reason is needed to tell destroyed / cost / material / effect moves apart (EDOPro uses it for its log).

**Fix:** `case MOVE: return { type, card: r.u32(), from: loc(r), to: loc(r), reason: r.u32() }`.
Verified with the acceptance combo of our project: e.g. 0x41 (destroy|effect), 0x80 (cost), 0x40048 (fusion material).
