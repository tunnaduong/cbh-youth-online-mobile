package dhp.hmy.bubble

import android.content.Context

/** What the native side needs without JS: the on/off switch and the account's API access. */
object BubbleStore {
  private const val PREFS = "hmy_bubble"

  private fun prefs(ctx: Context) = ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun setEnabled(ctx: Context, enabled: Boolean) = prefs(ctx).edit().putBoolean("enabled", enabled).apply()
  fun isEnabled(ctx: Context) = prefs(ctx).getBoolean("enabled", false)

  fun setSession(ctx: Context, apiBase: String, token: String) =
    prefs(ctx).edit().putString("api_base", apiBase.trimEnd('/')).putString("token", token).apply()

  fun clearSession(ctx: Context) = prefs(ctx).edit().remove("token").apply()

  fun apiBase(ctx: Context): String? = prefs(ctx).getString("api_base", null)
  fun token(ctx: Context): String? = prefs(ctx).getString("token", null)
}
