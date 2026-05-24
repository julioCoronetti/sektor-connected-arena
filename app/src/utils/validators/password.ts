export type PasswordLevel = "fraca" | "razoável" | "boa" | "forte";

export interface PasswordStrength {
  level: PasswordLevel;
  score: number; // 0–3 para uso no indicador visual
}

/**
 * Classifica a senha em quatro níveis mutuamente exclusivos,
 * avaliados em ordem de prioridade decrescente (Requisito 4.2–4.6).
 *
 * - fraca:    menos de 8 caracteres
 * - forte:    12+ chars, lowercase + uppercase + digit + symbol
 * - boa:      8+ chars, lowercase + uppercase + digit (não satisfaz forte)
 * - razoável: 8+ chars, lowercase + digit (não satisfaz forte ou boa)
 * - fraca:    8+ chars, mas não satisfaz razoável, boa ou forte
 */
export function getPasswordStrength(password: string): PasswordStrength {
  if (password.length < 8) return { level: "fraca", score: 0 };

  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);

  if (password.length >= 12 && hasLower && hasUpper && hasDigit && hasSymbol) {
    return { level: "forte", score: 3 };
  }
  if (hasLower && hasUpper && hasDigit) {
    return { level: "boa", score: 2 };
  }
  if (hasLower && hasDigit) {
    return { level: "razoável", score: 1 };
  }
  return { level: "fraca", score: 0 };
}
