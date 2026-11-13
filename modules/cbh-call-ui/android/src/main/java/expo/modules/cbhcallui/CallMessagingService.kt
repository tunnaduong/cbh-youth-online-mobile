package expo.modules.cbhcallui

import android.app.KeyguardManager
import android.content.Context
import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import org.json.JSONObject

/**
 * Sees every FCM message first (its intent filter outranks expo-notifications').
 *
 * - `incoming_call` while the app is not on screen: shown as a full-screen call
 *   notification here, and NOT passed on (otherwise the old plain banner would
 *   show as well). On screen, JS already shows its own incoming-call screen, so
 *   the push goes to expo-notifications as before.
 * - `call_cancelled`: the caller hung up / nobody answered - the ringing call
 *   notification is removed, then the push is passed on (it carries the
 *   "Cuộc gọi nhỡ" text expo-notifications shows).
 * - anything else: passed on unchanged.
 *
 * expo-notifications' delegate is reached by reflection so this module has no
 * build-time dependency on it (it can be prebuilt); proguard-rules.pro keeps it.
 */
class CallMessagingService : FirebaseMessagingService() {
  private val expoDelegate: Any? by lazy {
    try {
      Class.forName("expo.modules.notifications.service.delegates.FirebaseMessagingDelegate")
        .getConstructor(Context::class.java)
        .newInstance(this)
    } catch (e: Throwable) {
      Log.w(TAG, "expo-notifications delegate unavailable", e)
      null
    }
  }

  private fun forward(method: String, argType: Class<*>?, arg: Any?) {
    val target = expoDelegate ?: return
    try {
      if (argType == null) target.javaClass.getMethod(method).invoke(target)
      else target.javaClass.getMethod(method, argType).invoke(target, arg)
    } catch (e: Throwable) {
      Log.w(TAG, "forwarding $method failed", e)
    }
  }

  override fun onMessageReceived(remoteMessage: RemoteMessage) {
    Log.d("HmyBubble", "FCM received: ${remoteMessage.data["body"]?.take(120)}")
    val body = try {
      remoteMessage.data["body"]?.let { JSONObject(it) }
    } catch (_: Throwable) {
      null
    }

    if (body != null) when (body.optString("type")) {
      "incoming_call" -> {
        val call = body.optJSONObject("call")
        if (call != null && call.has("id") && !CallUiState.isAppVisible(this)) {
          IncomingCallNotifier.show(this, call, body.optString("conversation_name").takeIf { it.isNotEmpty() })
          return
        }
      }
      "chat_message" -> {
        // Chat bubbles (modules/hmy-bubble) take over chat pushes while the app is away.
        if (!CallUiState.isAppVisible(this) && bubbleHandled(body, remoteMessage)) return
      }
      "call_cancelled" -> {
        val callId = body.optString("call_id")
        IncomingCallNotifier.cancel(this, callId)
        if (callId.isNotEmpty()) CallStore.markHandled(this, callId)
        CbhCallUiModule.dispatch(
          CallAction("cancelled", body.optJSONObject("call") ?: JSONObject().put("id", callId)),
          queueIfNotObserving = false
        )
      }
    }

    forward("onMessageReceived", RemoteMessage::class.java, remoteMessage)
  }

  private fun bubbleHandled(body: JSONObject, remoteMessage: RemoteMessage): Boolean = try {
    Class.forName("dhp.hmy.bubble.BubbleHook")
      .getMethod("onChatPush", Context::class.java, String::class.java, String::class.java, String::class.java)
      .invoke(null, this, body.toString(), remoteMessage.data["title"], remoteMessage.data["message"]) as? Boolean ?: false
  } catch (_: Throwable) {
    false
  }

  override fun onNewToken(token: String) = forward("onNewToken", String::class.java, token)

  override fun onDeletedMessages() = forward("onDeletedMessages", null, null)

  companion object {
    private const val TAG = "CbhCallUi"
  }
}

/** Whether the app's activity is in front of the user right now (and unlocked). */
object CallUiState {
  @Volatile
  var activityResumed = false

  fun isAppVisible(ctx: Context): Boolean {
    if (!activityResumed) return false
    val km = ctx.getSystemService(KeyguardManager::class.java)
    return km?.isKeyguardLocked != true
  }
}
