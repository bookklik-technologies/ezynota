/**
 * Module-level IME composition tracker shared by KeyboardManager,
 * MarkdownShortcuts and InputManager.
 *
 * Safari fires `compositionend` BEFORE the keydown that confirms the
 * composition, so per-event `isComposing` checks alone let Enter/Space
 * split blocks mid-IME. Consumers therefore also ignore key events for a
 * short window after compositionend and events carrying keyCode 229.
 */
let composingDepth = 0;
let lastCompositionEndAt = 0;

export function compositionStarted(): void {
  composingDepth++;
}

export function compositionEnded(): void {
  composingDepth = Math.max(0, composingDepth - 1);
  lastCompositionEndAt = Date.now();
}

export function isComposing(): boolean {
  return composingDepth > 0;
}

export function justEndedComposition(withinMs = 50): boolean {
  return lastCompositionEndAt !== 0 && Date.now() - lastCompositionEndAt < withinMs;
}

/** True when a key event must be ignored because of IME composition. */
export function isImeKeyEvent(e: KeyboardEvent): boolean {
  if (isComposing() || justEndedComposition()) return true;
  if (e.isComposing) return true;
  const keyCode = (e as KeyboardEvent & { keyCode?: number }).keyCode;
  return keyCode === undefined ? false : keyCode === 229;
}
