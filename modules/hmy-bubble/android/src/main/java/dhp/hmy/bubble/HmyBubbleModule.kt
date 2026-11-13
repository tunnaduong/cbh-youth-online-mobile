package dhp.hmy.bubble

import android.content.Intent
import android.net.Uri
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class HmyBubbleModule : Module() {
  private val context get() = requireNotNull(appContext.reactContext)

  override fun definition() = ModuleDefinition {
    Name("HmyBubble")

    Function("setEnabled") { enabled: Boolean ->
      BubbleStore.setEnabled(context, enabled)
      if (enabled) BubbleNotifier.ensureChannel(context)
    }

    Function("areBubblesAllowed") { BubbleNotifier.areBubblesAllowed(context) }

    Function("openBubbleSettings") {
      val intent = Intent(Settings.ACTION_APP_NOTIFICATION_BUBBLE_SETTINGS)
        .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        context.startActivity(intent)
      } catch (_: Throwable) {
        context.startActivity(
          Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
            .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
      }
    }

    /** Android battery optimisation: whether the app is already exempt. */
    Function("isIgnoringBatteryOptimizations") {
      val pm = context.getSystemService(android.os.PowerManager::class.java)
      pm?.isIgnoringBatteryOptimizations(context.packageName) ?: true
    }

    /** The system "let the app run in the background" dialog. */
    Function("requestIgnoreBatteryOptimizations") {
      try {
        context.startActivity(
          Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:${context.packageName}"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
      } catch (e: Throwable) {
        android.util.Log.w("HmyBubble", "battery optimisation dialog failed", e)
      }
    }

    Function("setSession") { apiBase: String, token: String -> BubbleStore.setSession(context, apiBase, token) }
    Function("clearSession") { BubbleStore.clearSession(context) }

    /** The chat is open in the app: drop its bubble and notification. */
    Function("dismiss") { conversationId: String -> BubbleNotifier.cancel(context, conversationId) }

    /** "Open in bubble" from the chat screen: raise this conversation as an expanded bubble now. */
    AsyncFunction("openBubble") { conversationId: String, title: String, avatarUrl: String? ->
      try {
        BubbleNotifier.showChat(
          context, conversationId, null, title.ifEmpty { "CBH" }, "", autoExpand = true,
          knownAvatarUrl = avatarUrl?.takeIf { it.startsWith("http") }
        )
        true
      } catch (e: Throwable) {
        android.util.Log.e("HmyBubble", "openBubble failed", e)
        false
      }
    }

    /** From inside the bubble: fold it back to the floating icon. */
    Function("collapse") { BubbleActivity.current?.get()?.runOnUiThread { BubbleActivity.current?.get()?.finish() } }

    /** From inside the bubble: continue in the full app. */
    Function("openApp") { conversationId: String ->
      val intent = Intent(Intent.ACTION_VIEW, Uri.parse("com.fatties.youth://chat/$conversationId"))
        .setPackage(context.packageName)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      context.startActivity(intent)
      BubbleActivity.current?.get()?.runOnUiThread { BubbleActivity.current?.get()?.finish() }
    }
  }
}
