import { useEffect, useRef, useState, type ReactNode } from 'react';
import { DemoTag, EmptyState, Field, Landing, NotFound, Notice, PageHead, Shell, useFlash, usePersistentState, useRoute } from './shared/ui';
import { KIND_LABEL, KIND_NOTE, contrast, deltaE, paletteRisks, parseHex, simulate, simulatePixels, toHex, type Kind, type RGB } from './lib/vision';

const KEY = 'color-lens:store';
const NAV = [
  { to: '/', label: 'Overview' },
  { to: '/image', label: 'Image' },
  { to: '/palette', label: 'Palette' },
  { to: '/method', label: 'Method' },
];
const KINDS: Kind[] = ['protan', 'deutan', 'tritan', 'achroma'];
const DEMO_PALETTE = ['#d62728', '#2ca02c', '#1f77b4', '#ff7f0e', '#9467bd', '#8c564b'];
const MAX_SIDE = 900;

interface Store {
  palette: string[];
  kind: Kind;
  severity: number;
}

export default function App() {
  const [route] = useRoute();
  const [store, setStore] = usePersistentState<Store>(KEY, { palette: DEMO_PALETTE, kind: 'deutan', severity: 1 });
  const ctx = { store, setStore };
  let page: ReactNode;
  if (route === '/') page = <Home />;
  else if (route === '/image') page = <ImagePage {...ctx} />;
  else if (route === '/palette') page = <PalettePage {...ctx} />;
  else if (route === '/method') page = <Method />;
  else page = <NotFound />;
  return (
    <Shell name="Color Lens" wordmark={['Color', 'Lens']} nav={NAV} route={route} cta={{ to: '/palette', label: 'Check a palette' }} footerNote="Simulations are educational approximations, not a diagnosis. Images never leave your device.">
      {page}
    </Shell>
  );
}

type Ctx = { store: Store; setStore: (s: Store) => void };

/* ---------- Demo images drawn on canvas ---------- */
type Demo = 'chart' | 'map' | 'status';
const DEMOS: [Demo, string][] = [['chart', 'Line chart (red vs green)'], ['map', 'Transit map legend'], ['status', 'Status indicators']];

