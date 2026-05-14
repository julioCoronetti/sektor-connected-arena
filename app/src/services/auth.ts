import type { User } from "../types";

function notImplemented(fn: string, plano: string): never {
  throw new Error(`[auth.${fn}] não implementado — responsável: ${plano}`);
}

export function signIn(_email: string, _password: string): Promise<User> {
  return notImplemented("signIn", "Plano 02");
}

export function signUp(_input: {
  email: string;
  password: string;
  name: string;
}): Promise<User> {
  return notImplemented("signUp", "Plano 02");
}

export function signOut(): Promise<void> {
  return notImplemented("signOut", "Plano 02");
}

export function getCurrentUser(): Promise<User | null> {
  return notImplemented("getCurrentUser", "Plano 02");
}

export function setTeam(_teamId: string): Promise<void> {
  return notImplemented("setTeam", "Plano 02");
}
