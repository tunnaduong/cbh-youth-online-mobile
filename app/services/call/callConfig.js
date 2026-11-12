/**
 * Master feature flag for WebRTC Voice & Video calls.
 * When `CALL_FEATURES_ENABLED` is `false`:
 * - Public UI triggers (ConversationHeader call button, CallMessageCard callback button) are hidden.
 * - Loophole mode for notifications: Tapping an incoming call notification still pops up the Call UI
 *   and plays the authentic OPPO ringtone, but both Answer ("call") and Deny ("reject") safely exit
 *   and stop the ringtone immediately without attempting WebRTC media streaming.
 * Toggle to `true` to fully enable real WebRTC calling app-wide.
 */
export const CALL_FEATURES_ENABLED = true;
