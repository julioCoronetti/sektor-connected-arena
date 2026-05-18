export const ERROR_MAP: Record<string, string> = {
  NotAuthorizedException: "E-mail ou senha incorretos.",
  UserNotFoundException: "Usuário não encontrado.",
  UsernameExistsException: "Este e-mail já está cadastrado.",
  InvalidPasswordException: "A senha não atende aos requisitos mínimos.",
  InvalidParameterException:
    "Dados inválidos. Verifique os campos e tente novamente.",
  CodeMismatchException: "Código incorreto. Verifique e tente novamente.",
  ExpiredCodeException: "Código expirado. Solicite um novo código.",
  LimitExceededException:
    "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
  TooManyRequestsException:
    "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
  NetworkError: "Sem conexão com a internet. Verifique sua rede.",
  UserNotConfirmedException: "Confirme seu e-mail antes de entrar.",
  PasswordResetRequiredException:
    "É necessário redefinir sua senha. Verifique seu e-mail.",
};

const FALLBACK = "Ocorreu um erro inesperado. Tente novamente.";

export function mapCognitoError(e: unknown): string {
  if (e !== null && e !== undefined && typeof e === "object") {
    const name = (e as { name?: unknown }).name;
    if (typeof name === "string" && name in ERROR_MAP) {
      return ERROR_MAP[name];
    }
  }
  return FALLBACK;
}
