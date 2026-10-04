import i18n from "../i18n";

/**
 * The message to show for a failed API call, in the app's language.
 *
 * The API writes its messages in Vietnamese only. Showing them as they are
 * put Vietnamese toasts in an app set to English or Russian, so the server's
 * wording is used only when the app is in Vietnamese; otherwise the message
 * comes from the app's own strings, picked by what went wrong.
 *
 * @param {any} error      what the request threw (axios error or Error)
 * @param {string} [fallback]  already-translated text for "it just failed"
 */
export function apiErrorMessage(error, fallback) {
  const data = error?.response?.data;
  const server =
    (typeof data?.message === "string" && data.message) ||
    (typeof data?.error === "string" && data.error) ||
    null;

  if (server && (i18n.language || "vi").toLowerCase().startsWith("vi")) {
    return server;
  }

  // Nothing came back from the server. A network failure or timeout says so;
  // anything else (an error thrown by the app itself) gets the fallback.
  if (!error?.response) {
    const network =
      error?.message === "Network Error" ||
      error?.code === "ERR_NETWORK" ||
      error?.code === "ECONNABORTED";
    return network ? i18n.t("apiError.network") : fallback || i18n.t("apiError.generic");
  }

  const status = error.response.status;
  if (status === 429) return i18n.t("apiError.tooManyAttempts");
  // What was typed was refused: wrong password or code, invalid value.
  if (status === 422) return i18n.t("apiError.invalid");
  if (status === 403) return i18n.t("apiError.notAllowed");
  if (status >= 500) return i18n.t("apiError.server");

  return fallback || i18n.t("apiError.generic");
}
