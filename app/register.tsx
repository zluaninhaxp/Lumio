import { Redirect } from 'expo-router';

/** Mantém o deep link legado enquanto a autenticação vive na Welcome. */
export default function RegisterScreen() {
  return <Redirect href="/auth?mode=register" />;
}
