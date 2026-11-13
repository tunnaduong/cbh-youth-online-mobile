import AVFoundation
import CallKit
import Foundation
import PushKit
import UIKit

/// One incoming call as JS knows it (the API's call payload, as JSON).
struct CbhCall {
  let id: String
  let uuid: UUID
  let json: String
}

/// CallKit + PushKit for incoming calls.
///
/// iOS only rings a call while the app is suspended or killed if the server
/// sends a VoIP push (PushKit) and the app reports it to CallKit at once - the
/// system then shows its own full-screen call UI (lock screen included). Since
/// iOS 13 a VoIP push that is not reported to CallKit gets the app killed, so
/// every push below reports a call, even a malformed one (ended right away).
///
/// CallKit is only the ringing / answer UI here: the voice itself goes through
/// the app's WebView (WebRTC), which iOS lets capture audio only while the app
/// is in front. So answering from the system UI tells JS, which joins the call
/// as soon as the app is opened.
final class CallKitManager: NSObject, CXProviderDelegate, PKPushRegistryDelegate {
  static let shared = CallKitManager()

  private var provider: CXProvider?
  private let callController = CXCallController()
  private var pushRegistry: PKPushRegistry?
  private(set) var voipToken: String?

  /// Calls CallKit knows about, by call id.
  private var calls: [String: CbhCall] = [:]
  /// Calls the user answered from the system UI.
  private var answered = Set<String>()
  /// Actions that happened before JS listened (app cold-started by a push).
  private var pendingActions: [[String: String]] = []

  /// Set by the module: forwards an action to JS, returns false when JS is not listening.
  var onAction: (([String: String]) -> Bool)?
  var onToken: ((String) -> Void)?

  private let defaults = UserDefaults.standard
  private let apiKey = "cbh_call_ui.api_base"
  private let tokenKey = "cbh_call_ui.auth_token"

  // MARK: - Setup

  func setUp() {
    guard provider == nil else { return }
    let config: CXProviderConfiguration
    if #available(iOS 14.0, *) {
      config = CXProviderConfiguration()
    } else {
      config = CXProviderConfiguration(localizedName: "CBH Youth Online")
    }
    config.supportsVideo = true
    config.maximumCallGroups = 1
    config.maximumCallsPerCallGroup = 1
    config.supportedHandleTypes = [.generic]
    config.includesCallsInRecents = false
    if let icon = UIImage(named: "CallKitIcon") {
      config.iconTemplateImageData = icon.pngData()
    }
    let provider = CXProvider(configuration: config)
    provider.setDelegate(self, queue: nil)
    self.provider = provider

