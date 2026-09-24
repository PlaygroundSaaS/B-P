// AI Gateway list price for openai/gpt-5.6-sol (checked 23 Sep 2026):
// $4 per million input tokens and $20 per million output tokens.
export const AI_PRICING_DATE = '2026-09-23';
export const estimateAiCostUsd = (usage: { inputTokens?: number; outputTokens?: number }) =>
  (usage.inputTokens ?? 0) * 0.000004 + (usage.outputTokens ?? 0) * 0.00002;

/** A safe summary of an AI/database error for server logs: no keys, no invoice contents. */
export const redactedAiError = (error: unknown) =>
  error instanceof Error
    ? {
        name: error.name,
        code: (error as { code?: unknown }).code,
        status: (error as { statusCode?: unknown; status?: unknown }).statusCode ?? (error as { status?: unknown }).status,
        message: error.message.replace(/(?:Bearer\s+|sk-|vck_|sb_secret_)[A-Za-z0-9_.-]+/g, '[redacted]').slice(0, 300),
      }
    : { name: 'UnknownError' };
