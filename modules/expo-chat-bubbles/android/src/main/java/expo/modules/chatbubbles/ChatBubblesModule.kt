package expo.modules.chatbubbles

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person
import androidx.core.content.pm.ShortcutInfoCompat
import androidx.core.content.pm.ShortcutManagerCompat
import androidx.core.graphics.drawable.IconCompat
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.net.URL

private const val MODULE_NAME = "ExpoChatBubbles"
private const val CHANNEL_ID = "chat_bubbles"
private const val DEEP_LINK_SCHEME = "com.fatties.youth"

// Posts an Android "bubble" (floating chat head) notification for a
// conversation. Bubbles are an Android-only OS feature (no iOS equivalent) -
// this module is Android-only, see modules/expo-chat-bubbles/index.ts for
// the platform guard on the JS side.
//
// Two things a bubble notification needs beyond a normal one:
//  1. A long-lived dynamic shortcut for the conversation (the OS requires
//     a shortcut behind any bubble).
//  2. NotificationCompat.BubbleMetadata attached to the notification,
//     pointing at the same content Intent used for the shortcut and for a
//     normal notification tap.
// On API < 30 (bubbles were finalized in Android 11), BubbleMetadata is
// simply ignored by the OS and this degrades to a normal notification.
class ChatBubblesModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name(MODULE_NAME)

    AsyncFunction("showBubble") { conversationId: String, title: String, message: String, avatarUrl: String? ->
      showBubbleInternal(conversationId, title, message, avatarUrl)
    }
  }

  private fun ensureChannel(manager: NotificationManager) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return

    val channel = NotificationChannel(
      CHANNEL_ID,
      "Tin nhắn (bubble)",
      NotificationManager.IMPORTANCE_HIGH
    ).apply {
      description = "Thông báo tin nhắn dạng bubble nổi trên màn hình"
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        setAllowBubbles(true)
      }
    }
    manager.createNotificationChannel(channel)
  }

  private fun contentIntent(conversationId: String): PendingIntent {
    val intent = Intent(
      Intent.ACTION_VIEW,
      Uri.parse("$DEEP_LINK_SCHEME://chat/$conversationId")
    ).apply {
      setPackage(context.packageName)
    }
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or
      (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
    return PendingIntent.getActivity(context, conversationId.hashCode(), intent, flags)
  }

  private fun downloadAvatarBitmap(avatarUrl: String?): Bitmap? {
    if (avatarUrl.isNullOrBlank()) return null
    return try {
      URL(avatarUrl).openStream().use { BitmapFactory.decodeStream(it) }
    } catch (e: Exception) {
      null
    }
  }

  private fun appNotificationIcon(): Int {
    // The small-icon drawable is bundled in the host app's own resources
    // (expo-notifications already registers "notification_icon"), not this
    // module's - look it up by name instead of a compile-time R reference.
    val resId = context.resources.getIdentifier("notification_icon", "drawable", context.packageName)
    return if (resId != 0) resId else context.applicationInfo.icon
  }

  private fun showBubbleInternal(conversationId: String, title: String, message: String, avatarUrl: String?) {
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    ensureChannel(manager)

    val avatarBitmap = downloadAvatarBitmap(avatarUrl)
    val icon = avatarBitmap?.let { IconCompat.createWithBitmap(it) }
      ?: IconCompat.createWithResource(context, appNotificationIcon())

    val person = Person.Builder()
      .setName(title)
      .setIcon(icon)
      .setImportant(true)
      .build()

    val shortcutId = "chat_$conversationId"
    val pendingIntent = contentIntent(conversationId)

    val shortcut = ShortcutInfoCompat.Builder(context, shortcutId)
      .setLongLived(true)
      .setShortLabel(title)
      .setIcon(icon)
      .setPerson(person)
      .setIntent(
        Intent(Intent.ACTION_VIEW).apply {
          setPackage(context.packageName)
          data = Uri.parse("$DEEP_LINK_SCHEME://chat/$conversationId")
        }
      )
      .build()

    try {
      ShortcutManagerCompat.pushDynamicShortcut(context, shortcut)
    } catch (e: Exception) {
      // Shortcut publishing can fail (e.g. rate-limited) - the notification
      // still works as a normal one without a bubble in that case.
    }

    val bubbleMetadata = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      NotificationCompat.BubbleMetadata.Builder(pendingIntent, icon)
        .setDesiredHeight(600)
        .setAutoExpandBubble(false)
        .setSuppressNotification(false)
        .build()
    } else null

    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(appNotificationIcon())
      .setContentTitle(title)
      .setContentText(message)
      .setStyle(
        NotificationCompat.MessagingStyle(person)
          .addMessage(message, System.currentTimeMillis(), person)
      )
      .setShortcutId(shortcutId)
      .setCategory(NotificationCompat.CATEGORY_MESSAGE)
      .setContentIntent(pendingIntent)
      .setAutoCancel(true)
      .apply { if (bubbleMetadata != null) setBubbleMetadata(bubbleMetadata) }
      .build()

    NotificationManagerCompat.from(context).notify(shortcutId, conversationId.hashCode(), notification)
  }
}
