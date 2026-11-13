# CallMessagingService hands every push that is not a call to expo-notifications'
# delegate through reflection (no compile-time dependency on that module), so R8
# must keep its name and its two entry points.
-keep class expo.modules.notifications.service.delegates.FirebaseMessagingDelegate {
  public <init>(android.content.Context);
  public void onMessageReceived(com.google.firebase.messaging.RemoteMessage);
  public void onNewToken(java.lang.String);
  public void onDeletedMessages();
}
-keep class expo.modules.cbhcallui.** { *; }
