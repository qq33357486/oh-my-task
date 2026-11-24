/** 品牌标识：方块标记加「DJ Task」字样，页眉和入口页共用。 */
export default function Brand({ large = false }: { large?: boolean }) {
  return (
    <div className={large ? 'brand brand--large' : 'brand'}>
      <span className="brand__mark" aria-hidden="true">
        DJ
      </span>
      <span className="brand__text">
        <span className="brand__name">DJ Task</span>
        <span className="brand__sub">多杰任务系统</span>
      </span>
    </div>
  );
}
