# NGINX CSP nonce injection for ValyntApp

The production NGINX CSP now uses a nonce-based `script-src`:

- `script-src 'self' 'nonce-$request_id'`
- no `'unsafe-inline'` is allowed for scripts.

## How nonce injection works

`default.conf` injects `nonce="$request_id"` into every `<script ...>` tag for `text/html` responses using `sub_filter`.

Because `nginx.conf` and `default.conf` both use the same `$request_id` variable per request:

1. The `Content-Security-Policy` response header contains `'nonce-$request_id'`.
2. Script tags in delivered HTML receive `nonce="$request_id"`.
3. Any inline script executes only when the nonce matches.
4. Inline scripts without this nonce are blocked by CSP.

## If app templates render inline scripts directly

Ensure rendered script tags include the same request nonce:

```html
<script nonce="{{request_id_or_csp_nonce}}">/* inline script */</script>
```

For non-NGINX template rendering, pass a generated nonce value into both:

- CSP header (`script-src 'nonce-<value>'`)
- inline `<script nonce="<value>">`

## Security posture changes

- `frame-ancestors` tightened to `'none'`.
- `Referrer-Policy` tightened to `strict-origin-when-cross-origin`.
