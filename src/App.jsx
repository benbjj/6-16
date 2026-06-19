import { useCallback, useEffect, useMemo, useState } from "react";
import { FACTS, SCENES, STORY, resolveText } from "./story.js";
import { useAmbientAudio } from "./useAmbientAudio.js";

const SAVE_KEY = "six-sixteen-prototype-save-v2";

function AppButton({ children, active = false, onClick }) {
  return (
    <button className={`utility-button${active ? " is-active" : ""}`} onClick={onClick} type="button">
      {children}
    </button>
  );
}

function FactCard({ fact, onClose }) {
  return (
    <div className="modal-backdrop fact-backdrop" role="presentation">
      <section className="fact-card" role="dialog" aria-modal="true" aria-label="获得事实卡">
        <p className="fact-category">事实卡 · {fact.category}</p>
        <h2>{fact.title}</h2>
        <p>{fact.description}</p>
        <button className="primary-action" onClick={onClose} type="button">收下事实</button>
      </section>
    </div>
  );
}

function FactsPanel({ factIds, onClose }) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="facts-panel" role="dialog" aria-modal="true" aria-label="已确认事实" onClick={(event) => event.stopPropagation()}>
        <header><div><p>跨循环保留</p><h2>已确认事实</h2></div><button onClick={onClose} type="button">关闭</button></header>
        <div className="facts-list">
          {factIds.map((factId, index) => {
            const fact = FACTS[factId];
            return (
              <article key={factId}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div><small>{fact.category}</small><h3>{fact.title}</h3><p>{fact.description}</p></div>
              </article>
            );
          })}
          {factIds.length === 0 && <p className="empty-log">尚未确认任何可以跨循环保留的事实。</p>}
        </div>
      </section>
    </div>
  );
}

