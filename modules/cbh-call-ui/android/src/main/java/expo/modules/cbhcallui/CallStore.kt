package expo.modules.cbhcallui

import android.content.Context
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

/**
 * What the native side needs to know without JS running: the API address and
 * the signed-in account's token (so "Từ chối" on the lock screen can reject the
 * call even when the app process was started only to show it), plus the calls
 * already answered / declined, so a late push for the same call does not ring
 * again.
 */
object CallStore {
  private const val PREFS = "cbh_call_ui"
  private const val KEY_API = "api_base"
  private const val KEY_TOKEN = "auth_token"
  private const val KEY_HANDLED = "handled_calls"

  private fun prefs(ctx: Context) = ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun setSession(ctx: Context, apiBase: String, token: String) {
    prefs(ctx).edit().putString(KEY_API, apiBase.trimEnd('/')).putString(KEY_TOKEN, token).apply()
  }

  fun clearSession(ctx: Context) {
    prefs(ctx).edit().remove(KEY_TOKEN).apply()
  }

  fun hasSession(ctx: Context) = !prefs(ctx).getString(KEY_TOKEN, null).isNullOrEmpty()

  fun markHandled(ctx: Context, callId: String) {
    val p = prefs(ctx)
    val ids = (p.getString(KEY_HANDLED, "") ?: "").split(',').filter { it.isNotEmpty() }.toMutableList()
    if (!ids.contains(callId)) ids.add(callId)
    // Keep the list short: only recent calls can still get a late push.
    p.edit().putString(KEY_HANDLED, ids.takeLast(30).joinToString(",")).apply()
  }

  fun isHandled(ctx: Context, callId: String): Boolean =
    (prefs(ctx).getString(KEY_HANDLED, "") ?: "").split(',').contains(callId)

  /** POST /v1.0/chat/calls/{id}/reject with the stored token, off the main thread. */
  fun rejectCallInBackground(ctx: Context, callId: String, done: (() -> Unit)? = null) {
    val p = prefs(ctx)
    val api = p.getString(KEY_API, null)
    val token = p.getString(KEY_TOKEN, null)
    if (api.isNullOrEmpty() || token.isNullOrEmpty()) {
      done?.invoke()
      return
    }
    thread(name = "cbh-call-reject") {
      try {
        val conn = URL("$api/v1.0/chat/calls/$callId/reject").openConnection() as HttpURLConnection
        conn.requestMethod = "POST"
        conn.connectTimeout = 8000
        conn.readTimeout = 8000
        conn.doOutput = true
        conn.setRequestProperty("Authorization", "Bearer $token")
        conn.setRequestProperty("Accept", "application/json")
        conn.setRequestProperty("Content-Type", "application/json")
        conn.outputStream.use { it.write(JSONObject().put("reason", "rejected").toString().toByteArray()) }
        conn.responseCode
        conn.disconnect()
      } catch (_: Throwable) {
      } finally {
        done?.invoke()
      }
    }
  }
}

/** One thing the user did with the system call UI, waiting for JS to pick it up. */
data class CallAction(val action: String, val call: JSONObject)

/**
 * Actions taken before JS listened (the app was cold-started by the call) wait
 * here; JS drains them with consumePendingActions() once CallContext mounts.
 */
object CallActionQueue {
  private val pending = mutableListOf<CallAction>()

  @Synchronized
  fun push(action: CallAction) {
    // A newer action on the same call replaces the older one ("show" -> "answer").
    pending.removeAll { it.call.optString("id") == action.call.optString("id") }
    pending.add(action)
  }

  @Synchronized
  fun drain(): List<CallAction> {
    val out = pending.toList()
    pending.clear()
    return out
  }
}
