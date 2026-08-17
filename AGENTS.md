# Project Notes

## Trade Picks (app/api/trade-picks/scan/route.ts)

User preference for contract selection:
- Contracts must NOT have a wide spread (tight spread only).
- Contracts must have HIGH volume and HIGH open interest.
- This is enforced in `bestContract()` and in the final combo scoring.
