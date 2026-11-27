import { useState, type ReactNode } from 'react';
import believePath from '../assets/believe-path.webp';
import closingBoard from '../assets/closing-board.webp';
import heroRibbons from '../assets/hero-ribbons.webp';
import { below, facts, hero, stageKicker, stages, ui } from './copy';
import StageLoop from './StageLoop';
import './landing.css';

/** 入口页上「开始享受」有几个，出错提示跟着人最后点的那一个走。 */
type Spot = 'hero' | 'closing';

/** 出错提示：哪一步没成功、下一步做什么。 */
export interface LandingError {
  title: string;
  next?: string;
}

interface Props {
  /** 点「开始享受」 */
  onStart: () => void;
  /** 点出错提示里的「选择目录」 */
  onPick: () => void;
  /** 入口页上的出错提示，画在「开始享受」上方。没有就不画。 */
  error?: LandingError | null;
  /** 浏览器不支持选目录、点了按钮以后才有的那句提示，画在按钮下方。 */
  unsupportedHint?: boolean;
  /** 测试用：提示画在哪一个按钮旁边。平时由点的是哪个按钮决定。 */
  spot?: Spot;
}

/** 两处「开始享受」共用的按钮和它旁边的提示。 */
function StartBlock({
  spot,
  active,
  error,
  unsupportedHint,
  onStart,
  onPick,
}: {
  spot: Spot;
  active: Spot;
  error: LandingError | null | undefined;
  unsupportedHint: boolean | undefined;
  onStart: (spot: Spot) => void;
  onPick: () => void;
}) {
  const shown = spot === active;
  return (
    <div className="ld-actions">
      {shown && error && (
        <div className="ld-notice ld-notice--error" role="alert">
          <p className="ld-notice__title">{error.title}</p>
          {error.next && <p className="ld-notice__next">{error.next}</p>}
          <button type="button" className="ld-notice__action" onClick={onPick}>
            {ui.pick}
          </button>
        </div>
      )}
      <button type="button" className="ld-cta" onClick={() => onStart(spot)}>
        {hero.cta}
      </button>
      {shown && unsupportedHint && (
        <p className="ld-notice ld-notice--hint" role="status">
          {hero.unsupported}
        </p>
      )}
    </div>
  );
}

/**
 * 整个入口页：首屏、以下三段、收尾、页脚。只画画面，不碰浏览器，也不写任何文件。
 */
export default function LandingPage({ onStart, onPick, error = null, unsupportedHint = false, spot: spotProp }: Props) {
  const [stage, setStage] = useState(0);
  const [clicked, setClicked] = useState<Spot>('hero');
  const activeSpot = spotProp ?? clicked;
  const current = stages[stage] ?? stages[0];

  const start = (spot: Spot) => {
    setClicked(spot);
    onStart();
  };

  // 收尾的标题和首屏一样：前半句白色，后半句渐变。
  const closingRest = below.closingTitle.endsWith(hero.titleRest) ? below.closingTitle.slice(-hero.titleRest.length) : '';
  const closingLead = closingRest ? below.closingTitle.slice(0, -closingRest.length) : below.closingTitle;

  const section = (children: ReactNode) => <div className="ld-in">{children}</div>;

  return (
    <div className="ld" data-testid="landing">
      <section className="ld-hero" aria-label="入口页首屏">
        <div className="ld-hero__bg" aria-hidden="true">
          <img src={heroRibbons} alt="" width={1638} height={820} />
        </div>

        <nav className="ld-nav" aria-label="品牌">
          <div className="ld-brand">
            <span className="ld-brand__mark" aria-hidden="true">{hero.mark}</span>
            <span className="ld-brand__text">
              <b>{hero.brand}</b>
              <small>{hero.brandSub}</small>
            </span>
          </div>
        </nav>

        <header className="ld-hero__top">
          <div className="ld-hero__lead">
            <h1 className="ld-h1">
              {hero.titleLead}
              <br className="ld-h1__br" />
              <em>{hero.titleRest}</em>
            </h1>
            <p className="ld-sub">{hero.subtitle}</p>
          </div>
          <StartBlock
            spot="hero"
            active={activeSpot}
            error={error}
            unsupportedHint={unsupportedHint}
            onStart={start}
            onPick={onPick}
          />
        </header>

        <div className="ld-hero__bottom">
          <div className="ld-loop">
            <StageLoop value={stage} onChange={setStage} />
          </div>
          <div className="ld-divider" aria-hidden="true" />
          <div className="ld-explain" aria-live="polite">
            <p className="ld-kicker">{stageKicker(stage)}</p>
            <h2 className="ld-stage-title">{current.name}</h2>
            <p className="ld-slogan">{current.slogan}</p>
            <dl className="ld-facts">
              <dt>{facts.what}</dt>
              <dd>{current.what}</dd>
              <dt>{facts.why}</dt>
              <dd>{current.why}</dd>
            </dl>
          </div>
        </div>
      </section>

      <div className="ld-body">
        <section className="ld-sec">
          {section(
            <>
              <p className="ld-sec__kicker">{below.pain.kicker}</p>
              <h2 className="ld-h2">{below.pain.title}</h2>
              <ul className="ld-pain">
                {below.pain.items.map((item) => (
                  <li key={item.no}>
                    <i>{item.no}</i>
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            </>,
          )}
        </section>

        <section className="ld-sec">
          {section(
            <>
              <p className="ld-sec__kicker">{below.split.kicker}</p>
              <h2 className="ld-h2">{below.split.title}</h2>
              <div className="ld-rows">
                {below.split.rows.map((row) => (
                  <div key={row.title} className="ld-row">
                    <b>{row.title}</b>
                    <span>{row.text}</span>
                  </div>
                ))}
              </div>
            </>,
          )}
        </section>

        <section className="ld-sec ld-sec--believe">
          <div className="ld-believe__bg" aria-hidden="true">
            <img src={believePath} alt="" loading="lazy" width={1200} height={600} />
          </div>
          {section(
            <>
              <p className="ld-sec__kicker">{below.believe.kicker}</p>
              <h2 className="ld-h2">{below.believe.title}</h2>
              <div className="ld-cards">
                {below.believe.cards.map((card) => (
                  <div key={card.title} className="ld-card">
                    <b>{card.title}</b>
                    <span>{card.text}</span>
                  </div>
                ))}
              </div>
            </>,
          )}
        </section>

        <section className="ld-closing">
          <div className="ld-in">
            <h2 className="ld-h2">
              {closingLead}
              {closingRest && <em>{closingRest}</em>}
            </h2>
            <StartBlock
              spot="closing"
              active={activeSpot}
              error={error}
              unsupportedHint={unsupportedHint}
              onStart={start}
              onPick={onPick}
            />
          </div>
          <div className="ld-closing__art" aria-hidden="true">
            <img src={closingBoard} alt="" loading="lazy" width={1916} height={958} />
          </div>
        </section>

        <footer className="ld-foot">{below.footer}</footer>
      </div>
    </div>
  );
}
