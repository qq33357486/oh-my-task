import stepAccept from '../assets/step-accept.webp';
import stepBuild from '../assets/step-build.webp';
import stepDoc from '../assets/step-doc.webp';
import stepNeed from '../assets/step-need.webp';
import stepOrganize from '../assets/step-organize.webp';
import { guide } from './copy';
import { useStore } from '../store';
import './landing.css';

/** 五个阶段各配一张小图。 */
const STEP_IMAGES: Record<string, string> = {
  需求: stepNeed,
  文档: stepDoc,
  实现: stepBuild,
  验收: stepAccept,
  整理: stepOrganize,
};

/**
 * 使用说明：进了业务项目以后，从页眉点开的那一页。画在页面布局之外的一层，盖住整个页面；
 * 底下的页面没有卸载，关掉以后原样还在。只画画面，不写任何文件。
 */
export default function UsageGuide() {
  const closeGuide = useStore((s) => s.closeGuide);

  return (
    <div className="gd" role="dialog" aria-modal="true" aria-label={guide.title} data-testid="usage-guide">
      <header className="gd-top">
        <div className="gd-brand">
          <span className="gd-mark" aria-hidden="true">{guide.mark}</span>
          <span>{guide.brand}</span>
        </div>
        <span className="gd-title">{guide.title}</span>
        <button type="button" className="gd-close" aria-label={guide.back} onClick={closeGuide}>
          <span>{guide.back}</span>
          <span aria-hidden="true">✕</span>
        </button>
      </header>

      <main className="gd-main">
        <section className="gd-sec">
          <p className="gd-kicker">{guide.now.kicker}</p>
          <h2 className="gd-h2">{guide.now.title}</h2>
          <p className="gd-p">{guide.now.text}</p>
          <div className="gd-quote">
            <small>{guide.now.quoteLabel}</small>
            {guide.now.quote}
          </div>
          <p className="gd-note">{guide.now.note}</p>
        </section>

        <section className="gd-sec">
          <p className="gd-kicker">{guide.how.kicker}</p>
          <h2 className="gd-h2">{guide.how.title}</h2>
          <dl className="gd-stages">
            {guide.how.stages.map((stage) => (
              <div key={stage.name} className={`gd-stage${stage.who === '你出场' ? ' gd-stage--you' : ''}`}>
                <img src={STEP_IMAGES[stage.name]} alt="" loading="lazy" width={84} height={84} />
                <div>
                  <dt>{stage.name}</dt>
                  <small>{stage.who}</small>
                </div>
                <dd>{stage.text}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="gd-sec">
          <p className="gd-kicker">{guide.board.kicker}</p>
          <h2 className="gd-h2">{guide.board.title}</h2>
          {/* 看板的小样只是画个样子，读的人听下面逐列的说明 */}
          <div className="gd-board" aria-hidden="true">
            {guide.board.columns.map((column) => (
              <div key={column} className={`gd-col${column === guide.board.hot ? ' gd-col--hot' : ''}`}>
                {column}
              </div>
            ))}
          </div>
          <dl className="gd-cols">
            {guide.board.notes.map((note) => (
              <div key={note.name}>
                <dt>{note.name}</dt>
                <dd>{note.text}</dd>
              </div>
            ))}
          </dl>
          <p className="gd-note">{guide.board.update}</p>
        </section>
      </main>
    </div>
  );
}
