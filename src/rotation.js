// Lógica pura da rotação. Sem dependência de chrome.* — fácil de testar.

/**
 * Retorna a "janela" de canais visíveis começando em `cursor`, com `slots`
 * posições, dando a volta (round-robin) quando passa do fim da lista.
 */
export function windowAt(channels, cursor, slots) {
  if (!channels.length) return [];
  const count = Math.min(slots, channels.length);
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(channels[(cursor + i) % channels.length]);
  }
  return out;
}

/** Avança o cursor em `slots` posições, dando a volta. */
export function nextCursor(cursor, slots, length) {
  if (length <= 0) return 0;
  return (cursor + slots) % length;
}

/** Só faz sentido rotacionar se há mais canais do que abas. */
export function needsRotation(length, slots) {
  return length > slots;
}
