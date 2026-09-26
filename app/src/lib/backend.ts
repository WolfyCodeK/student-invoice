// Typed wrappers for every Rust command (see docs/architecture.md). The UI
// calls these instead of `invoke` so argument names and result shapes are
// checked by TypeScript in one place.
import { invoke } from '@tauri-apps/api/core'

/** Every command rejects with this shape (app/src-tauri/src/error.rs). */
export interface BackendError {
  kind:
    | 'NotConnected'
    | 'ReauthRequired'
    | 'NotConfigured'
    | 'AccessDenied'
    | 'Timeout'
    | 'Cancelled'
    | 'ScopeNotGranted'
    | 'Network'
    | 'Google'
    | 'Storage'
    | 'Update'
    | 'Invalid'
    | 'Internal'
  message: string
}

export function isBackendError(e: unknown): e is BackendError {
  return typeof e === 'object' && e !== null && 'kind' in e && 'message' in e
}

/** A message that is safe and useful to show the user for any thrown value. */
export function errorMessage(e: unknown): string {
  if (isBackendError(e)) return e.message
  if (e instanceof Error) return e.message
  return typeof e === 'string' ? e : 'Something went wrong.'
}

export interface GmailStatus {
  connected: boolean
  email: string | null
  configured: boolean
  clientSource: 'builtIn' | 'custom' | null
  connecting: boolean
}

export interface UpdateInfo {
  available: boolean
  currentVersion: string
  version: string | null
  notes: string | null
  date: string | null
  required: boolean
  disabledInDev: boolean
}

export const backend = {
  gmailStatus: () => invoke<GmailStatus>('gmail_status'),
  gmailConnect: () => invoke<GmailStatus>('gmail_connect'),
  gmailCancelConnect: () => invoke<void>('gmail_cancel_connect'),
  gmailDisconnect: () => invoke<GmailStatus>('gmail_disconnect'),
  gmailCreateDraft: (subject: string, body: string, to?: string) =>
    invoke<{ id: string }>('gmail_create_draft', { subject, body, to: to ?? null }),
  gmailSetCustomClient: (clientId: string, clientSecret: string) =>
    invoke<GmailStatus>('gmail_set_custom_client', { clientId, clientSecret }),
  gmailClearCustomClient: () => invoke<GmailStatus>('gmail_clear_custom_client'),
  checkForUpdates: () => invoke<UpdateInfo>('check_for_updates'),
  installUpdate: () => invoke<void>('install_update'),
}