export function App() {
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState([]);
  const [decisions, setDecisions] = useState({});
  const [choiceResult, setChoiceResult] = useState(null);
  const [facts, setFacts] = useState([]);
  const [pendingFact, setPendingFact] = useState(null);
  const [showFacts, setShowFacts] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  const [auto, setAuto] = useState(false);
  const [skip, setSkip] = useState(false);
  const [toast, setToast] = useState("");

  const line = choiceResult ?? STORY[index];
  const lineText = resolveText(line, decisions);
  const sceneImage = SCENES[line.scene] ?? SCENES.classroom;
  const scoreMode = line.effect === "memory" || line.speaker?.includes("夏见遥")
    ? "memory"
    : line.scene === "corridor" || line.effect === "midnight"
      ? "confrontation"
      : line.scene === "records" || line.loop === 2
        ? "investigation"
        : "ambient";
  const { cue, enabled: soundEnabled, start: startAudio, toggle: toggleSound } = useAmbientAudio(scoreMode);
  const hasSave = useMemo(() => Boolean(localStorage.getItem(SAVE_KEY)), [toast]);
  const chapterOneIndex = useMemo(() => STORY.findIndex((item) => item.id === "chapter-one"), []);
  const chapterLabel = index >= chapterOneIndex ? "第一章　缺席者" : "序章　雨没有停";

  const rememberLine = useCallback((current, text = current.text) => {
    setHistory((items) => {
      if (items.some((item) => item.id === current.id)) return items;
      return [...items, { ...current, text }];
    });
  }, []);

  const advance = useCallback(() => {
    if (line.choices || pendingFact) return;
    rememberLine(line, lineText);

    if (choiceResult) {
      setChoiceResult(null);
      setIndex((value) => value + 1);
      return;
    }

    if (line.fact && !facts.includes(line.fact)) {
      setFacts((current) => [...current, line.fact]);
      setPendingFact(line.fact);
      setAuto(false);
      setSkip(false);
      return;
    }

    if (line.ending || index === STORY.length - 1) {
      setAuto(false);
      setSkip(false);
      setShowEnd(true);
      return;
    }
    setIndex((value) => value + 1);
  }, [choiceResult, facts, index, line, lineText, pendingFact, rememberLine]);

  useEffect(() => {
    if (!started || line.choices || showLog || showFacts || showEnd || pendingFact || (!auto && !skip)) return undefined;
    const delay = skip ? 180 : 1800;
    const timer = window.setTimeout(() => advance(), delay);
    return () => window.clearTimeout(timer);
  }, [advance, auto, line.choices, pendingFact, showEnd, showFacts, showLog, skip, started]);

  useEffect(() => {
    const handleKey = (event) => {
      if (!started || showLog || showFacts || showEnd || pendingFact || line.choices) return;
      if (["Enter", " ", "ArrowRight"].includes(event.key)) {
        event.preventDefault();
        advance();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [advance, line.choices, pendingFact, showEnd, showFacts, showLog, started]);

  useEffect(() => {
    if (started && line.sfx) cue(line.sfx);
  }, [cue, index, line.sfx, started]);

  const choose = (choice) => {
    rememberLine({ ...line, text: `${lineText} ${choice.label}` }, `${lineText} ${choice.label}`);
    setDecisions((current) => ({ ...current, [choice.key]: choice.value }));
    setChoiceResult({
      id: `${line.id}-result`,
      scene: line.scene,
      time: line.time,
      speaker: choice.responseSpeaker ?? "白石凛",
      text: choice.response,
    });
  };

  const closeFact = () => {
    setPendingFact(null);
    if (line.ending || index === STORY.length - 1) setShowEnd(true);
    else setIndex((value) => value + 1);
  };

  const saveGame = () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ index, history, decisions, facts, choiceResult, started: true }));
    setToast("进度已保存在此浏览器");
    window.setTimeout(() => setToast(""), 1800);
  };

  const loadGame = () => {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    setIndex(Math.min(data.index ?? 0, STORY.length - 1));
    setHistory(data.history ?? []);
    setDecisions(data.decisions ?? {});
    setFacts(data.facts ?? []);
    setChoiceResult(data.choiceResult ?? null);
    setStarted(true);
    setShowEnd(false);
    startAudio();
  };

  const restart = () => {
    setIndex(0);
    setHistory([]);
    setDecisions({});
    setFacts([]);
    setChoiceResult(null);
    setPendingFact(null);
    setShowEnd(false);
    setAuto(false);
    setSkip(false);
  };

  const begin = () => {
    startAudio();
    setStarted(true);
  };

  if (!started) {
    return (
      <main className="game-shell title-screen" style={{ "--scene-image": `url(${SCENES.classroom})` }}>
        <div className="rain" aria-hidden="true" />
        <section className="title-content" aria-label="游戏标题">
          <p className="title-kicker">校园时间循环悬疑 AVG</p>
          <h1>6/16</h1>
          <p className="title-date">六月十六日，星期一</p>
          <div className="title-actions">
            <button className="primary-action" onClick={begin} type="button">开始</button>
            <button className="secondary-action" disabled={!hasSave} onClick={loadGame} type="button">继续</button>
          </div>
        </section>
        <p className="title-note">建议佩戴耳机 · 点击画面或按 Enter 推进</p>
      </main>
    );
  }

  return (
    <main
      className={`game-shell story-screen effect-${line.effect ?? "none"}`}
      style={{ "--scene-image": `url(${sceneImage})` }}
      onClick={(event) => {
        if (event.target === event.currentTarget || event.target.classList.contains("scene-layer")) advance();
      }}
    >
      <div className="scene-layer" aria-hidden="true" />
      <div className="rain" aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />

      {index >= chapterOneIndex && (
        <div className="chapter-meta">
          <span>{chapterLabel}</span>
          <button className={soundEnabled ? "" : "is-muted"} onClick={toggleSound} type="button">声音 {soundEnabled ? "开" : "关"}</button>
        </div>
      )}
      <div className="scene-meta" aria-label="当前时间"><time>{line.time}</time></div>

      <section className="dialogue" aria-live="polite">
        <div className="dialogue-copy">
          <p className={`speaker${line.speaker ? "" : " is-hidden"}`}>{line.speaker || "旁白"}</p>
          <p className="line">{lineText}<span className="advance-mark" aria-hidden="true" /></p>
        </div>

        {line.choices && (
          <div className="choices" aria-label="选择">
            {line.choices.map((choice) => (
              <button key={choice.label} onClick={() => choose(choice)} type="button">{choice.label}</button>
            ))}
          </div>
        )}

        <nav className="utility-nav" aria-label="阅读控制">
          {facts.length > 0 && <AppButton onClick={() => setShowFacts(true)}>事实 {facts.length}</AppButton>}
          <AppButton onClick={() => setShowLog(true)}>记录</AppButton>
          <AppButton active={skip} onClick={() => { setSkip((value) => !value); setAuto(false); }}>快进</AppButton>
          <AppButton active={auto} onClick={() => { setAuto((value) => !value); setSkip(false); }}>自动</AppButton>
          <AppButton onClick={saveGame}>保存</AppButton>
        </nav>
      </section>

      {showLog && (
        <div className="modal-backdrop" role="presentation" onClick={() => setShowLog(false)}>
          <section className="log-panel" role="dialog" aria-modal="true" aria-label="对话记录" onClick={(event) => event.stopPropagation()}>
            <header><h2>对话记录</h2><button onClick={() => setShowLog(false)} type="button">关闭</button></header>
            <div className="log-list">
              {history.length === 0 && <p className="empty-log">还没有可回看的内容。</p>}
              {[...history].reverse().map((item, itemIndex) => (
                <article key={`${item.id}-${itemIndex}`}>{item.speaker && <strong>{item.speaker}</strong>}<p>{item.text}</p></article>
              ))}
            </div>
          </section>
        </div>
      )}

      {showFacts && <FactsPanel factIds={facts} onClose={() => setShowFacts(false)} />}
      {pendingFact && <FactCard fact={FACTS[pendingFact]} onClose={closeFact} />}

      {showEnd && (
        <div className="modal-backdrop end-backdrop" role="presentation">
          <section className="end-panel" role="dialog" aria-modal="true" aria-label="第一章结束">
            <p className="end-kicker">FIRST VERTICAL SLICE</p>
            <h2>第一章《缺席者》</h2>
            <p>已确认 {facts.length} 项事实 · 悠真证言开启</p>
            <div className="end-facts">{facts.map((factId) => <span key={factId}>{FACTS[factId].title}</span>)}</div>
            <div className="end-actions">
              <button className="primary-action" onClick={restart} type="button">重新体验</button>
              <button className="secondary-action" onClick={saveGame} type="button">保存进度</button>
            </div>
          </section>
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
