package expo.modules.cbhcallui

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class CbhCallUiModule : Module() {
  private val context get() = requireNotNull(appContext.reactContext)
  @Volatile private var observing = false

  override fun definition() = ModuleDefinition {
    Name("CbhCallUi")
    Events("onCallAction", "onVoipToken")

    OnCreate { instance = this@CbhCallUiModule }
    OnDestroy { if (instance === this@CbhCallUiModule) instance = null }
    OnStartObserving { observing = true }
    OnStopObserving { observing = false }

    Constants("platformUi" to "android-fullscreen")

    Function("setSession") { apiBase: String, token: String ->
      CallStore.setSession(context, apiBase, token)
      IncomingCallNotifier.ensureChannel(context)
    }

    Function("clearSession") {
      CallStore.clearSession(context)
    }

    Function("consumePendingActions") {
      CallActionQueue.drain().map { mapOf("action" to it.action, "call" to it.call.toString()) }
    }

    /** JS is ringing on its own screen now: drop the ringing notification. */
    Function("dismissIncoming") { callId: String ->
      IncomingCallNotifier.cancel(context, callId)
    }

    /** The call is over (any reason): no notification, no lock-screen override. */
    Function("callEnded") { callId: String ->
      IncomingCallNotifier.cancel(context, callId)
      if (callId.isNotEmpty()) CallStore.markHandled(context, callId)
      LockScreen.release()
    }

    Function("canUseFullScreenIntent") {
      IncomingCallNotifier.canUseFullScreenIntent(context)
    }

    Function("openFullScreenIntentSettings") {
      val intent = if (Build.VERSION.SDK_INT >= 34) {
        Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:${context.packageName}"))
      } else {
        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
      }
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        context.startActivity(intent)
      } catch (_: Throwable) {
      }
    }

    // iOS-only (CallKit / PushKit); no-ops here so JS can call them blindly.
    Function("getVoipToken") { null as String? }
    Function("reportIncomingCall") { _: String, _: String, _: Boolean -> }
    Function("endCall") { callId: String, _: String ->
      IncomingCallNotifier.cancel(context, callId)
    }
  }

  private fun emit(action: CallAction): Boolean {
    if (!observing) return false
    sendEvent("onCallAction", mapOf("action" to action.action, "call" to action.call.toString()))
    return true
  }

  companion object {
    @Volatile private var instance: CbhCallUiModule? = null

    /** Send to JS if it listens; otherwise keep it for consumePendingActions(). */
    fun dispatch(action: CallAction, queueIfNotObserving: Boolean) {
      val delivered = try {
        instance?.emit(action) == true
      } catch (_: Throwable) {
        false
      }
      if (!delivered && queueIfNotObserving) CallActionQueue.push(action)
    }
  }
}
