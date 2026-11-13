package hhh.hmy.bubble

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultReactActivityDelegate
import java.lang.ref.WeakReference

/**
 * The window inside the system bubble. It runs the app's own chat screen: a
 * second React root ("BubbleChat", see index.js / app/bubble/BubbleChatRoot.js)
 * on the same React host as the main activity.
 */
class BubbleActivity : ReactActivity() {
  override fun getMainComponentName() = "BubbleChat"

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null)
    current = WeakReference(this)
  }

  override fun onDestroy() {
    if (current?.get() === this) current = null
    super.onDestroy()
  }

  override fun createReactActivityDelegate(): ReactActivityDelegate =
    object : DefaultReactActivityDelegate(this, mainComponentName, true) {
      override fun getLaunchOptions(): Bundle =
        Bundle().apply { putString("conversationId", plainActivity.intent?.getStringExtra("conversationId")) }
    }

  companion object {
    @Volatile var current: WeakReference<BubbleActivity>? = null
  }
}
