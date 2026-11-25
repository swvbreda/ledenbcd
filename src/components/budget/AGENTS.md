# Budget components

- Finance planning concepts are static dated snapshots served by an admin-checked server function and shown as a concept year tab (`?tab=dashboard&year=<concept year>`; legacy `?tab=begroting-<year>` redirects there); the concept year disables auto-sync and shows no booked-budget sections, so drafts cannot alter or be mistaken for booked budgets.
- Concept-year dashboards reuse the booked-year table components through opt-in `readOnly`/`noRealisation`/`concept` props (default off), fed by mapped server snapshot rows with no expenses, so booked-year behaviour is unchanged and concepts never show editing controls or fake realisation.
