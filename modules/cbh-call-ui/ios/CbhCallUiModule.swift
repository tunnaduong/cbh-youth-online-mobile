import ExpoModulesCore

public class CbhCallUiModule: Module {
  private var observing = false

  public func definition() -> ModuleDefinition {
    Name("CbhCallUi")
    Events("onCallAction", "onVoipToken")

    Constant("platformUi") { () -> String in
      "ios-callkit"
    }

    OnCreate {
      let manager = CallKitManager.shared
      manager.setUp()
      manager.onAction = { [weak self] (event: [String: String]) -> Bool in
        guard let self = self, self.observing else { return false }
        var body: [String: Any?] = [:]
        for (key, value) in event {
          body[key] = value
        }
        self.sendEvent("onCallAction", body)
        return true
      }
      manager.onToken = { [weak self] (token: String) in
        self?.sendEvent("onVoipToken", ["token": token])
      }
    }

    OnStartObserving {
      self.observing = true
    }

    OnStopObserving {
      self.observing = false
    }

    Function("setSession") { (apiBase: String, token: String) -> Void in
      CallKitManager.shared.setSession(apiBase: apiBase, token: token)
    }

    Function("clearSession") { () -> Void in
      CallKitManager.shared.clearSession()
    }

    Function("getVoipToken") { () -> String? in
      return CallKitManager.shared.voipToken
    }

    Function("consumePendingActions") { () -> [[String: String]] in
      return CallKitManager.shared.consumePendingActions()
    }

    // Ring through CallKit for a call JS learned of first (socket / poll);
    // a no-op when the VoIP push already reported it.
    AsyncFunction("reportIncomingCall") { (callJson: String, callerName: String, hasVideo: Bool, promise: Promise) -> Void in
      var callId: String?
      if let data = callJson.data(using: .utf8),
         let object = try? JSONSerialization.jsonObject(with: data),
         let dict = object as? [String: Any],
         let rawId = dict["id"] {
        callId = "\(rawId)"
      }
      guard let id = callId else {
        promise.resolve(false)
        return
      }
      CallKitManager.shared.reportIncoming(callId: id, callerName: callerName, hasVideo: hasVideo, json: callJson) {
        promise.resolve(true)
      }
    }.runOnQueue(.main)

    // Plain Functions run on the JS thread; CallKit state lives on the main queue.
    Function("endCall") { (callId: String, reason: String) -> Void in
      DispatchQueue.main.async {
        CallKitManager.shared.endCall(callId: callId, reason: reason)
      }
    }

    Function("callEnded") { (callId: String) -> Void in
      DispatchQueue.main.async {
        CallKitManager.shared.endCall(callId: callId, reason: "remoteEnded")
      }
    }

    // Android-only; no-ops here so JS can call them blindly.
    Function("dismissIncoming") { (callId: String) -> Void in
      _ = callId
    }

    Function("canUseFullScreenIntent") { () -> Bool in
      return true
    }

    Function("openFullScreenIntentSettings") { () -> Void in
    }
  }
}
