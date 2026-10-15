import type { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

type SpeechModule = typeof ExpoSpeechRecognitionModule;
export type VoiceState = 'idle' | 'permission' | 'starting' | 'listening' | 'processing' | 'result' | 'denied' | 'blocked' | 'unavailable' | 'error';
export type VoiceStatus = { state: VoiceState; message?: string; code?: string };
let owner: VoiceRecognition | null = null;

const messages: Record<string, string> = {
  'not-allowed': 'Permita o acesso ao microfone para falar.',
  'service-not-allowed': 'O reconhecimento de voz está indisponível neste aparelho.',
  'language-not-supported': 'O reconhecimento em português está indisponível.',
  busy: 'O microfone está ocupado. Tente novamente.',
  'no-speech': 'Não consegui ouvir. Tente falar novamente.',
  'speech-timeout': 'Não ouvi sua voz a tempo. Tente novamente.',
  network: 'Verifique sua conexão e tente novamente.',
  'audio-capture': 'Não consegui usar o microfone. Tente novamente.',
};

/** One owner for the native singleton; no permissions are requested until press(). */
export class VoiceRecognition {
  private status: VoiceStatus = { state: 'idle' };
  private disposed = false;
  private active = false;
  private failed = false;
  private transcript = '';
  private subscriptions: { remove(): void }[] = [];
  constructor(
    private module: SpeechModule,
    private notify: (status: VoiceStatus) => void,
    private capture: (text: string) => void,
    private partial: (text: string) => void,
    private log: (detail: unknown) => void = () => {},
  ) {}
  private update(state: VoiceState, message?: string, code?: string) {
    this.status = { state, message, code };
    if (!this.disposed) this.notify(this.status);
  }
  private release() {
    this.active = false;
    this.subscriptions.forEach(s => s.remove());
    this.subscriptions = [];
    if (owner === this) owner = null;
  }
  private listen() {
    this.subscriptions = [
      this.module.addListener('start', () => this.update('listening')),
      this.module.addListener('speechend', () => this.update('processing')),
      this.module.addListener('result', event => {
        if (this.failed) return;
        this.transcript = event.results[0]?.transcript ?? '';
        if (this.transcript) this.partial(this.transcript);
        if (event.isFinal) this.update('processing');
      }),
      this.module.addListener('error', event => {
        this.log(event);
        this.failed = true;
        if (event.error === 'aborted') this.update('idle');
        else this.update(event.error === 'not-allowed' ? 'denied' : 'error',
          messages[event.error] ?? 'Não consegui reconhecer sua fala. Tente novamente.', event.error);
        // Keep ownership until end: errors are followed by the native end event.
        if (event.error === 'not-allowed') {
          void this.module.getPermissionsAsync().then(p => {
            if (!this.disposed && this.status.code === 'not-allowed' && !p.granted && !p.canAskAgain)
              this.update('blocked', 'O acesso ao microfone está desativado.', event.error);
          }).catch(this.log);
        }
      }),
      this.module.addListener('end', () => {
        const text = this.transcript.trim();
        this.release();
        if (this.failed) return;
        if (text) { this.update('result'); this.capture(text); }
        else this.update('idle');
      }),
    ];
  }
  async press() {
    if (this.disposed) return;
    if (this.active) {
      if (this.status.state === 'listening') {
        this.update('processing');
        try { this.module.stop(); } catch (error) { this.log(error); this.release(); this.update('error', 'Não consegui finalizar sua fala. Tente novamente.', 'stop'); }
      }
      return;
    }
    if (owner) { this.update('error', messages.busy, 'busy'); return; }
    owner = this;
    this.active = true;
    this.failed = false;
    this.transcript = '';
    this.update('permission');
    try {
      let permission = await this.module.getPermissionsAsync();
      if (this.disposed) return;
      if (!permission.granted && permission.canAskAgain)
        permission = await this.module.requestPermissionsAsync();
      if (this.disposed) return;
      if (!permission.granted) {
        this.release();
        this.update(permission.canAskAgain ? 'denied' : 'blocked', permission.canAskAgain
          ? 'Permita o acesso ao microfone para falar. Você pode tentar novamente.'
          : 'O acesso ao microfone está desativado.');
        return;
      }
      if (!this.module.isRecognitionAvailable()) {
        this.release(); this.update('unavailable', messages['service-not-allowed']); return;
      }
      this.listen();
      this.update('starting');
      this.module.start({ lang: 'pt-BR', interimResults: true, continuous: false });
    } catch (error) {
      this.log(error);
      if (this.disposed) return;
      // start may have partially initialized the native recognizer.
      this.subscriptions.forEach(s => s.remove()); this.subscriptions = [];
      try { this.module.abort(); } catch (abortError) { this.log(abortError); }
      this.release();
      this.update('error', 'Não consegui iniciar o microfone. Tente novamente.', 'initialization');
    }
  }
  dispose() {
    this.disposed = true;
    const wasRecognizing = this.subscriptions.length > 0;
    this.subscriptions.forEach(s => s.remove()); this.subscriptions = [];
    if (wasRecognizing) {
      try { this.module.abort(); } catch (error) { this.log(error); }
    }
    this.release();
  }
}
