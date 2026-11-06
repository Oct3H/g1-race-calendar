import { createState, dayKey, addBankDays } from './game-state.mjs?v=58';

export function createUnopenedShop() {
  return { ...createState(), cash: 0, shopActivated: false, firstShopOpenedAt: null, bankAnchorDay: null, bankTimeZone: null, detailBetEntry: false };
}

export function activateShop(state, now, timeZone) {
  if (state.shopActivated !== false) return false; // Explicit fixtures already represent an active shop.
  state.cash += 500000;
  state.shopActivated = true;
  state.firstShopOpenedAt = now.toISOString();
  state.bankTimeZone = timeZone;
  state.bankAnchorDay = dayKey(now, timeZone);
  return true;
}

export function accrueShopBank(state, now) {
  if (state.shopActivated !== true || !state.bankAnchorDay) return;
  const today = dayKey(now, state.bankTimeZone);
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${state.bankAnchorDay}T00:00:00Z`)) / 86400000);
  if (days <= 0) return;
  addBankDays(state, days);
  state.bankAnchorDay = today;
}
