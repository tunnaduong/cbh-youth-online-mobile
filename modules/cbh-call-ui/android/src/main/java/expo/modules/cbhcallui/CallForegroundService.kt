package expo.modules.cbhcallui

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

/**
 * Keeps the microphone (and camera, for video) alive while a call runs and the
 * app is in the background. Without a foreground service of the right type,
 * Android 11+ silences the mic and freezes the camera as soon as the user
 * presses Home - the other side would hear nothing.
 */
class CallForegroundService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val title = intent?.getStringExtra(EXTRA_TITLE) ?: "CBH Youth Online"
    val video = intent?.getBooleanExtra(EXTRA_VIDEO, false) ?: false
    ensureChannel(this)

    val launch = packageManager.getLaunchIntentForPackage(packageName)
    val pending = launch?.let {
      PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }
    val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(applicationInfo.icon)
      .setContentTitle(title)
      .setContentText(if (video) "Đang trong cuộc gọi video" else "Đang trong cuộc gọi")
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setCategory(NotificationCompat.CATEGORY_CALL)
      .setContentIntent(pending)
      .build()

    try {
      if (Build.VERSION.SDK_INT >= 30) {
        var type = ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
        if (video) type = type or ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA
        startForeground(NOTIFICATION_ID, notification, type)
      } else {
        startForeground(NOTIFICATION_ID, notification)
      }
    } catch (_: Throwable) {
      // e.g. camera permission not granted: retry with the microphone only
      try {
        if (Build.VERSION.SDK_INT >= 30) {
          startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
        } else {
          startForeground(NOTIFICATION_ID, notification)
        }
      } catch (_: Throwable) {
        stopSelf()
      }
    }
    return START_NOT_STICKY
  }

  companion object {
    private const val CHANNEL_ID = "cbh_active_call"
    private const val NOTIFICATION_ID = 41007
    private const val EXTRA_TITLE = "title"
    private const val EXTRA_VIDEO = "video"

    private fun ensureChannel(context: Context) {
      if (Build.VERSION.SDK_INT < 26) return
      val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (nm.getNotificationChannel(CHANNEL_ID) == null) {
        val channel = NotificationChannel(CHANNEL_ID, "Cuộc gọi đang diễn ra", NotificationManager.IMPORTANCE_LOW)
        channel.setSound(null, null)
        nm.createNotificationChannel(channel)
      }
    }

    fun start(context: Context, title: String, video: Boolean) {
      val intent = Intent(context, CallForegroundService::class.java)
        .putExtra(EXTRA_TITLE, title)
        .putExtra(EXTRA_VIDEO, video)
      try {
        if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intent) else context.startService(intent)
      } catch (_: Throwable) {
        // app not allowed to start a foreground service right now: call still works in the foreground
      }
    }

    fun stop(context: Context) {
      try {
        context.stopService(Intent(context, CallForegroundService::class.java))
      } catch (_: Throwable) {
      }
    }
  }
}
