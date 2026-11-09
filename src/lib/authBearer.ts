/** Auth-event delivery only; memory is cleared on sign-out, never persisted or logged.
 * This is transport, not authorization: protected server functions verify this bearer.
 */
let bearer: string | null = null;
export function setAuthBearer(token:string|null){bearer=token;}
export function getAuthBearer(){return bearer;}