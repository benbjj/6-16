import { useCallback, useEffect, useRef, useState } from "react";

const SCORE_MODES = {
  ambient: {
    tempo: 54,
    lead: [69, null, null, null, 76, null, null, null, 74, null, null, null, 71, null, null, null],
    bass: [45, null, null, null, null, null, null, null, 40, null, null, null, null, null, null, null],
    wave: "sine",
    level: 0.036,
    duration: 2.8,
  },
  investigation: {
    tempo: 76,
    lead: [62, null, 69, null, 65, null, 68, null, 62, null, 69, null, 70, null, 68, null],
    bass: [38, null, null, null, 38, null, null, null, 41, null, null, null, 37, null, null, null],
    wave: "triangle",
    level: 0.03,
    duration: 0.72,
  },
  confrontation: {
    tempo: 88,
    lead: [52, null, null, 53, null, null, 59, null, 52, null, 50, null, null, 53, null, null],
    bass: [28, null, null, null, null, null, 27, null, 28, null, null, null, 31, null, null, null],
    wave: "sawtooth",
    level: 0.022,
    duration: 1.15,
  },
  memory: {
    tempo: 66,
    lead: [69, null, 72, null, 76, null, 74, null, 72, null, 69, null, 67, null, 69, null],
    bass: [45, null, null, null, null, null, null, null, 41, null, null, null, null, null, null, null],
    wave: "sine",
    level: 0.045,
    duration: 1.9,
  },
};

const noteFrequency = (midi) => 440 * (2 ** ((midi - 69) / 12));

function scheduleTone(context, destination, midi, at, options) {
  const oscillator = context.createOscillator();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  const attack = Math.min(0.08, options.duration * 0.16);

  oscillator.type = options.wave;
  oscillator.frequency.setValueAtTime(noteFrequency(midi), at);
  if (options.detune) oscillator.detune.setValueAtTime(options.detune, at);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(options.cutoff, at);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(options.level, at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + options.duration);

  oscillator.connect(filter).connect(gain).connect(destination);
  oscillator.start(at);
  oscillator.stop(at + options.duration + 0.05);
}

export function useAmbientAudio(scoreMode = "ambient") {
  const [enabled, setEnabled] = useState(true);
  const audioRef = useRef(null);
  const scoreRef = useRef(scoreMode);

  useEffect(() => {
    scoreRef.current = scoreMode;
  }, [scoreMode]);

  const start = useCallback(() => {
    if (audioRef.current) {
      void audioRef.current.context.resume();
      return audioRef.current;
    }

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;

    const context = new AudioContext();
    const master = context.createGain();
    const rainBus = context.createGain();
    const musicBus = context.createGain();
    master.gain.value = 0.62;
    rainBus.gain.value = 0.8;
    musicBus.gain.value = 1;
    rainBus.connect(master);
    musicBus.connect(master);
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
    rainGain.gain.value = 0.052;
    rain.connect(rainFilter).connect(rainGain).connect(rainBus);
    rain.start();

    const sequencer = {
      step: 0,
      nextAt: context.currentTime + 0.08,
      mode: scoreRef.current,
    };

    const scheduleScore = () => {
      if (context.state !== "running") return;
      const mode = SCORE_MODES[scoreRef.current] ?? SCORE_MODES.ambient;
      if (sequencer.mode !== scoreRef.current) {
        sequencer.mode = scoreRef.current;
        sequencer.step = 0;
        sequencer.nextAt = context.currentTime + 0.12;
      }

      const stepDuration = 30 / mode.tempo;
      while (sequencer.nextAt < context.currentTime + 0.28) {
        const patternIndex = sequencer.step % mode.lead.length;
        const lead = mode.lead[patternIndex];
        const bass = mode.bass[patternIndex];
        if (lead) {
          scheduleTone(context, musicBus, lead, sequencer.nextAt, {
            wave: mode.wave,
            level: mode.level,
            duration: mode.duration,
            cutoff: scoreRef.current === "confrontation" ? 720 : 1500,
            detune: scoreRef.current === "memory" ? -4 : 0,
          });
        }
        if (bass) {
          scheduleTone(context, musicBus, bass, sequencer.nextAt, {
            wave: "sine",
            level: mode.level * 0.72,
            duration: Math.max(1.35, mode.duration),
            cutoff: 420,
          });
        }
        sequencer.step += 1;
        sequencer.nextAt += stepDuration;
      }
    };

    const timer = window.setInterval(scheduleScore, 120);
    scheduleScore();
    audioRef.current = { context, master, musicBus, rain, timer };
    return audioRef.current;
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    window.clearInterval(audio.timer);
    audio.rain.stop();
    void audio.context.close();
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