    let registry = PKPushRegistry(queue: DispatchQueue.main)
    registry.delegate = self
    registry.desiredPushTypes = [.voIP]
    pushRegistry = registry
  }

  // MARK: - Session (for declining without JS)

  func setSession(apiBase: String, token: String) {
    defaults.set(apiBase.hasSuffix("/") ? String(apiBase.dropLast()) : apiBase, forKey: apiKey)
    defaults.set(token, forKey: tokenKey)
  }

  func clearSession() {
    defaults.removeObject(forKey: tokenKey)
  }

  private func rejectOnServer(callId: String) {
    guard let api = defaults.string(forKey: apiKey),
          let token = defaults.string(forKey: tokenKey), !token.isEmpty,
          let url = URL(string: "\(api)/v1.0/chat/calls/\(callId)/reject") else { return }
    var request = URLRequest(url: url, timeoutInterval: 10)
    request.httpMethod = "POST"
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = try? JSONSerialization.data(withJSONObject: ["reason": "rejected"])
    var task: UIBackgroundTaskIdentifier = .invalid
    task = UIApplication.shared.beginBackgroundTask { UIApplication.shared.endBackgroundTask(task) }
    URLSession.shared.dataTask(with: request) { _, _, _ in
      DispatchQueue.main.async { UIApplication.shared.endBackgroundTask(task) }
    }.resume()
  }

  // MARK: - Calls

  /// Same call id -> same UUID, so the VoIP push and the socket event for one
  /// call never make two CallKit calls.
  static func uuid(for callId: String) -> UUID {
    let digits = String(callId.filter { $0.isNumber }.suffix(12))
    let padded = String(repeating: "0", count: max(0, 12 - digits.count)) + digits
    return UUID(uuidString: "CB4C0000-0000-4000-8000-\(padded)") ?? UUID()
  }

  func reportIncoming(callId: String, callerName: String, hasVideo: Bool, json: String, completion: (() -> Void)? = nil) {
    setUp()
    if calls[callId] != nil {
      completion?()
      return
    }
    let uuid = CallKitManager.uuid(for: callId)
    let update = CXCallUpdate()
    update.remoteHandle = CXHandle(type: .generic, value: callerName)
    update.localizedCallerName = callerName
    update.hasVideo = hasVideo
    update.supportsHolding = false
    update.supportsGrouping = false
    update.supportsUngrouping = false
    update.supportsDTMF = false
    calls[callId] = CbhCall(id: callId, uuid: uuid, json: json)
    provider?.reportNewIncomingCall(with: uuid, update: update) { [weak self] error in
      if error != nil {
        // Already known to CallKit (or Do Not Disturb / blocked): forget it.
        if (error as NSError?)?.code != CXErrorCodeIncomingCallError.callUUIDAlreadyExists.rawValue {
          self?.calls.removeValue(forKey: callId)
        }
      }
      completion?()
    }
  }

  /// The call is over for a reason JS knows (remote hang-up, answered in the app, timeout).
  func endCall(callId: String, reason: String) {
    guard let call = calls.removeValue(forKey: callId) else { return }
    answered.remove(callId)
    let cxReason: CXCallEndedReason
    switch reason {
    case "answeredElsewhere": cxReason = .answeredElsewhere
    case "declinedElsewhere": cxReason = .declinedElsewhere
    case "unanswered": cxReason = .unanswered
    case "failed": cxReason = .failed
    default: cxReason = .remoteEnded
    }
    provider?.reportCall(with: call.uuid, endedAt: Date(), reason: cxReason)
  }

  func consumePendingActions() -> [[String: String]] {
    let out = pendingActions
    pendingActions.removeAll()
    return out
  }

  private func dispatch(_ action: String, _ call: CbhCall, queue: Bool) {
    let event = ["action": action, "call": call.json]
    let delivered = onAction?(event) ?? false
    if !delivered && queue {
      pendingActions.removeAll { $0["call"] == call.json }
      pendingActions.append(event)
    }
  }

  private func call(for uuid: UUID) -> CbhCall? {
    calls.values.first { $0.uuid == uuid }
  }

  // MARK: - CXProviderDelegate

  func providerDidReset(_ provider: CXProvider) {
    calls.removeAll()
    answered.removeAll()
  }

  func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
    if let call = call(for: action.callUUID) {
      answered.insert(call.id)
      dispatch("answer", call, queue: true)
    }
    action.fulfill()
  }

  func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
    if let call = call(for: action.callUUID) {
      calls.removeValue(forKey: call.id)
      if answered.remove(call.id) != nil {
        dispatch("end", call, queue: true)
      } else {
        // Declined from the system UI: reject on the API right away (JS may
        // not be running yet), and let JS drop its ringing state.
        rejectOnServer(callId: call.id)
        dispatch("decline", call, queue: false)
      }
    }
    action.fulfill()
  }

  func provider(_ provider: CXProvider, perform action: CXSetMutedCallAction) {
    if let call = call(for: action.callUUID) {
      dispatch(action.isMuted ? "mute" : "unmute", call, queue: false)
    }
    action.fulfill()
  }

  func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {}
  func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {}

  // MARK: - PKPushRegistryDelegate

  func pushRegistry(_ registry: PKPushRegistry, didUpdate pushCredentials: PKPushCredentials, for type: PKPushType) {
    guard type == .voIP else { return }
    let token = pushCredentials.token.map { String(format: "%02x", $0) }.joined()
    voipToken = token
    onToken?(token)
  }

  func pushRegistry(_ registry: PKPushRegistry, didInvalidatePushTokenFor type: PKPushType) {
    if type == .voIP { voipToken = nil }
  }

  func pushRegistry(
    _ registry: PKPushRegistry,
    didReceiveIncomingPushWith payload: PKPushPayload,
    for type: PKPushType,
    completion: @escaping () -> Void
  ) {
    guard type == .voIP else {
      completion()
      return
    }
    let dict = payload.dictionaryPayload
    let callDict = dict["call"] as? [String: Any]
    let rawId = callDict?["id"] ?? dict["call_id"]
    let callId = rawId.map { "\($0)" } ?? ""
    let caller = callDict?["caller"] as? [String: Any]
    let callerName = (caller?["profile_name"] as? String).flatMap { $0.isEmpty ? nil : $0 }
      ?? (caller?["username"] as? String)
      ?? (dict["caller_name"] as? String)
      ?? "CBH Youth Online"
    let hasVideo = (callDict?["type"] as? String) == "video"
    var json = "{}"
    if let callDict, let data = try? JSONSerialization.data(withJSONObject: callDict),
       let text = String(data: data, encoding: .utf8) {
      json = text
    }

    if callId.isEmpty {
      // Apple requires a reported call for every VoIP push: report and end it.
      let uuid = UUID()
      setUp()
      let update = CXCallUpdate()
      update.localizedCallerName = callerName
      provider?.reportNewIncomingCall(with: uuid, update: update) { [weak self] _ in
        self?.provider?.reportCall(with: uuid, endedAt: Date(), reason: .failed)
        completion()
      }
      return
    }

    reportIncoming(callId: callId, callerName: callerName, hasVideo: hasVideo, json: json) { [weak self] in
      if let call = self?.calls[callId] {
        self?.dispatch("show", call, queue: true)
      }
      completion()
    }
  }
}
