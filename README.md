# Success Cafe - Durame Town

```
frontend/   the storefront (what customers see)
admin/      admin dashboard (payment verification)
backend/    Express + PostgreSQL API - see backend/README.md for setup
```

One Express app (in `backend/`) serves `frontend/` at `/`, `admin/` at
`/admin`, and the API at `/api/*`. There's nothing to run in
`frontend/` or `admin/` directly - start the backend and it serves
everything. See **backend/README.md** for setup steps.
