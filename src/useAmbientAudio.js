import { useCallback, useEffect, useRef, useState } from "react";

export function useAmbientAudio() {
  const [enabled, setEnabled] = useState(true);
  const audioRef = useRef(null);

  const start = useCallback(() => {
    if (audioRef.current) return audioRef.current;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;

    const context = new AudioContext();
    const master = context.createGain();
    master.gain.value = 0.7;
    master.connect(context.destination);

    const rainBuffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
    const channel = rainBuffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < channel.length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = last * 0.965 + white * 0.035;
      channel[i] = last * 2.2;
    }

    const rain = context.createBufferSource();
    const rainFilter = context.createBiquadFilter();
    const rainGain = context.createGain();
    rain.buffer = rainBuffer;
    rain.loop = true;
    rainFilter.type = "lowpass";
    rainFilter.frequency.value = 1450;
    rainGain.gain.value = 0.055;
    rain.connect(rainFilter).connect(rainGain).connect(master);
    rain.start();

    audioRef.current = { context, master, rain };
    return audioRef.current;
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.rain.stop();
    audio.context.close();
    audioRef.current = null;
  }, []);

  const toggle = useCallback(() => {
    setEnabled((current) => {
      if (current) stop();
      else start();
      return !current;
    });
  }, [start, stop]);

  const cue = useCallback((kind) => {
    if (!enabled || !kind) return;
    const audio = start();
    if (!audio) return;
    const { context, master } = audio;
    const now = context.currentTime;

    if (kind === "static" || kind === "memory") {
      const buffer = context.createBuffer(1, context.sampleRate * 0.38, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      filter.type = kind === "memory" ? "bandpass" : "highpass";
      filter.frequency.value = kind === "memory" ? 680 : 2200;
      gain.gain.setValueAtTime(kind === "memory" ? 0.08 : 0.045, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      source.buffer = buffer;
      source.connect(filter).connect(gain).connect(master);
      source.start(now);
      return;
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = kind === "impact" ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(kind === "bell" ? 784 : kind === "fact" ? 622 : 116, now);
    if (kind === "bell") oscillator.frequency.exponentialRampToValueAtTime(392, now + 1.2);
    gain.gain.setValueAtTime(kind === "impact" ? 0.09 : 0.045, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (kind === "bell" ? 1.4 : 0.45));
    oscillator.connect(gain).connect(master);
    oscillator.start(now);
    oscillator.stop(now + (kind === "bell" ? 1.5 : 0.5));
  }, [enabled, start]);

  useEffect(() => () => stop(), [stop]);

  return { cue, enabled, start, toggle };
}
