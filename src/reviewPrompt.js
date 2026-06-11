// When to ask for a Chrome Web Store review — pure logic, no chrome.*.

import { REVIEW_PROMPT_MIN_PLAYS, REVIEW_PROMPT_SNOOZE_DAYS } from './config.js';

const SNOOZE_MS = REVIEW_PROMPT_SNOOZE_DAYS * 24 * 60 * 60 * 1000;

export const storeReviewUrl = (extensionId) =>
  `https://chromewebstore.google.com/detail/${extensionId}/reviews`;

export const shouldShowReviewPrompt = (reviewPrompt, now = Date.now()) => {
  if (reviewPrompt.ratedAt) return false;
  if (reviewPrompt.dismissedAt && now - reviewPrompt.dismissedAt < SNOOZE_MS) return false;
  return reviewPrompt.playStarts >= REVIEW_PROMPT_MIN_PLAYS;
};
