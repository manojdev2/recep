export type DemoPhase = "idle" | "connecting" | "listening" | "thinking" | "speaking";
export type DemoLine = { id: string; role: "user" | "assistant"; content: string };

type Options = {
  connect: (sdp: string) => Promise<{ ok: true; sdp: string } | { ok: false; error: string }>;
  phase: (p: DemoPhase) => void;
  level: (l: number) => void;
  error: (message: string) => void;
  line: (line: DemoLine) => void;
};

const BENIGN = new Set([
  "conversation_already_has_active_response",
  "response_cancel_not_active",
  "input_audio_buffer_commit_empty",
]);

/** Browser-side WebRTC session with OpenAI Realtime, brokered by our server. */
export class RealtimeDemo {
  private generation = 0;
  private peer?: RTCPeerConnection;
  private channel?: RTCDataChannel;
  private stream?: MediaStream;
  private audio?: HTMLAudioElement;
  private context?: AudioContext;
  private raf = 0;
  private timeout?: ReturnType<typeof setTimeout>;
  private deadline?: ReturnType<typeof setTimeout>;
  private active = false;
  private responding = false;
  private muted = false;

  constructor(private options: Options) {}

  stop() {
    this.generation++;
    this.active = false;
    this.responding = false;
    clearTimeout(this.timeout);
    clearTimeout(this.deadline);
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = undefined;
    if (this.channel) {
      this.channel.onclose = null;
      this.channel.onmessage = null;
      this.channel.onopen = null;
      if (this.channel.readyState === "open") {
        try {
          this.channel.send(JSON.stringify({ type: "session.close" }));
        } catch {}
      }
      this.channel.close();
    }
    this.channel = undefined;
    if (this.peer) {
      this.peer.onconnectionstatechange = null;
      this.peer.ontrack = null;
      this.peer.close();
    }
    this.peer = undefined;
    if (this.audio) {
      this.audio.pause();
      this.audio.srcObject = null;
    }
    this.audio = undefined;
    this.context?.close().catch(() => undefined);
    this.context = undefined;
    this.options.level(0);
    this.options.phase("idle");
  }

  private fail(message: string) {
    this.stop();
    this.options.error(message);
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.stream?.getAudioTracks().forEach((t) => {
      t.enabled = !muted;
    });
  }

  async start() {
    this.stop();
    const gen = this.generation;
    const current = () => gen === this.generation;
    this.options.phase("connecting");
    this.timeout = setTimeout(() => {
      if (current()) this.fail("The connection took too long. Please try again.");
    }, 30_000);
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
        throw Error("This browser doesn’t support live voice. Try Chrome or Safari, or type below.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (!current()) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.stream = stream;
      this.setMuted(false);
      const peer = new RTCPeerConnection();
      this.peer = peer;
      const audio = new Audio();
      audio.autoplay = true;
      this.audio = audio;
      peer.ontrack = (e) => {
        if (!current()) return;
        audio.srcObject = e.streams[0] ?? new MediaStream([e.track]);
        audio.play().catch(() => {
          if (current()) this.fail("Audio playback was blocked. Start the conversation again to enable sound.");
        });
      };
      stream.getTracks().forEach((track) => {
        peer.addTrack(track, stream);
        track.onended = () => {
          if (current()) this.fail("Your microphone disconnected. Reconnect it and try again.");
        };
      });
      peer.onconnectionstatechange = () => {
        if (current() && ["failed", "disconnected", "closed"].includes(peer.connectionState)) {
          this.fail("The voice connection ended. Start again when you’re ready.");
        }
      };
      const channel = peer.createDataChannel("oai-events");
      this.channel = channel;
      channel.onopen = () => {
        if (!current()) return;
        clearTimeout(this.timeout);
        this.active = true;
        this.options.phase("listening");
        channel.send(
          JSON.stringify({
            type: "response.create",
            response: { instructions: "Briefly introduce yourself as Azentoo, an AI demo, and ask how you can help." },
          }),
        );
        this.deadline = setTimeout(() => {
          if (current()) this.fail("That’s the end of this three-minute demo. You can start a fresh conversation.");
        }, 180_000);
      };
      channel.onclose = () => {
        if (current()) this.fail("The conversation ended. You can start again.");
      };
      channel.onmessage = (e) => {
        if (current()) this.receive(e.data);
      };
      const offer = await peer.createOffer();
      if (!current()) return;
      await peer.setLocalDescription(offer);
      if (!current()) return;
      const answer = await this.options.connect(offer.sdp ?? "");
      if (!current()) return;
      if (!answer.ok) throw Error(answer.error);
      await peer.setRemoteDescription({ type: "answer", sdp: answer.sdp });
      if (!current()) return;
      try {
        const ctx = new AudioContext();
        this.context = ctx;
        await ctx.resume();
        if (!current()) return;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const buf = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          if (!current()) return;
          analyser.getByteTimeDomainData(buf);
          const rms = Math.sqrt(buf.reduce((s, v) => s + ((v - 128) / 128) ** 2, 0) / buf.length);
          this.options.level(this.muted ? 0 : Math.min(1, rms * 5));
          this.raf = requestAnimationFrame(tick);
        };
        tick();
      } catch {}
    } catch (e) {
      if (!current()) return;
      this.fail(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Allow microphone access to talk, or type your message below."
          : e instanceof Error
            ? e.message
            : "Couldn’t start live voice.",
      );
    }
  }

  send(text: string) {
    if (!this.active || this.responding || this.channel?.readyState !== "open" || !text.trim()) return false;
    const id = `msg_${crypto.randomUUID().replaceAll("-", "").slice(0, 28)}`;
    this.channel.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: { id, type: "message", role: "user", content: [{ type: "input_text", text }] },
      }),
    );
    this.options.line({ id, role: "user", content: text });
    this.responding = true;
    this.options.phase("thinking");
    this.channel.send(JSON.stringify({ type: "response.create" }));
    return true;
  }

  private receive(raw: string) {
    let msg: { type: string; transcript?: string; item_id?: string; response?: { status?: string }; error?: { code?: string } };
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    switch (msg.type) {
      case "input_audio_buffer.speech_started":
        this.options.phase("listening");
        break;
      case "input_audio_buffer.speech_stopped":
        this.options.phase("thinking");
        break;
      case "response.created":
        this.responding = true;
        this.options.phase("thinking");
        break;
      case "output_audio_buffer.started":
        this.options.phase("speaking");
        break;
      case "output_audio_buffer.stopped":
      case "output_audio_buffer.cleared":
        this.options.phase("listening");
        break;
      case "response.done":
        this.responding = false;
        if (msg.response?.status === "failed") this.fail("That reply couldn’t finish. Please start again.");
        break;
      case "conversation.item.input_audio_transcription.completed":
      case "response.output_audio_transcript.done":
        if (msg.transcript && msg.item_id) {
          this.options.line({
            id: msg.item_id,
            role: msg.type.startsWith("conversation") ? "user" : "assistant",
            content: msg.transcript,
          });
        }
        break;
      case "error":
        if (BENIGN.has(msg.error?.code ?? "")) break;
        this.fail("The voice service encountered a problem. Please start again.");
    }
  }
}
