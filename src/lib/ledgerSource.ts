/** Records uit een vastgelegde Informer-bronsnapshot (UI), bijv. 'salesbook:SLUG' — niet uit de API. */
export function isSourceSnapshotId(informerId: string | null | undefined): boolean {
  return /^[a-z_]+:/i.test(String(informerId ?? ""));
}
