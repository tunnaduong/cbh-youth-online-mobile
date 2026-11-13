import ExpoModulesCore

/// PushKit must be registered while the app launches, otherwise a VoIP push
/// that starts the app in the background has nobody to deliver to.
public class CbhCallUiAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    CallKitManager.shared.setUp()
    return true
  }
}
