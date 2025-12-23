# Remaining Limits / Waiting on Configuration or Integrations

These are the last gaps compared to the Daily Sales app that require data/config or backend/device integration before we can complete them.

- **Scheduled delivery (email/WhatsApp) of reports**: Frontend shows an Export/Print flow and a stub “Schedule” button. Needs a backend endpoint/service to send PDFs/CSVs on a schedule.
- **Hardware receipt printing (ESC/POS / thermal)**: Needs device access and printer driver/API. Frontend is ready to print HTML/PDF; direct printer integration requires a native bridge or a printing service.
- **Branch/Channel analytics coverage**: ✅ **IMPLEMENTED** - Branch and channel selection UI added, fields saved to orders. Branch dropdown ready for Firestore integration.
- **Tax/Discount/Refund analytics**: ✅ **IMPLEMENTED** - Tax calculated (18% VAT), discount and refund fields saved to orders. All analytics now functional.
- **Timezone-aware day cutoffs**: User-selectable timezone offset is in the report; if you want per-user/org defaults, store the preferred timezone and pass it into the component.
- **Targets & alerts**: Targets are handled locally. For push/email/WhatsApp alerts on target breach/failure or sales spikes/drops, a backend notification pipeline is needed.
- **Sales rep data completeness**: Sales rep fields are captured on orders. Ensure reps exist with `SALES_REP` role and orders include `salesRepId`/`salesRepName`/`commission` for complete rep analytics.

