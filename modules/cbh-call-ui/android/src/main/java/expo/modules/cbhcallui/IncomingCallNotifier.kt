package expo.modules.cbhcallui

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person
import androidx.core.graphics.drawable.IconCompat
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * The Android side of "an incoming call looks like a phone call": a CallStyle
 * notification with Answer / Decline, a full-screen intent (the app opens over
 * the lock screen when the phone is locked or idle, a heads-up call banner when
 * it is in use) and a ringtone that repeats until the call is handled.
 */
object IncomingCallNotifier {
  // A channel's sound cannot change after it is created, hence a new id rather
  // than the "calls" channel expo-notifications creates for the old banner.
  const val CHANNEL_ID = "cbh_incoming_calls"
  const val EXTRA_ACTION = "cbh_call_action"
  const val EXTRA_CALL = "cbh_call_payload"
  const val ACTION_DECLINE = "expo.modules.cbhcallui.DECLINE"

  private const val RING_TIMEOUT_MS = 60_000L

  fun notificationId(callId: String) = ("cbh_call_$callId").hashCode()

  fun ensureChannel(ctx: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
    if (nm.getNotificationChannel(CHANNEL_ID) != null) return
    val channel = NotificationChannel(CHANNEL_ID, "Cuộc gọi đến", NotificationManager.IMPORTANCE_HIGH).apply {
      description = "Cuộc gọi thoại và video đến, hiện toàn màn hình"
      enableVibration(true)
      vibrationPattern = longArrayOf(0, 1000, 1000, 1000, 1000)
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      enableLights(true)
      lightColor = Color.parseColor("#319527")
      setSound(
        RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE),
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build()
      )
      setBypassDnd(true)
    }
    nm.createNotificationChannel(channel)
  }

  private fun launchIntent(ctx: Context, action: String, call: JSONObject): Intent? {
    val intent = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName) ?: return null
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    intent.putExtra(EXTRA_ACTION, action)
    intent.putExtra(EXTRA_CALL, call.toString())
    return intent
  }

  private fun pendingFlags() =
    PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= 23) PendingIntent.FLAG_IMMUTABLE else 0)

  private fun smallIcon(ctx: Context): Int {
    val id = ctx.resources.getIdentifier("notification_icon", "drawable", ctx.packageName)
    return if (id != 0) id else ctx.applicationInfo.icon
  }

  private fun loadAvatar(url: String?): Bitmap? {
    if (url.isNullOrEmpty() || !url.startsWith("http")) return null
    return try {
      val conn = URL(url).openConnection() as HttpURLConnection
      conn.connectTimeout = 2500
      conn.readTimeout = 2500
      conn.inputStream.use { BitmapFactory.decodeStream(it) }.also { conn.disconnect() }
    } catch (_: Throwable) {
      null
    }
  }

  /** Must run off the main thread (it may fetch the caller's avatar). */
  fun show(ctx: Context, call: JSONObject, conversationName: String? = null) {
    val callId = call.optString("id")
    if (callId.isEmpty() || CallStore.isHandled(ctx, callId)) return
    ensureChannel(ctx)

    val caller = call.optJSONObject("caller")
    val callerName = caller?.optString("profile_name")?.takeIf { it.isNotEmpty() }
      ?: caller?.optString("username")?.takeIf { it.isNotEmpty() }
      ?: "CBH Youth Online"
    val isVideo = call.optString("type") == "video"
    val subtitle = when {
      !conversationName.isNullOrEmpty() -> if (isVideo) "Cuộc gọi video nhóm · $conversationName" else "Cuộc gọi thoại nhóm · $conversationName"
      isVideo -> "Cuộc gọi video đến"
      else -> "Cuộc gọi thoại đến"
    }

    val reqBase = notificationId(callId)
    val showIntent = launchIntent(ctx, "show", call) ?: return
    val answerIntent = launchIntent(ctx, "answer", call) ?: return
    val fullScreenPI = PendingIntent.getActivity(ctx, reqBase, showIntent, pendingFlags())
    val answerPI = PendingIntent.getActivity(ctx, reqBase + 1, answerIntent, pendingFlags())
    val declinePI = PendingIntent.getBroadcast(
      ctx,
      reqBase + 2,
      Intent(ctx, CallActionReceiver::class.java).apply {
        action = ACTION_DECLINE
        putExtra(EXTRA_CALL, call.toString())
      },
      pendingFlags()
    )

    val personBuilder = Person.Builder().setName(callerName).setImportant(true)
    loadAvatar(caller?.optString("avatar_url"))?.let { personBuilder.setIcon(IconCompat.createWithBitmap(it)) }
    val person = personBuilder.build()

    val builder = NotificationCompat.Builder(ctx, CHANNEL_ID)
      .setSmallIcon(smallIcon(ctx))
      .setColor(Color.parseColor("#319527"))
      .setContentTitle(callerName)
      .setContentText(subtitle)
      .setCategory(NotificationCompat.CATEGORY_CALL)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setOngoing(true)
      .setAutoCancel(false)
      .setOnlyAlertOnce(false)
      .setContentIntent(fullScreenPI)
      .setFullScreenIntent(fullScreenPI, true)
      .setTimeoutAfter(RING_TIMEOUT_MS)
      .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE))
      .setVibrate(longArrayOf(0, 1000, 1000, 1000, 1000))
      .setStyle(
        NotificationCompat.CallStyle.forIncomingCall(person, declinePI, answerPI)
          .setIsVideo(isVideo)
      )
      .addPerson(person)

    val notification = builder.build()
    // Keep ringing (sound + vibration repeat) until the notification goes away.
    notification.flags = notification.flags or Notification.FLAG_INSISTENT

    try {
      NotificationManagerCompat.from(ctx).notify(notificationId(callId), notification)
    } catch (_: SecurityException) {
      // POST_NOTIFICATIONS was refused: nothing can be shown.
    }
  }

  fun cancel(ctx: Context, callId: String?) {
    if (callId.isNullOrEmpty()) return
    NotificationManagerCompat.from(ctx).cancel(notificationId(callId))
  }

  fun canUseFullScreenIntent(ctx: Context): Boolean {
    if (Build.VERSION.SDK_INT < 34) return true
    val nm = ctx.getSystemService(NotificationManager::class.java) ?: return false
    return nm.canUseFullScreenIntent()
  }
}
