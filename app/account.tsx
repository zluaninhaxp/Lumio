import { Redirect } from 'expo-router';

/** Rota legada mantida para links antigos. A experiência foi unificada em Perfil. */
export default function AccountRedirect() { return <Redirect href="/profile" />; }
