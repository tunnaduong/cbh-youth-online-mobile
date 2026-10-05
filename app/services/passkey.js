import { NativeModules } from "react-native";
import * as Api from "./api/ApiByAxios";
import i18n from "../i18n";

/**
 * Passkeys, done natively on both platforms - the system's own sheet
 * (iOS: AuthenticationServices; Android: Credential Manager), nothing to do
 * with the web site or a browser.
 *
 * Native module: `react-native-passkey`. It is loaded in a try block because
 * JavaScript can reach a build that doesn't contain it yet (an OTA update on
 * an older binary); there passkeysSupported() is simply false.
 *
 * What makes the system agree to show the sheet for chuyenbienhoa.com (the
 * passkeys' relying party) lives outside this file:
 *   iOS      - `webcredentials:chuyenbienhoa.com` in app.json's
 *              associatedDomains, and the site's
 *              /.well-known/apple-app-site-association listing this app;
 *   Android  - the site's /.well-known/assetlinks.json listing this package
 *              and the certificate the APK is signed with, and the API
 *              accepting that certificate as an origin
 *              (WEBAUTHN_ANDROID_ORIGINS).
 * When one of those is missing the system refuses, which surfaces here as
 * the "notConfigured" error.
 */
let Passkey = null;
try {
  Passkey = require("react-native-passkey").Passkey;
} catch {
  Passkey = null;
}

export const passkeysSupported = () => {
  try {
    // NativeModules.Passkey: the JS package can be bundled into a binary
    // that was built before the native side was added.
    return !!Passkey && !!NativeModules.Passkey && Passkey.isSupported();
  } catch {
    return false;
  }
};

/**
 * An error from the system's passkey sheet, with:
 *   cancelled - the user closed the sheet: nothing to show
 *   message   - what to tell the user, in the app's language
 */
export class PasskeyError extends Error {
  constructor(code, { cancelled = false } = {}) {
    super(i18n.t(`passkeys.errors.${code}`));
    this.name = "PasskeyError";
    this.code = code;
    this.cancelled = cancelled;
  }
}

// react-native-passkey rejects with { error, message }.
const fromNative = (error, mode) => {
  switch (error?.error) {
    case "UserCancelled":
      return new PasskeyError("cancelled", { cancelled: true });
    case "NoCredentials":
      return new PasskeyError("noPasskey");
    case "CredentialAlreadyExists":
      return new PasskeyError("alreadyExists");
    case "NoCreateOption":
      return new PasskeyError("noProvider");
    case "NotSupported":
      return new PasskeyError("notSupported");
    case "BadConfiguration":
      return new PasskeyError("notConfigured");
    case "TimedOut":
    case "Interrupted":
      return new PasskeyError("interrupted");
    case "RequestFailed":
      // Android answers this way when there is nothing to pick from.
      return new PasskeyError(mode === "login" ? "noPasskey" : "failed");
    default:
      return new PasskeyError("failed");
  }
};

const assertSupported = () => {
  if (!passkeysSupported()) throw new PasskeyError("notSupported");
};

/**
 * Log in with a passkey: the system sheet, then fingerprint / face / screen
 * lock. Nothing to type and no two-factor step.
 *
 * Resolves to the API's login payload ({ token, user }). Rejects with a
 * PasskeyError (see `cancelled`) or the API's error.
 */
export async function loginWithPasskey() {
  assertSupported();

  const options = (await Api.postRequest("/v1.0/login/passkey/options")).data;

  let credential;
  try {
    credential = await Passkey.get(options.publicKey);
  } catch (error) {
    throw fromNative(error, "login");
  }

  const response = await Api.postRequest("/v1.0/login/passkey", {
    request_id: options.request_id,
    credential: {
      id: credential.id,
      response: {
        clientDataJSON: credential.response.clientDataJSON,
        authenticatorData: credential.response.authenticatorData,
        signature: credential.response.signature,
      },
    },
  });

  return response.data;
}

/**
 * Create a passkey for the signed-in account on this device.
 *
 * @param {string} [password]  the account password (not asked from accounts
 *                             created through Google/Facebook/Apple)
 * @returns the API's answer: { message, passkeys, password_required }
 */
export async function createPasskey(password) {
  assertSupported();

  const options = (await Api.postRequest("/v1.0/passkeys/options", { password })).data;

  let credential;
  try {
    credential = await Passkey.create(options.publicKey);
  } catch (error) {
    throw fromNative(error, "create");
  }

  const response = await Api.postRequest("/v1.0/passkeys", {
    credential: {
      id: credential.id,
      response: {
        clientDataJSON: credential.response.clientDataJSON,
        attestationObject: credential.response.attestationObject,
      },
    },
  });

  return response.data;
}

export const getPasskeys = () => Api.getRequest("/v1.0/passkeys").then((res) => res.data);

export const deletePasskey = (id) =>
  Api.deleteRequest(`/v1.0/passkeys/${id}`).then((res) => res.data);
