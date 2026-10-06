import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

// SecureStore values are size-limited; Supabase sessions can exceed it, so store in chunks.
const CHUNK = 1800;

const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const count = await SecureStore.getItemAsync(`${key}.n`);
    if (count === null) return SecureStore.getItemAsync(key);
    let out = "";
    for (let i = 0; i < Number(count); i++) {
      const part = await SecureStore.getItemAsync(`${key}.${i}`);
      if (part === null) return null;
      out += part;
    }
    return out;
  },
  async setItem(key: string, value: string): Promise<void> {
    await secureStorage.removeItem(key);
    const parts = value.match(new RegExp(`.{1,${CHUNK}}`, "gs")) ?? [""];
    await SecureStore.setItemAsync(`${key}.n`, String(parts.length));
    for (let i = 0; i < parts.length; i++) {
      await SecureStore.setItemAsync(`${key}.${i}`, parts[i]);
    }
  },
  async removeItem(key: string): Promise<void> {
    const count = await SecureStore.getItemAsync(`${key}.n`);
    if (count !== null) {
      for (let i = 0; i < Number(count); i++) await SecureStore.deleteItemAsync(`${key}.${i}`);
      await SecureStore.deleteItemAsync(`${key}.n`);
    }
    await SecureStore.deleteItemAsync(key);
  },
};

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;
if (!url || !key) throw new Error("EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY are not set (see .env.example)");

export const supabase = createClient(url, key, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
