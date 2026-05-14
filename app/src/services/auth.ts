// Polyfill exigido pelo Amplify v6 em React Native (UUID, getRandomValues).
import "react-native-get-random-values";
// Registra storage e helpers de plataforma para o Amplify em RN.
import "@aws-amplify/react-native";

import { Amplify } from "aws-amplify";
import {
  fetchUserAttributes,
  getCurrentUser,
  signIn,
  signOut,
  signUp,
  updateUserAttributes,
} from "aws-amplify/auth";

import { AWS_REGION } from "../constants/config";

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: process.env.EXPO_PUBLIC_COGNITO_USER_POOL_ID ?? "",
      userPoolClientId: process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID ?? "",
      // userPoolEndpoint usa AWS_REGION via convenção do userPoolId (us-east-1_XXX).
      // Mantemos a região exportada para outros serviços que possam consumi-la.
    },
  },
});

void AWS_REGION; // mantém a importação viva caso outros serviços passem a usar.

export {
  fetchUserAttributes,
  getCurrentUser,
  signIn,
  signOut,
  signUp,
  updateUserAttributes,
};
