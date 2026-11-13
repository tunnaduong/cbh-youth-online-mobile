package expo.modules.cbhcallui

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityLifecycleListener
import org.json.JSONObject
import java.lang.ref.WeakReference

class CbhCallUiPackage : Package {
  override fun createReactActivityLifecycleListeners(activityContext: Context): List<ReactActivityLifecycleListener> =
    listOf(CallActivityLifecycleListener())
}

/**
 * Runs inside MainActivity's own onCreate / onNewIntent, i.e. early enough to
 * put the activity above the lock screen before it is first drawn - that is
 * what makes the full-screen intent open the app over the lock screen.
 */
class CallActivityLifecycleListener : ReactActivityLifecycleListener {
  override fun onCreate(activity: Activity, savedInstanceState: Bundle?) {
    LockScreen.activity = WeakReference(activity)
    handle(activity, activity.intent)
  }

  override fun onResume(activity: Activity) {
    LockScreen.activity = WeakReference(activity)
    CallUiState.activityResumed = true
  }

  override fun onPause(activity: Activity) {
    CallUiState.activityResumed = false
  }

  override fun onNewIntent(intent: Intent): Boolean {
    LockScreen.activity?.get()?.let { handle(it, intent) }
    return false
  }

  private fun handle(activity: Activity, intent: Intent?) {
    val action = intent?.getStringExtra(IncomingCallNotifier.EXTRA_ACTION) ?: return
    val callJson = intent.getStringExtra(IncomingCallNotifier.EXTRA_CALL)
    // Consumed once: a recreated activity must not ring the same call again.
    intent.removeExtra(IncomingCallNotifier.EXTRA_ACTION)
    intent.removeExtra(IncomingCallNotifier.EXTRA_CALL)
    val call = try {
      JSONObject(callJson ?: return)
    } catch (_: Throwable) {
      return
    }
    val callId = call.optString("id")
    if (callId.isNotEmpty() && CallStore.isHandled(activity, callId)) return

    LockScreen.show(activity)
    if (action == "answer") {
      // Answering stops the notification's ringing at once; for "show" JS
      // removes it when its own ringing screen is up.
      IncomingCallNotifier.cancel(activity, callId)
      CallStore.markHandled(activity, callId)
    }
    CbhCallUiModule.dispatch(CallAction(action, call), queueIfNotObserving = true)
  }
}

/** Lets the activity show over the lock screen only for the length of a call. */
object LockScreen {
  @Volatile
  var activity: WeakReference<Activity>? = null

  fun show(activity: Activity) = set(activity, true)

  fun release() {
    val a = activity?.get() ?: return
    a.runOnUiThread { set(a, false) }
  }

  private fun set(a: Activity, on: Boolean) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      a.setShowWhenLocked(on)
      a.setTurnScreenOn(on)
    } else {
      @Suppress("DEPRECATION")
      val flags = WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
      if (on) a.window.addFlags(flags) else a.window.clearFlags(flags)
    }
  }
}
