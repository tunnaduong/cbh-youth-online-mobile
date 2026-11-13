package expo.modules.cbhcallui

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import org.json.JSONObject

/**
 * "Từ chối" on the call notification. Handled natively - the app is not opened
 * and JS may not be running - by rejecting the call on the API with the stored
 * token. If JS is running it is told too, so it drops its own ringing state.
 */
class CallActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != IncomingCallNotifier.ACTION_DECLINE) return
    val call = try {
      JSONObject(intent.getStringExtra(IncomingCallNotifier.EXTRA_CALL) ?: return)
    } catch (_: Throwable) {
      return
    }
    val callId = call.optString("id")
    IncomingCallNotifier.cancel(context, callId)
    CallStore.markHandled(context, callId)
    CbhCallUiModule.dispatch(CallAction("decline", call), queueIfNotObserving = false)

    val pending = goAsync()
    CallStore.rejectCallInBackground(context, callId) { pending.finish() }
  }
}
