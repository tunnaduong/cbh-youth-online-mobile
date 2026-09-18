import AsyncStorage from "@react-native-async-storage/async-storage";

// Every account signed in on this device (token + small user snapshot), most
// recently used first, so people can switch without typing passwords again.
// Lives in AsyncStorage next to auth_token, so sign-out's MMKV clearAll()
// leaves it alone.
const STORAGE_KEY = "saved_accounts";
export const MAX_SAVED_ACCOUNTS = 5;

export const getSavedAccounts = async () => {
  try {
    const list = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) || "[]");
    return Array.isArray(list) ? list.filter((a) => a?.token && a?.user?.id) : [];
  } catch {
    return [];
  }
};

const writeSavedAccounts = (list) =>
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_SAVED_ACCOUNTS)));

export const upsertSavedAccount = async (token, user) => {
  if (!token || !user?.id) return [];
  const { id, username, profile_name } = user;
  const others = (await getSavedAccounts()).filter(
    (a) => a.user.id !== id && a.token !== token
  );
  const list = [{ token, user: { id, username, profile_name } }, ...others];
  await writeSavedAccounts(list);
  return list;
};

export const removeSavedAccount = async (userId) => {
  const list = (await getSavedAccounts()).filter((a) => a.user.id !== userId);
  await writeSavedAccounts(list);
  return list;
};
