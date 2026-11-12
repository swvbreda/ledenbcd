# Minutes action tasks

- Stable action IDs belong to a meeting; immutable version bindings reference existing internal_tasks, so renaming never creates a second task and completion never resets.
- General task assignment remains admin-only; `board_minutes_set_task_status` permits only status transitions on private linked tasks for active assigned current board accounts (or admins), using existing completion triggers. Per-row `can_status` drives minutes controls; no base-table or project access is granted.
- Collective responsibility uses private register-member bindings with deterministic active-account matching (unique admin match first, otherwise unique account); unresolved records retain register names without creating accounts or granting task access.
- Private tasks never attach to projects/Microsoft, trigger notifications, or enter the external MCP feed; old archive rows stay disarmed and only the explicitly requested current concept has an activation button.
# Categories and conversation reports

- Meeting category lives on board_minutes_meetings (default Bestuursvergaderingen) and changes only via admin RPC `board_minutes_set_category`; a trigger forces tasks_enabled=false outside Bestuursvergaderingen and task-linked minutes cannot leave it, so reports never enter task sync.
- Conversation reports import only via `board_minutes_import_report` (ZIP manifest kind `gespreksverslagen`, `verslag:` source ids, idempotent by source id + hash, never adopted); unknown dates set date_known=false with a hidden placeholder date that the UI never shows.
