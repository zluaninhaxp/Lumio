import { Redirect } from 'expo-router';

/** Rota legada mantida para links antigos. Abre os dados pessoais e do negócio. */
export default function AccountRedirect() { return <Redirect href="/profile" />; }
