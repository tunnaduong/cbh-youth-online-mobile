import ExpoModulesCore

public class CbhCallUiModule: Module {
  private var observing = false

  public func definition() -> ModuleDefinition {
    Name("CbhCallUi")
    Events("onCallAction", "onVoipToken")

    Constants(["platformUi": "ios-callkit"])

    OnCreate {
      let manager = CallKitManager.shared
      manager.setUp()
      manager.onAction = { [weak self] event in
        guard let self, self.observing else { return false }
        self.sendEvent("onCallAction", event)
        return true
      }
      manager.onToken = { [weak self] token in
        self?.sendEvent("onVoipToken", ["token": token])
      }
    }

    OnStartObserving { self.observing = true }
    OnStopObserving { self.observing = false }

    Function("setSession") { (apiBase: String, token: String) in
      CallKitManager.shared.setSession(apiBase: apiBase, token: token)
    }

    Function("clearSession") {
      CallKitManager.shared.clearSession()
    }

    Function("getVoipToken") { () -> String? in
      CallKitManager.shared.voipToken
    }

    Function("consumePendingActions") { () -> [[String: String]] in
      CallKitManager.shared.consumePendingActions()
    }

    /// Ring through CallKit for a call JS learned of first (socket / poll);
    /// a no-op when the VoIP push already reported it.
    AsyncFunction("reportIncomingCall") { (callJson: String, callerName: String, hasVideo: Bool, promise: Promise) in
      guard let data = callJson.data(using: .utf8),
            let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let rawId = dict["id"] else {
        promise.resolve(false)
        return
      }
      CallKitManager.shared.reportIncoming(callId: "\(rawId)", callerName: callerName, hasVideo: hasVideo, json: callJson) {
        promise.resolve(true)
      }
    }.runOnQueue(.main)

    Function("endCall") { (callId: String, reason: String) in
      CallKitManager.shared.endCall(callId: callId, reason: reason)
    }.runOnQueue(.main)

    // Android-only; no-ops here so JS can call them blindly.
    Function("dismissIncoming") { (_: String) in }
    Function("callEnded") { (callId: String) in
      CallKitManager.shared.endCall(callId: callId, reason: "remoteEnded")
    }.runOnQueue(.main)
    Function("canUseFullScreenIntent") { true }
    Function("openFullScreenIntentSettings") {}
  }
}