function drawDemo(c: HTMLCanvasElement, demo: Demo) {
  const ctx = c.getContext('2d');
  if (!ctx) return;
  c.width = 640; c.height = 400;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 640, 400);
  ctx.font = '600 18px system-ui, sans-serif'; ctx.fillStyle = '#222';
  if (demo === 'chart') {
    ctx.fillText('Demo: signups by channel (fictional)', 24, 34);
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1;
    for (let y = 80; y <= 340; y += 52) { ctx.beginPath(); ctx.moveTo(50, y); ctx.lineTo(610, y); ctx.stroke(); }
    const series: [string, number[]][] = [['#d62728', [300, 270, 280, 230, 210, 180, 150]], ['#2ca02c', [320, 290, 260, 250, 220, 200, 170]], ['#1f77b4', [330, 320, 300, 310, 290, 280, 260]]];
    for (const [col, pts] of series) {
      ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.beginPath();
      pts.forEach((y, i) => (i ? ctx.lineTo(60 + i * 90, y) : ctx.moveTo(60, y)));
      ctx.stroke();
    }
    [['#d62728', 'Ads'], ['#2ca02c', 'Search'], ['#1f77b4', 'Email']].forEach(([col, name], i) => { ctx.fillStyle = col; ctx.fillRect(60 + i * 150, 362, 18, 18); ctx.fillStyle = '#222'; ctx.font = '16px system-ui'; ctx.fillText(name, 86 + i * 150, 377); });
  } else if (demo === 'map') {
    ctx.fillText('Demo: transit lines (fictional)', 24, 34);
    const lines: [string, string, number][] = [['#e8112d', 'Red line', 80], ['#009b3a', 'Green line', 140], ['#ff8c00', 'Orange line', 200], ['#8b4513', 'Brown line', 260], ['#0072ce', 'Blue line', 320]];
    for (const [col, name, y] of lines) {
      ctx.strokeStyle = col; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(60, y); ctx.lineTo(420, y); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#222'; ctx.lineWidth = 3; for (const x of [120, 240, 360]) { ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = '#222'; ctx.font = '17px system-ui'; ctx.fillText(name, 450, y + 6);
    }
  } else {
    ctx.fillText('Demo: service status (fictional)', 24, 34);
    const rows: [string, string, string][] = [['#2e9e44', 'API', 'OK'], ['#e2a400', 'Search', 'Slow'], ['#d0312d', 'Payments', 'Down'], ['#2e9e44', 'Login', 'OK']];
    rows.forEach(([col, name], i) => { const y = 90 + i * 70; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(80, y, 20, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#222'; ctx.font = '20px system-ui'; ctx.fillText(name, 120, y + 7); });
    ctx.font = '14px system-ui'; ctx.fillStyle = '#555'; ctx.fillText('Colour is the only cue here — try it under deuteranopia.', 24, 380);
  }
}

function applyTo(src: HTMLCanvasElement, dst: HTMLCanvasElement | null, kind: Kind, severity: number) {
  if (!dst) return;
  const sctx = src.getContext('2d'), dctx = dst.getContext('2d');
  if (!sctx || !dctx || !src.width) return;
  dst.width = src.width; dst.height = src.height;
  const img = sctx.getImageData(0, 0, src.width, src.height);
  simulatePixels(img.data, kind, severity);
  dctx.putImageData(img, 0, 0);
}

function HeroPreview() {
  const colors = DEMO_PALETTE.slice(0, 4).map((h) => parseHex(h)!);
  return (
    <div className="hero-cl">
      {(['normal', 'protan', 'deutan', 'tritan'] as Kind[]).map((k, i) => (
        <div key={k} className="hero-row" style={{ ['--i' as string]: i }}>
          <span className="small">{k === 'normal' ? 'Typical' : KIND_LABEL[k].split(' ')[0]}</span>
          <span className="sw-row">{colors.map((c, j) => <i key={j} style={{ background: toHex(simulate(c, k)) }} />)}</span>
        </div>
      ))}
      <p className="small muted">Red and green (first two) nearly merge for protanopia and deuteranopia.</p>
    </div>
  );
}

function Home() {
  return (
    <Landing
      eyebrow="Colour-vision simulator"
      title={<>See your design <em>through other eyes.</em></>}
      lead="Preview images and colour palettes as people with the common colour-vision deficiencies are likely to see them, and find colour pairs that stop being distinguishable — before your users do."
      primary={{ href: '#/image', label: 'Simulate an image' }}
      secondary={{ href: '#/palette', label: 'Check a palette' }}
      previewLabel="Category palette — simulated"
      preview={<HeroPreview />}
      steps={[
        { title: 'Load an image', body: 'Use one of the demo graphics or your own screenshot. It’s processed in your browser and never uploaded.' },
        { title: 'Compare views', body: 'See protanopia, deuteranopia, tritanopia and achromatopsia side by side, or one at a chosen severity.' },
        { title: 'Fix the palette', body: 'Paste your chart or UI colours and get the pairs that collapse, with colour differences and contrast.' },
      ]}
      stepsIntro="Around 1 in 12 men and 1 in 200 women have some form of colour-vision deficiency, most commonly red–green."
      features={[
        { title: 'Research-based', body: 'Uses the Machado, Oliveira & Fernandes (2009) model applied in linear RGB.' },
        { title: 'Adjustable severity', body: 'From mild anomalous trichromacy to full dichromacy, for the three cone types.' },
        { title: 'Palette risk table', body: 'Every pair’s colour difference (CIE ΔE) under each deficiency, with likely clashes flagged.' },
        { title: 'Private', body: 'Images stay on the device; export the simulated version as PNG.' },
      ]}
      note="Simulations are educational approximations of average perception and are not a diagnostic tool."
      closing={{ title: <>Never rely on <em>colour alone.</em></>, action: { href: '#/palette', label: 'Check your palette' } }}
    />
  );
}

/* ---------- Image ---------- */
function ImagePage({ store, setStore }: Ctx) {
  const src = useRef<HTMLCanvasElement>(null);
  const refs = useRef<Record<string, HTMLCanvasElement | null>>({});
  const [source, setSource] = useState<Demo | 'upload'>('chart');
  const [view, setView] = useState<'grid' | 'single'>('grid');
  const [version, setVersion] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  useEffect(() => {
    const c = src.current;
    if (!c) return;
    if (!c.getContext('2d')) { setSupported(false); return; }
    if (source !== 'upload') { drawDemo(c, source); setVersion((v) => v + 1); }
  }, [source]);
  useEffect(() => {
    const c = src.current;
    if (!c || !c.width) return;
    if (view === 'grid') for (const k of KINDS) applyTo(c, refs.current[k], k, 1);
    else applyTo(c, refs.current.single, store.kind, store.severity);
    const n = refs.current.normal;
    if (n) { n.width = c.width; n.height = c.height; n.getContext('2d')?.drawImage(c, 0, 0); }
  }, [version, view, store.kind, store.severity]);

  async function onFile(file?: File) {
    if (!file) return;
    if (!/^image\/(png|jpeg|gif|webp|bmp)$/.test(file.type)) return setErr('Choose a PNG, JPEG, GIF, WebP or BMP image.');
    if (file.size > 20 * 1024 * 1024) return setErr('That image is over 20 MB.');
    setErr(null);
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const k = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
      const c = src.current!;
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      setSource('upload');
      setVersion((v) => v + 1);
    } catch {
      setErr('Couldn’t read that image.');
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  function download(id: string, name: string) {
    const c = refs.current[id];
    if (!c) return;
    const a = document.createElement('a');
    a.href = c.toDataURL('image/png');
    a.download = name;
    a.click();
  }

  return (
    <div className="stack">
      <PageHead eyebrow="Image" title={<>Simulate <em>an image.</em></>} description="Processed with canvas in your browser; large images are scaled to 900 px." />
      {!supported && <Notice kind="error">This browser can’t process images (no canvas support). The palette checker still works.</Notice>}
      <div className="card filters">
        <Field label="Image">{(p) => <select {...p} value={source} onChange={(e) => setSource(e.target.value as Demo)}>{DEMOS.map(([k, l]) => <option key={k} value={k}>Demo: {l}</option>)}{source === 'upload' && <option value="upload">Your image</option>}</select>}</Field>
        <div className="field upload-field"><span className="label">Or your own</span><label className="btn">Upload image<input type="file" accept="image/*" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} /></label>{err && <span className="error-text" role="alert">{err}</span>}</div>
        <div className="tabs" role="radiogroup" aria-label="View">
          <button type="button" role="radio" aria-checked={view === 'grid'} onClick={() => setView('grid')}>All types</button>
          <button type="button" role="radio" aria-checked={view === 'single'} onClick={() => setView('single')}>One type, adjustable</button>
        </div>
      </div>
      {source !== 'upload' && <p><DemoTag /> <span className="small muted">Fictional demo graphic drawn in the browser.</span></p>}
      <canvas ref={src} className="sr-only" aria-hidden="true" />
      {view === 'grid' ? (
        <div className="sim-grid">
          {(['normal', ...KINDS] as Kind[]).map((k) => (
            <figure key={k} className="card sim">
              <canvas ref={(el) => { refs.current[k] = el; }} role="img" aria-label={`${source === 'upload' ? 'Your image' : 'Demo image'} as seen with ${KIND_LABEL[k].toLowerCase()}`} />
              <figcaption><strong>{KIND_LABEL[k]}</strong><span className="small muted">{KIND_NOTE[k]}</span>{k !== 'normal' && <button type="button" className="btn btn-sm btn-ghost" onClick={() => download(k, `simulated-${k}.png`)}>Download PNG</button>}</figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <div className="stack">
          <div className="card filters">
            <Field label="Type">{(p) => <select {...p} value={store.kind} onChange={(e) => setStore({ ...store, kind: e.target.value as Kind })}>{KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select>}</Field>
            <Field label={`Severity: ${Math.round(store.severity * 100)}%`} hint={store.kind === 'achroma' ? 'Proportion of colour removed' : store.severity < 1 ? 'Anomalous trichromacy (weaker cones)' : 'Dichromacy (cone type missing)'}>{(p) => <input {...p} type="range" min={0} max={1} step={0.1} value={store.severity} onChange={(e) => setStore({ ...store, severity: Number(e.target.value) })} />}</Field>
          </div>
          <div className="grid-2">
            <figure className="card sim"><canvas ref={(el) => { refs.current.normal = el; }} role="img" aria-label="Original image" /><figcaption><strong>Original</strong></figcaption></figure>
            <figure className="card sim"><canvas ref={(el) => { refs.current.single = el; }} role="img" aria-label={`Simulated ${KIND_LABEL[store.kind]} at ${Math.round(store.severity * 100)}%`} /><figcaption><strong>{KIND_LABEL[store.kind]}</strong><span className="small muted">{Math.round(store.severity * 100)}% severity</span><button type="button" className="btn btn-sm btn-ghost" onClick={() => download('single', `simulated-${store.kind}-${Math.round(store.severity * 100)}.png`)}>Download PNG</button></figcaption></figure>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Palette ---------- */
function PalettePage({ store, setStore }: Ctx) {
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useFlash();
  const colors = store.palette.map((h) => parseHex(h)!).filter(Boolean) as RGB[];
  const { pairs, flagged } = paletteRisks(colors);
  const name = (i: number) => store.palette[i];
  function add(e: React.FormEvent) {
    e.preventDefault();
    const items = text.split(/[\s,;]+/).filter(Boolean);
    const bad = items.filter((x) => !parseHex(x));
    if (!items.length) return setErr('Enter one or more hex colours, e.g. #1f77b4.');
    if (bad.length) return setErr(`Not a hex colour: ${bad.join(', ')}`);
    const next = [...new Set([...store.palette, ...items.map((x) => toHex(parseHex(x)!))])].slice(0, 12);
    setErr(null);
    setText('');
    setStore({ ...store, palette: next });
  }
  return (
    <div className="stack">
      <PageHead eyebrow="Palette" title={<>Which colours <em>collide?</em></>} description="Add the colours used for categories, lines or status. Up to 12." actions={<><button type="button" className="btn btn-ghost" onClick={() => { setStore({ ...store, palette: DEMO_PALETTE }); setFlash({ kind: 'success', text: 'Demo palette restored.' }); }}>Demo palette</button><button type="button" className="btn btn-ghost" onClick={() => setStore({ ...store, palette: [] })}>Clear</button></>} />
      {flash && <Notice kind={flash.kind} onDismiss={() => setFlash(null)}>{flash.text}</Notice>}
      <form className="card filters" onSubmit={add} noValidate>
        <Field label="Add colours" className="grow" hint="Hex codes separated by spaces or commas" error={err}>{(p) => <input {...p} value={text} onChange={(e) => setText(e.target.value)} placeholder="#1f77b4 #ff7f0e" />}</Field>
        <button className="btn btn-primary" type="submit">Add</button>
      </form>
      {colors.length < 2 ? <EmptyState title="Add at least two colours">Pairs are compared once there are two or more.</EmptyState> : (
        <>
          <section className="card stack" aria-labelledby="sw-t">
            <h2 id="sw-t" className="h3">How the palette looks</h2>
            <div className="table-wrap">
              <table className="table swatches">
                <caption className="sr-only">Palette colours under each type of colour vision</caption>
                <thead><tr><th scope="col">Vision</th>{store.palette.map((h, i) => <th scope="col" key={h}><span className="sr-only">Colour {i + 1} </span>{h}<button type="button" className="icon-btn rm" aria-label={`Remove ${h}`} onClick={() => setStore({ ...store, palette: store.palette.filter((x) => x !== h) })}>✕</button></th>)}</tr></thead>
                <tbody>{(['normal', ...KINDS] as Kind[]).map((k) => <tr key={k}><th scope="row">{KIND_LABEL[k]}</th>{colors.map((c, i) => { const s = toHex(simulate(c, k)); return <td key={i}><span className="sw" style={{ background: s }} title={s} /></td>; })}</tr>)}</tbody>
              </table>
            </div>
          </section>
          {flagged.length ? <Notice kind="warn"><span data-testid="flagged">{flagged.length} pair{flagged.length === 1 ? '' : 's'} become hard to tell apart.</span> Add a second cue — labels, patterns, line styles or a bigger lightness difference.</Notice> : <Notice kind="success"><span data-testid="flagged">No pairs collapse under protanopia, deuteranopia or tritanopia.</span></Notice>}
          <section className="card stack" aria-labelledby="pr-t">
            <h2 id="pr-t" className="h3">Pairs</h2>
            <div className="table-wrap">
              <table className="table">
                <caption className="sr-only">Colour difference (CIE ΔE) for each pair</caption>
                <thead><tr><th scope="col">Pair</th><th scope="col" className="num">Typical</th><th scope="col" className="num">Protan</th><th scope="col" className="num">Deutan</th><th scope="col" className="num">Tritan</th><th scope="col" className="num">Greyscale</th><th scope="col" className="num">Contrast</th></tr></thead>
                <tbody>{[...pairs].sort((a, b) => Math.min(a.simulated.protan, a.simulated.deutan, a.simulated.tritan) - Math.min(b.simulated.protan, b.simulated.deutan, b.simulated.tritan)).map((p) => {
                  const risk = flagged.includes(p);
                  const cell = (v: number) => <td className={`num ${v < 12 ? 'low' : ''}`}>{v}</td>;
                  return <tr key={`${p.i}-${p.j}`} className={risk ? 'risk' : ''}><th scope="row"><span className="pair"><i style={{ background: name(p.i) }} /><i style={{ background: name(p.j) }} />{name(p.i)} / {name(p.j)}</span>{risk && <span className="badge badge-warn">Clash</span>}</th>{cell(p.normal)}{cell(p.simulated.protan)}{cell(p.simulated.deutan)}{cell(p.simulated.tritan)}{cell(p.simulated.achroma)}<td className="num">{contrast(colors[p.i], colors[p.j])}:1</td></tr>;
                })}</tbody>
              </table>
            </div>
            <p className="small muted">ΔE (CIE76): under about 12 the colours are easy to confuse at a glance, especially for thin lines or small marks. Contrast is the WCAG ratio between the two colours.</p>
          </section>
        </>
      )}
    </div>
  );
}

function Method() {
  const sample: RGB = [214, 39, 40];
  return (
    <div className="stack prose-page">
      <PageHead eyebrow="Method" title={<>How the simulation <em>works.</em></>} />
      <section className="card stack">
        <h2 className="h3">Model</h2>
        <p>Each pixel is converted from sRGB to linear RGB, multiplied by a 3 × 3 matrix, and converted back. The matrices for protanopia, deuteranopia and tritanopia are the full-severity matrices published by Machado, Oliveira and Fernandes (2009), <em>A Physiologically-based Model for Simulation of Color Vision Deficiency</em>.</p>
        <p>Lower severities are approximated by blending each matrix with the identity matrix. The paper also publishes separate matrices for each severity step; this blend is close to them but not identical.</p>
        <p>Achromatopsia is approximated by replacing colour with relative luminance (Rec. 709 weights). Real achromatopsia also involves light sensitivity and reduced acuity, which this cannot show.</p>
        <p className="small muted">Example: {toHex(sample)} becomes {toHex(simulate(sample, 'protan'))} (protan), {toHex(simulate(sample, 'deutan'))} (deutan), {toHex(simulate(sample, 'tritan'))} (tritan). ΔE between the original and the protan version: {deltaE(sample, simulate(sample, 'protan'))}.</p>
      </section>
      <section className="card stack">
        <h2 className="h3">Limitations</h2>
        <ul>
          <li>Simulations show an average; individual perception varies.</li>
          <li>Screens, colour profiles and lighting change what anyone sees.</li>
          <li>This is not a diagnostic tool. Colour-vision tests are done by eye-care professionals.</li>
        </ul>
      </section>
    </div>
  );
}
