import { randomId } from './crypto';
import type {
  ActiveCall,
  CallMode,
  CallSignal,
  IceCandidatePayload,
} from './types';

interface CallSession {
  view: ActiveCall;
  peer: RTCPeerConnection | null;
  pendingOffer: string | null;
  pendingCandidates: IceCandidatePayload[];
}

type SendSignal = (contactId: string, signal: CallSignal) => Promise<void>;
type OnCallChange = (call: ActiveCall | null) => void;
type OnCallError = (contactId: string, message: string) => void;

export class DirectCallManager {
  private session: CallSession | null = null;
  private readonly earlyCandidates = new Map<string, IceCandidatePayload[]>();
  private ringTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly sendSignal: SendSignal,
    private readonly onChange: OnCallChange,
    private readonly onError: OnCallError,
  ) {}

  async start(contactId: string, mode: CallMode): Promise<void> {
    if (this.session) throw new Error('A call is already active.');
    this.assertMediaSupport();
    const session = this.createSession(contactId, randomId(), mode, 'outgoing');
    this.session = session;
    this.publish();
    this.startRingTimeout(session);

    try {
      await this.acquireLocalMedia(session);
      if (this.session !== session) return;
      const peer = this.createPeer(session);
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      if (!offer.sdp) throw new Error('The call offer could not be created.');
      await this.sendSignal(contactId, {
        kind: 'call-offer',
        callId: session.view.callId,
        mode,
        sdp: offer.sdp,
      });
    } catch (error) {
      this.finish();
      throw error;
    }
  }

  async handleSignal(contactId: string, signal: CallSignal): Promise<void> {
    if (signal.kind === 'call-offer') {
      if (this.session) {
        if (
          this.session.view.callId !== signal.callId ||
          this.session.view.contactId !== contactId
        ) {
          await this.sendSignal(contactId, {
            kind: 'call-reject',
            callId: signal.callId,
          });
        }
        return;
      }
      const session = this.createSession(
        contactId,
        signal.callId,
        signal.mode,
        'incoming',
      );
      session.pendingOffer = signal.sdp;
      const key = this.candidateKey(contactId, signal.callId);
      session.pendingCandidates = this.earlyCandidates.get(key) ?? [];
      this.earlyCandidates.delete(key);
      this.session = session;
      this.publish();
      this.startRingTimeout(session);
      return;
    }

    if (signal.kind === 'call-candidate') {
      const session = this.session;
      if (
        !session ||
        session.view.callId !== signal.callId ||
        session.view.contactId !== contactId
      ) {
        const key = this.candidateKey(contactId, signal.callId);
        if (!this.earlyCandidates.has(key) && this.earlyCandidates.size >= 8) return;
        const queue = this.earlyCandidates.get(key) ?? [];
        if (queue.length < 64) queue.push(signal.candidate);
        this.earlyCandidates.set(key, queue);
        return;
      }
      await this.addOrQueueCandidate(session, signal.candidate);
      return;
    }

    const session = this.session;
    if (!session || session.view.contactId !== contactId || session.view.callId !== signal.callId) {
      return;
    }

    if (signal.kind === 'call-answer') {
      if (!session.peer || session.view.phase !== 'outgoing') return;
      await session.peer.setRemoteDescription({
        type: 'answer',
        sdp: signal.sdp,
      });
      this.clearRingTimeout();
      await this.flushCandidates(session);
      this.update(session, { phase: 'connecting' });
      return;
    }

    if (signal.kind === 'call-reject' || signal.kind === 'call-end') {
      this.onError(
        contactId,
        signal.kind === 'call-reject'
          ? 'The contact declined the call.'
          : 'The contact ended the call.',
      );
      this.finish();
    }
  }

  async accept(): Promise<void> {
    const session = this.session;
    if (!session || session.view.phase !== 'incoming' || !session.pendingOffer) {
      throw new Error('There is no incoming call to accept.');
    }
    this.clearRingTimeout();

    try {
      await this.acquireLocalMedia(session);
      if (this.session !== session) return;
      const peer = this.createPeer(session);
      await peer.setRemoteDescription({
        type: 'offer',
        sdp: session.pendingOffer,
      });
      await this.flushCandidates(session);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      if (!answer.sdp) throw new Error('The call response could not be created.');
      this.update(session, { phase: 'connecting' });
      await this.sendSignal(session.view.contactId, {
        kind: 'call-answer',
        callId: session.view.callId,
        sdp: answer.sdp,
      });
    } catch (error) {
      try {
        await this.sendSignal(session.view.contactId, {
          kind: 'call-reject',
          callId: session.view.callId,
        });
      } catch {
        // The call is still cleared locally if media setup or permission fails.
      }
      this.finish();
      throw error;
    }
  }

  async decline(): Promise<void> {
    const session = this.session;
    if (!session) return;
    try {
      await this.sendSignal(session.view.contactId, {
        kind: 'call-reject',
        callId: session.view.callId,
      });
    } finally {
      this.finish();
    }
  }

  async end(): Promise<void> {
    const session = this.session;
    if (!session) return;
    try {
      await this.sendSignal(session.view.contactId, {
        kind: 'call-end',
        callId: session.view.callId,
      });
    } finally {
      this.finish();
    }
  }

  toggleMicrophone(): void {
    const session = this.session;
    if (!session?.view.localStream) return;
    const nextMuted = !session.view.muted;
    session.view.localStream.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    this.update(session, { muted: nextMuted });
  }

  toggleCamera(): void {
    const session = this.session;
    if (!session?.view.localStream || session.view.mode !== 'video') return;
    const nextEnabled = !session.view.cameraEnabled;
    session.view.localStream.getVideoTracks().forEach((track) => {
      track.enabled = nextEnabled;
    });
    this.update(session, { cameraEnabled: nextEnabled });
  }

  dispose(): void {
    this.finish();
    this.earlyCandidates.clear();
  }

  private createSession(
    contactId: string,
    callId: string,
    mode: CallMode,
    phase: ActiveCall['phase'],
  ): CallSession {
    return {
      view: {
        contactId,
        callId,
        mode,
        phase,
        localStream: null,
        remoteStream: null,
        muted: false,
        cameraEnabled: true,
      },
      peer: null,
      pendingOffer: null,
      pendingCandidates: [],
    };
  }

  private assertMediaSupport(): void {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof RTCPeerConnection === 'undefined'
    ) {
      throw new Error(
        'Calling needs browser WebRTC and microphone permissions. Use the web app or Capacitor Android APK.',
      );
    }
  }

  private async acquireLocalMedia(session: CallSession): Promise<void> {
    this.assertMediaSupport();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: session.view.mode === 'video' ? { facingMode: 'user' } : false,
    });
    if (this.session !== session) {
      stream.getTracks().forEach((track) => track.stop());
      throw new Error('The call was ended before media permissions completed.');
    }
    this.update(session, { localStream: stream });
  }

  private createPeer(session: CallSession): RTCPeerConnection {
    const peer = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    session.peer = peer;
    session.view.localStream?.getTracks().forEach((track) => {
      peer.addTrack(track, session.view.localStream!);
    });
    peer.onicecandidate = (event) => {
      if (!event.candidate || this.session !== session) return;
      const rawCandidate = event.candidate.toJSON();
      if (!rawCandidate.candidate) return;
      const candidate: IceCandidatePayload = {
        candidate: rawCandidate.candidate,
        sdpMid: rawCandidate.sdpMid,
        sdpMLineIndex: rawCandidate.sdpMLineIndex,
        usernameFragment: rawCandidate.usernameFragment,
      };
      void this.sendSignal(session.view.contactId, {
        kind: 'call-candidate',
        callId: session.view.callId,
        candidate,
      }).catch((error: unknown) => this.reportError(session, error));
    };
    peer.ontrack = (event) => {
      if (this.session !== session) return;
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      this.update(session, { remoteStream: stream });
    };
    peer.onconnectionstatechange = () => {
      if (this.session !== session) return;
      if (peer.connectionState === 'connected') {
        this.clearRingTimeout();
        this.update(session, { phase: 'connected' });
      } else if (peer.connectionState === 'failed') {
        this.onError(
          session.view.contactId,
          'The direct call could not connect on this network.',
        );
        this.finish();
      }
    };
    return peer;
  }

  private async addOrQueueCandidate(
    session: CallSession,
    candidate: IceCandidatePayload,
  ): Promise<void> {
    if (session.peer?.remoteDescription) {
      await session.peer.addIceCandidate(candidate);
    } else if (session.pendingCandidates.length < 64) {
      session.pendingCandidates.push(candidate);
    }
  }

  private async flushCandidates(session: CallSession): Promise<void> {
    const peer = session.peer;
    if (!peer?.remoteDescription || session.pendingCandidates.length === 0) return;
    const candidates = session.pendingCandidates.splice(0);
    await Promise.all(candidates.map((candidate) => peer.addIceCandidate(candidate)));
  }

  private candidateKey(contactId: string, callId: string): string {
    return `${contactId}:${callId}`;
  }

  private startRingTimeout(session: CallSession): void {
    this.clearRingTimeout();
    this.ringTimer = setTimeout(() => {
      if (this.session !== session || session.view.phase === 'connected') return;
      this.onError(session.view.contactId, 'The call was not answered.');
      this.finish();
    }, 45_000);
  }

  private clearRingTimeout(): void {
    if (this.ringTimer) clearTimeout(this.ringTimer);
    this.ringTimer = null;
  }

  private update(session: CallSession, patch: Partial<ActiveCall>): void {
    if (this.session !== session) return;
    session.view = { ...session.view, ...patch };
    this.publish();
  }

  private publish(): void {
    this.onChange(this.session?.view ?? null);
  }

  private reportError(session: CallSession, error: unknown): void {
    this.onError(
      session.view.contactId,
      error instanceof Error ? error.message : 'Call signaling was interrupted.',
    );
  }

  private finish(): void {
    const session = this.session;
    this.session = null;
    this.earlyCandidates.clear();
    this.clearRingTimeout();
    if (session?.peer) {
      session.peer.onicecandidate = null;
      session.peer.ontrack = null;
      session.peer.onconnectionstatechange = null;
      session.peer.close();
    }
    session?.view.localStream?.getTracks().forEach((track) => track.stop());
    session?.view.remoteStream?.getTracks().forEach((track) => track.stop());
    this.publish();
  }
}
