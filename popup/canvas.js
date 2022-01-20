import OsuRenderer from './renderers/osu'; 

const toTimeString = (time) => {
  const seconds = Math.floor(time / 1000) % 60;
  const minutes = Math.floor(time / 1000 / 60);
  return `${minutes}:${(`00${seconds}`).substr(-2)}`;
};

/**
 *
 * @param {HTMLCanvasElement} canvasElement
 * @param {*} playbackTimeElement
 * @param {HTMLDivElement} progressElement
 * @param {*} beatmap
 * @param {*} previewTime
 */
const playPreview = (canvasElement, playbackTimeElement, progressElement, beatmap, previewTime) => {
  let mapStartTime = previewTime;
  let startTime = performance.now();

  const ctx = canvasElement.getContext('2d');
  ctx.translate(64, 48);

  const renderer = new OsuRenderer(ctx, beatmap);

  const hitObjects = beatmap.objects;
  const lastObject = hitObjects[hitObjects.length - 1];
  const lastTime = lastObject.endTime;
  if (mapStartTime < 0) {
    mapStartTime = (lastObject.endTime) * 0.42;
  }
  let seeking = false;

  const animate = (currentTime) => {
    const time = seeking ? mapStartTime : currentTime - startTime + mapStartTime;
    // eslint-disable-next-line no-param-reassign
    playbackTimeElement.innerText = `${toTimeString(Math.min(time, lastTime))} / ${toTimeString(lastTime)}`;
    progressElement.style.setProperty('--progress', time / lastTime);
    ctx.clearRect(-64, -48, canvasElement.width, canvasElement.height);

    renderer.render(time);

    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);

  progressElement.addEventListener('pointerdown', (e) => {
    seeking = true;
    const rect = progressElement.getBoundingClientRect();
    const x = Math.max(0, e.clientX - rect.left);
    const time = (x / rect.width) * lastTime;
    startTime = performance.now();
    mapStartTime = time;
    progressElement.classList.add('seeking');
  });
  document.addEventListener('pointermove', (e) => {
    if (!seeking) return;
    const rect = progressElement.getBoundingClientRect();
    const x = Math.max(0, e.clientX - rect.left);
    const time = (x / rect.width) * lastTime;
    startTime = performance.now();
    mapStartTime = time;
  });
  document.addEventListener('pointerup', () => {
    progressElement.classList.remove('seeking');
    seeking = false;
  });
};

export default playPreview;
