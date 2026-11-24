export type AdminWaitState =
  | 'WAITING_TARGET_CHAT'
  | 'WAITING_SIGNATURE'
  | 'WAITING_CUSTOM_TIME'
  | 'WAITING_ADD_ADMIN'
  | 'WAITING_ERROR_CHAT'
  | 'WAITING_FORCED_CHANNEL'
  | 'WAITING_ITEM_ICON'
  | 'USER_CALC_GRAMS'
  | null;

const userStates = new Map<number, AdminWaitState>();
const editingIconMap = new Map<number, string>();

export function setUserState(userId: number, state: AdminWaitState) {
  if (state === null) {
    userStates.delete(userId);
    editingIconMap.delete(userId);
  } else {
    userStates.set(userId, state);
  }
}

export function getUserState(userId: number): AdminWaitState {
  return userStates.get(userId) || null;
}

export function clearUserState(userId: number) {
  userStates.delete(userId);
  editingIconMap.delete(userId);
}

export function setEditingIconItem(userId: number, itemKey: string) {
  editingIconMap.set(userId, itemKey);
}

export function getEditingIconItem(userId: number): string | undefined {
  return editingIconMap.get(userId);
}

// Backward compatibility aliases
export const setAdminState = setUserState;
export const getAdminState = getUserState;
export const clearAdminState = clearUserState;
