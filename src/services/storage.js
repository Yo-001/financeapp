import { Preferences } from "@capacitor/preferences";

export const StorageService = {
  async getExpenses() {
    const { value } = await Preferences.get({ key: "expenses" });
    return value ? JSON.parse(value) : [];
  },

  async setExpenses(expenses) {
    await Preferences.set({
      key: "expenses",
      value: JSON.stringify(expenses),
    });
  },
};
