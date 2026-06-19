import { useCallback, useEffect, useMemo, useState } from "react";
import { FACTS, SCENES, STORY, resolveText } from "./story.js";
import { useAmbientAudio } from "./useAmbientAudio.js";

const SAVE_KEY = "six-sixteen-prototype-save-v2";
const AUTO_DELAY_KEY = "six-sixteen-auto-delay";

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
  const [opening, setOpening] = useState(true);
  const [titleImageReady, setTitleImageReady] = useState(false);
  const [titlePanel, setTitlePanel] = useState(null);
  const [autoDelay, setAutoDelay] = useState(() => Number(localStorage.getItem(AUTO_DELAY_KEY)) || 1800);

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

  useEffect(() => {
    if (started || !opening) return undefined;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => setOpening(false), reducedMotion ? 80 : 2800);
    return () => window.clearTimeout(timer);
  }, [opening, started]);

  useEffect(() => {
    if (started) return undefined;
    let active = true;
    const image = new Image();
    image.onload = () => {
      if (active) setTitleImageReady(true);
    };
    image.src = SCENES.classroom;
    return () => { active = false; };
  }, [started]);

  useEffect(() => {
    if (!titleImageReady) return undefined;
    const timer = window.setTimeout(() => {
      [SCENES.records, SCENES.corridor].forEach((source) => {
        const image = new Image();
        image.src = source;
      });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [titleImageReady]);

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
    const delay = skip ? 180 : autoDelay;
    const timer = window.setTimeout(() => advance(), delay);
    return () => window.clearTimeout(timer);
  }, [advance, auto, autoDelay, line.choices, pendingFact, showEnd, showFacts, showLog, skip, started]);

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
    if (soundEnabled) startAudio();
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
    setIndex(0);
    setHistory([]);
    setDecisions({});
    setFacts([]);
    setChoiceResult(null);
    setPendingFact(null);
    setShowEnd(false);
    setTitlePanel(null);
    if (soundEnabled) startAudio();
    setStarted(true);
  };

  const beginChapterOne = () => {
    setIndex(chapterOneIndex);
    setHistory([]);
    setDecisions({});
    setFacts(["loop"]);
    setChoiceResult(null);
    setPendingFact(null);
    setShowEnd(false);
    setTitlePanel(null);
    if (soundEnabled) startAudio();
    setStarted(true);
  };

  const updateAutoDelay = (delay) => {
    setAutoDelay(delay);
    localStorage.setItem(AUTO_DELAY_KEY, String(delay));
  };

  if (!started) {
    return (
      <main className={`game-shell title-screen${opening ? " is-opening" : ""}`} style={{ "--scene-image": `url(${SCENES.classroomPreview})` }}>
        <div
          className={`title-hires${titleImageReady ? " is-ready" : ""}`}
          style={{ "--title-hires": `url(${SCENES.classroom})` }}
          aria-hidden="true"
        />
        <div className="rain" aria-hidden="true" />

        {opening ? (
          <section className="opening-sequence" aria-label="开场动画">
            <p className="opening-school">栖川学园</p>
            <div className="opening-date-card"><span>MONDAY</span><strong>06 / 16</strong><small>雨没有停</small></div>
            <p className="opening-warning">请不要接近旧教学楼</p>
            <button className="opening-skip" onClick={() => setOpening(false)} type="button">跳过</button>
          </section>
        ) : (
          <>
            <section className="title-content" aria-label="游戏标题">
              <p className="title-kicker">校园时间循环悬疑 AVG</p>
              <h1>6/16</h1>
              <p className="title-date">六月十六日，星期一</p>
              <nav className="title-menu" aria-label="开始界面选单">
                <button className="is-primary" onClick={begin} type="button"><span>NEW GAME</span>开始游戏</button>
                <button disabled={!hasSave} onClick={loadGame} type="button"><span>CONTINUE</span>{hasSave ? "继续游戏" : "尚无存档"}</button>
                <button onClick={() => setTitlePanel("chapters")} type="button"><span>CHAPTER</span>章节选择</button>
                <button onClick={() => setTitlePanel("settings")} type="button"><span>CONFIG</span>设置</button>
              </nav>
            </section>
            <p className="title-note">建议佩戴耳机 · 首次进入会在后台预载后续场景</p>
          </>
        )}

        {titlePanel === "chapters" && (
          <div className="modal-backdrop title-backdrop" role="presentation" onClick={() => setTitlePanel(null)}>
            <section className="title-panel" role="dialog" aria-modal="true" aria-label="章节选择" onClick={(event) => event.stopPropagation()}>
              <header><div><p>CHAPTER SELECT</p><h2>章节选择</h2></div><button onClick={() => setTitlePanel(null)} type="button">关闭</button></header>
              <button className="chapter-option" onClick={begin} type="button"><span>00</span><div><strong>序章　雨没有停</strong><small>六月十六日 · 第一次循环</small></div></button>
              <button className="chapter-option" onClick={beginChapterOne} type="button"><span>01</span><div><strong>第一章　缺席者</strong><small>六月十六日 · 第二次循环</small></div></button>
            </section>
          </div>
        )}

        {titlePanel === "settings" && (
          <div className="modal-backdrop title-backdrop" role="presentation" onClick={() => setTitlePanel(null)}>
            <section className="title-panel settings-panel" role="dialog" aria-modal="true" aria-label="设置" onClick={(event) => event.stopPropagation()}>
              <header><div><p>CONFIG</p><h2>设置</h2></div><button onClick={() => setTitlePanel(null)} type="button">关闭</button></header>
              <div className="setting-row"><div><strong>声音</strong><small>环境音、配乐与事件音效</small></div><button className={soundEnabled ? "is-selected" : ""} onClick={toggleSound} type="button">{soundEnabled ? "开启" : "关闭"}</button></div>
              <div className="setting-row"><div><strong>自动播放速度</strong><small>对话自动推进间隔</small></div><div className="setting-options"><button className={autoDelay === 1800 ? "is-selected" : ""} onClick={() => updateAutoDelay(1800)} type="button">标准</button><button className={autoDelay === 1100 ? "is-selected" : ""} onClick={() => updateAutoDelay(1100)} type="button">快速</button></div></div>
              <button className="replay-opening" onClick={() => { setTitlePanel(null); setOpening(true); }} type="button">重播开场动画</button>
            </section>
          </div>
        )}
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
