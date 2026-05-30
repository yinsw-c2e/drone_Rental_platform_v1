const TECHNICAL_MESSAGE_KEYWORDS = [
  'sql',
  'panic',
  'nil pointer',
  'undefined',
  '<nil>',
  'eof',
  'context canceled',
  'http ',
  'status code',
  'unmarshal',
  'json:',
  'gorm:',
  'connection refused',
  'request failed',
  'parse error',
  'syntax error',
  'stack trace',
  '后端',
  '接口',
  'api',
  'payload',
  'token expired',
];

const isChineseOrPunctuation = (char: string) =>
  /[\u4e00-\u9fff]/.test(char) ||
  /[\s，。！？、；：""''（）【】《》,.!?;:()[\]{}\-_/\\+*#@~%￥¥…]/.test(char);

const hasTooMuchTechnicalText = (message: string) => {
  const chars = Array.from(message);
  const nonUserFacingChars = chars.filter((char) => !isChineseOrPunctuation(char)).length;
  return nonUserFacingChars > 1 && nonUserFacingChars / chars.length > 0.7;
};

const isFriendlyMessage = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;

  const message = value.trim();
  if (message.length === 0 || message.length >= 40) return false;

  const lowerMessage = message.toLowerCase();
  if (TECHNICAL_MESSAGE_KEYWORDS.some((keyword) => lowerMessage.includes(keyword.toLowerCase()))) {
    return false;
  }

  return !hasTooMuchTechnicalText(message);
};

export const friendlyErrorMessage = (error: unknown, fallback: string): string => {
  if (isFriendlyMessage(error)) {
    return error.trim();
  }

  if (error && typeof error === 'object') {
    const maybeError = error as { message?: unknown; errMsg?: unknown };
    if (isFriendlyMessage(maybeError.message)) {
      return maybeError.message.trim();
    }
    if (isFriendlyMessage(maybeError.errMsg)) {
      return maybeError.errMsg.trim();
    }
  }

  return fallback;
};
