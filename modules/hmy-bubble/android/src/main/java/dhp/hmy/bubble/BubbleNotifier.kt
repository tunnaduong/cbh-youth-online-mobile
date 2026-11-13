package dhp.hmy.bubble

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Rect
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person
import androidx.core.content.pm.ShortcutInfoCompat
import androidx.core.content.pm.ShortcutManagerCompat
import androidx.core.graphics.drawable.IconCompat
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/** Builds the chat notification that Android shows as a bubble (Android 11+). */
object BubbleNotifier {
  private const val CHANNEL = "chat_bubbles"
  private const val MAX_LINES = 8

  fun supported() = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R

  fun ensureChannel(ctx: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
    if (nm.getNotificationChannel(CHANNEL) != null) return
    val ch = NotificationChannel(CHANNEL, "Chat bubbles", NotificationManager.IMPORTANCE_HIGH)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) ch.setAllowBubbles(true)
    nm.createNotificationChannel(ch)
  }

  fun areBubblesAllowed(ctx: Context): Boolean {
    if (!supported()) return false
    val nm = ctx.getSystemService(NotificationManager::class.java) ?: return false
    return nm.areBubblesAllowed()
  }

  fun notificationId(conversationId: String) = 0x4B000000 or (conversationId.hashCode() and 0xFFFFFF)

  fun cancel(ctx: Context, conversationId: String) {
    NotificationManagerCompat.from(ctx).cancel(notificationId(conversationId))
    if (supported()) ShortcutManagerCompat.removeDynamicShortcuts(ctx, listOf("chat_$conversationId"))
  }

  /** Sender avatar and name of the pushed message, read from the API with the stored token. */
  private fun fetchSender(ctx: Context, conversationId: String, messageId: String?): Pair<String?, String?> {
    val base = BubbleStore.apiBase(ctx) ?: return null to null
    val token = BubbleStore.token(ctx) ?: return null to null
    return try {
      val conn = URL("$base/v1.0/chat/conversations/$conversationId/messages?page=1").openConnection() as HttpURLConnection
      conn.connectTimeout = 3000
      conn.readTimeout = 3000
      conn.setRequestProperty("Authorization", "Bearer $token")
      conn.setRequestProperty("Accept", "application/json")
      val data = JSONObject(conn.inputStream.bufferedReader().use { it.readText() }).optJSONArray("data")
        ?: return null to null
      var found: JSONObject? = null
      for (i in data.length() - 1 downTo 0) {
        val m = data.optJSONObject(i) ?: continue
        if (messageId != null && m.opt("id")?.toString() == messageId) { found = m; break }
        if (messageId == null && found == null && m.optString("type") == "message") found = m
      }
      val sender = found?.optJSONObject("sender")
      sender?.optString("avatar_url")?.takeIf { it.startsWith("http") } to sender?.optString("profile_name")?.takeIf { it.isNotEmpty() }
    } catch (_: Throwable) {
      null to null
    }
  }

  private fun fetchBitmap(url: String?): Bitmap? {
    if (url == null) return null
    return try {
      val conn = URL(url).openConnection() as HttpURLConnection
      conn.connectTimeout = 2500
      conn.readTimeout = 2500
      conn.inputStream.use { BitmapFactory.decodeStream(it) }
    } catch (_: Throwable) {
      null
    }
  }

  /**
   * Avatar for people / groups without a picture: the brand green with their
   * initial, instead of the (monochrome, so dark) notification glyph.
   */
  private fun initialAvatar(label: String): Bitmap {
    val size = 192
    val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bmp)
    canvas.drawColor(0xFF319527.toInt())
    val text = label.trim().firstOrNull()?.uppercaseChar()?.toString() ?: "?"
    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = 0xFFFFFFFF.toInt()
      textSize = size * 0.42f
      isFakeBoldText = true
      textAlign = Paint.Align.CENTER
    }
    val bounds = Rect()
    paint.getTextBounds(text, 0, text.length, bounds)
    canvas.drawText(text, size / 2f, size / 2f + bounds.height() / 2f, paint)
    return bmp
  }

  fun showChat(
    ctx: Context,
    conversationId: String,
    messageId: String?,
    title: String,
    text: String,
    autoExpand: Boolean = false,
    knownAvatarUrl: String? = null,
  ) {
    if (!supported()) return
    ensureChannel(ctx)
    val (fetchedAvatar, senderName) =
      if (knownAvatarUrl != null) knownAvatarUrl to null else fetchSender(ctx, conversationId, messageId)
    val avatarUrl = fetchedAvatar
    val sender = senderName ?: title.substringBefore(" trong ")
    val conversationTitle = if (title.contains(" trong ")) title.substringAfter(" trong ") else sender
    val avatar = IconCompat.createWithAdaptiveBitmap(fetchBitmap(avatarUrl) ?: initialAvatar(conversationTitle))

    val person = Person.Builder().setName(sender).setIcon(avatar).setKey("chat_sender_$sender").setImportant(true).build()

    // Bubble window: one instance per conversation (distinct data URI + documentLaunchMode=always).
    val bubbleIntent = Intent(ctx, BubbleActivity::class.java)
      .setAction(Intent.ACTION_VIEW)
      .setData(Uri.parse("hmybubble://chat/$conversationId"))
      .putExtra("conversationId", conversationId)
    val bubblePending = PendingIntent.getActivity(
      ctx, notificationId(conversationId), bubbleIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
    )

    val shortcutId = "chat_$conversationId"
    val shortcut = ShortcutInfoCompat.Builder(ctx, shortcutId)
      .setLongLived(true)
      .setIntent(bubbleIntent)
      .setShortLabel(conversationTitle)
      .setIcon(avatar)
      .setPerson(person)
      .setIsConversation()
      .build()
    ShortcutManagerCompat.pushDynamicShortcut(ctx, shortcut)

    val bubble = NotificationCompat.BubbleMetadata.Builder(bubblePending, avatar)
      .setDesiredHeight(640)
      .setAutoExpandBubble(autoExpand)
      .setSuppressNotification(autoExpand)
      .build()

    // Tapping the notification (not the bubble) opens the main app on the chat.
    val open = Intent(Intent.ACTION_VIEW, Uri.parse("com.fatties.youth://chat/$conversationId"))
      .setPackage(ctx.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    val openPending = PendingIntent.getActivity(
      ctx, notificationId(conversationId) + 1, open,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    // Keep the earlier lines of this conversation: build on the visible notification's style.
    val nm = ctx.getSystemService(NotificationManager::class.java)
    val id = notificationId(conversationId)
    val existing = nm?.activeNotifications?.firstOrNull { it.id == id }?.notification
      ?.let { NotificationCompat.MessagingStyle.extractMessagingStyleFromNotification(it) }
    val style = NotificationCompat.MessagingStyle(Person.Builder().setName("Me").build())
    existing?.messages?.takeLast(MAX_LINES - 1)?.forEach { style.addMessage(it) }
    style.addMessage(text, System.currentTimeMillis(), person)
    if (title.contains(" trong ")) {
      style.conversationTitle = conversationTitle
      style.isGroupConversation = true
    }

    val notification = NotificationCompat.Builder(ctx, CHANNEL)
      .setSmallIcon(smallIcon(ctx))
      .setStyle(style)
      .setCategory(NotificationCompat.CATEGORY_MESSAGE)
      .setShortcutId(shortcutId)
      .setLocusId(androidx.core.content.LocusIdCompat(shortcutId))
      .setBubbleMetadata(bubble)
      .setContentIntent(openPending)
      .setAutoCancel(true)
      .setOnlyAlertOnce(autoExpand)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .build()
    try {
      NotificationManagerCompat.from(ctx).notify(id, notification)
    } catch (_: SecurityException) {
      // POST_NOTIFICATIONS refused: nothing to show.
    }
  }

  private fun smallIcon(ctx: Context): Int {
    val id = ctx.resources.getIdentifier("notification_icon", "drawable", ctx.packageName)
    return if (id != 0) id else ctx.applicationInfo.icon
  }
}
