package hhh.hmy.bubble

import android.content.Context
import android.util.Log
import org.json.JSONObject

/**
 * Called by the call module's FCM service (reflection, so the modules stay
 * independent) for every push while the app is not in front. Returns true when
 * it took over a chat push as a bubble - the regular notification is then
 * skipped so the message does not show twice.
 */
object BubbleHook {
  @JvmStatic
  fun onChatPush(ctx: Context, bodyJson: String?, title: String?, message: String?): Boolean {
    if (!BubbleNotifier.supported() || !BubbleStore.isEnabled(ctx)) {
      Log.d("HmyBubble", "chat push ignored: bubbles off (enabled=${BubbleStore.isEnabled(ctx)})")
      return false
    }
    if (!BubbleNotifier.areBubblesAllowed(ctx)) {
      Log.d("HmyBubble", "chat push ignored: bubbles not allowed by the system")
      return false
    }
    return try {
      val body = JSONObject(bodyJson ?: return false)
      if (body.optString("type") != "chat_message") return false
      val conversationId = body.opt("conversation_id")?.toString()?.takeIf { it.isNotEmpty() } ?: return false
      BubbleNotifier.showChat(
        ctx, conversationId, body.opt("message_id")?.toString(),
        title?.takeIf { it.isNotEmpty() } ?: "CBH", message ?: ""
      )
      Log.d("HmyBubble", "chat push shown as bubble for $conversationId")
      true
    } catch (e: Throwable) {
      Log.w("HmyBubble", "chat push -> bubble failed", e)
      false
    }
  }
}
