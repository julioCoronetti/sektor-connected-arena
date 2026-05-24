/** Padrão RFC 5322 simplificado conforme Requisito 3. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Verifica se o valor fornecido corresponde ao padrão de e-mail válido.
 *
 * @param value - String a ser validada
 * @returns `true` se o valor satisfaz o padrão `^[^\s@]+@[^\s@]+\.[^\s@]+$`, `false` caso contrário
 */
export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value);
}
