# Firebase Go-Live Checklist

Use this once to connect live product cards.

1. Open Firebase Console and select project `motvin-prod`.
2. Go to Firestore Database and create database if not enabled.
3. Open Firestore Rules.
4. For normal site + admin operation: publish `Firebase/firestore.rules.active.txt`.
5. Use `Firebase/firestore.rules.dev.txt` only when you intentionally want read-only products (admin writes blocked).
6. Use `Firebase/firestore.rules.seed-open.txt` only for temporary seed/import work, then switch back to `Firebase/firestore.rules.active.txt`.
7. In Firestore Data, create collection `products` if missing.
8. Add documents from `Firebase/products.seed.json`.
9. Open site pages and verify cards render:
   - files.html
   - my-post.html
   - mobile-template.html
   - web-template.html
   - filter-template.html
10. In browser console, run:

```js
document.body.dataset.productSource
```

Expected value: `firebase`.

If value is `fallback`:
- Ensure collection name is `products`.
- Ensure rules are published.
- Ensure docs have `title` and `productType`.
- Check browser console for `Firebase fetch failed` messages.
