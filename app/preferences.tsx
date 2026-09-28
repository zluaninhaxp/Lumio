import { Redirect } from 'expo-router';

/** Preferências antigas não controlavam tema nem notificações; evita oferecer opções sem efeito. */
export default function PreferencesRedirect() { return <Redirect href="/profile" />; }
