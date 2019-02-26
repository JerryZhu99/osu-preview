import ojsama from './ojsama';
import { BEATMAP_URL_REGEX } from '../common/constants';

const FETCH_ATTEMPTS = 3;
const UNSUPPORTED_GAMEMODE = 'Unsupported gamemode!'; // TODO: Add to translations

const containerElement = document.getElementById('container');
const headerElement = document.getElementById('header');
const titleElement = document.querySelector('.song-title');
const artistElement = document.querySelector('.artist');
const difficultyNameElement = document.getElementById('difficulty-name');
/** @type {HTMLCanvasElement} */
const canvasElement = document.getElementById('canvas');
const errorElement = document.getElementById('error');

// Set after the extension initializes, used for additional error information.
let previewTime = null;
let cleanBeatmap = null;
let pageInfo = {
  isOldSite: null,
  beatmapSetId: null,
  beatmapId: null,
};

const CIRCLE_BORDER_WIDTH = 5;
const CIRCLE_HIT_FACTOR = 1.33;
const CIRCLE_HIT_DURATION = 150;
const APPROACH_CIRCLE_WIDTH = 3;
const APPROACH_CIRCLE_SIZE = 100;
const FOLLOW_CIRCLE_FACTOR = 2;
const FOLLOW_CIRCLE_WIDTH = 3;

const playPreview = () => {
  const ctx = canvasElement.getContext('2d');
  ctx.translate(64, 48);
  const timingPoints = cleanBeatmap.timing_points;
  let msPerBeat = timingPoints[0].ms_per_beat;
  for (let i = 0; i < timingPoints.length; i += 1) {
    const point = timingPoints[i];
    if (point.ms_per_beat < 0) {
      point.ms_per_beat = msPerBeat * point.ms_per_beat / -100;
    } else {
      msPerBeat = point.ms_per_beat;
    }
  }
  timingPoints.reverse();

  const hitObjects = cleanBeatmap.objects;

  const { ar: AR, cs: CS, sv: SV } = cleanBeatmap;

  const circleRadius = 32 * (1 - 0.7 * (CS - 5) / 5);

  let preempt;
  if (AR <= 5) {
    preempt = 1200 + 600 * (5 - AR) / 5;
  } else {
    preempt = 1200 - 750 * (AR - 5) / 5;
  }
  let fadeIn;
  if (AR <= 5) {
    fadeIn = 800 + 400 * (5 - AR) / 5;
  } else {
    fadeIn = 800 - 500 * (AR - 5) / 5;
  }

  const startTime = performance.now();

  const comboColours = ['0,202,0', '18,124,255', '242,24,57', '255,192,0'];

  const animate = (currentTime) => {
    const time = currentTime - startTime + previewTime;

    let comboNumber = 0;
    let comboCount = 1;

    ctx.clearRect(-64, -48, canvasElement.width, canvasElement.height);

    for (let i = 0; i < hitObjects.length; i += 1) {
      const object = hitObjects[i];
      comboCount += 1;
      if (object.type & 0b100) { // New combo bit
        comboCount = 1;
        comboNumber = (comboNumber + 1) % comboColours.length;
      }
      object.comboCount = comboCount;
      object.comboNumber = comboNumber;
      if (object.type & 2) {
        const { ms_per_beat: beatDuration } = timingPoints.find(e => e.time <= object.time);
        const duration = object.data.distance / (100.0 * SV) * beatDuration;
        object.duration = duration;
        object.endTime = object.time + duration;
      } else {
        object.endTime = object.time;
      }

      if (object.type & 2) {
        // eslint-disable-next-line no-loop-func
        object.pathFn = (mapTime) => {
          let [x, y] = object.data.pos;
          if (object.data.type === 'L') {
            const [x2, y2] = object.data.points[0];
            const t = (mapTime - object.time) / object.duration;
            x = x * (1 - t) + x2 * t;
            y = y * (1 - t) + y2 * t;
          }
          return { x, y };
        };
      }
    }

    hitObjects
      .filter((circle) => {
        if (time < circle.time - preempt) return false;
        // is a spinner
        if (circle.type & 8) return false;
        if (time > circle.endTime + CIRCLE_HIT_DURATION) return false;
        return true;
      })
      .reverse()
      .forEach((circle) => {
        const size = Math.max(0, circle.time - time) / preempt;

        let opacity = Math.max(0, time - (circle.time - preempt)) / fadeIn;
        if (time > circle.endTime) {
          opacity = 1 - (time - circle.endTime) / CIRCLE_HIT_DURATION;
        }

        const [x, y] = circle.data.pos;

        if (circle.type & 2) {
          ctx.beginPath();
          if (circle.data.type === 'L') {
            ctx.moveTo(x, y);
            const [cx, cy] = circle.data.points[0];
            const dx = cx - x;
            const dy = cy - y;
            const length = Math.sqrt(dx * dx + dy * dy);
            const px = x + dx * circle.data.distance / length;
            const py = y + dy * circle.data.distance / length;
            ctx.lineTo(px, py);
          } else if (circle.data.type === 'B') {
            ctx.moveTo(x, y);
            let buffer = [[x, y]];
            for (let i = 0; i < circle.data.points.length; i += 1) {
              const cur = circle.data.points[i];
              const [cx, cy] = cur;
              const [px, py] = buffer[buffer.length - 1];
              if (cx === px && cy === py) {
                if (buffer.length === 1) {
                  ctx.lineTo(buffer[0][0], buffer[0][1]);
                } else if (buffer.length === 2) {
                  ctx.quadraticCurveTo(buffer[0][0], buffer[0][1], buffer[1][0], buffer[1][1]);
                } else if (buffer.length === 3) {
                  ctx.bezierCurveTo(
                    buffer[0][0], buffer[0][1],
                    buffer[1][0], buffer[1][1],
                    buffer[2][0], buffer[2][1],
                  );
                } else {
                  ctx.lineTo(px, py);
                }

                buffer = [[cx, cy]];
              } else {
                buffer.push([cx, cy]);
              }
            }
            const [px, py] = buffer[buffer.length - 1];
            if (buffer.length === 1) {
              ctx.lineTo(buffer[0][0], buffer[0][1]);
            } else if (buffer.length === 2) {
              ctx.quadraticCurveTo(buffer[0][0], buffer[0][1], buffer[1][0], buffer[1][1]);
            } else if (buffer.length === 3) {
              ctx.bezierCurveTo(
                buffer[0][0], buffer[0][1],
                buffer[1][0], buffer[1][1],
                buffer[2][0], buffer[2][1],
              );
            } else {
              ctx.lineTo(px, py);
            }
          } else if (circle.data.type === 'P') {
            const points = circle.data.points;
            // https://stackoverflow.com/q/4103405
            const A = { x, y };
            const B = { x: points[0][0], y: points[0][1] };
            const C = { x: points[1][0], y: points[1][1] };
            const yDeltaA = B.y - A.y;
            const xDeltaA = B.x - A.x;
            const yDeltaB = C.y - B.y;
            const xDeltaB = C.x - B.x;

            const aSlope = yDeltaA / xDeltaA;
            const bSlope = yDeltaB / xDeltaB;
            const centerX = (aSlope * bSlope * (A.y - C.y) + bSlope * (A.x + B.x)
              - aSlope * (B.x + C.x)) / (2 * (bSlope - aSlope));
            const centerY = -1 * (centerX - (A.x + B.x) / 2) / aSlope + (A.y + B.y) / 2;
            const radius = Math.sqrt((centerX - x) * (centerX - x) + (centerY - y) * (centerY - y));
            const angleA = Math.atan2(A.y - centerY, A.x - centerX);
            const angleC = Math.atan2(C.y - centerY, C.x - centerX);

            const clockwise = (xDeltaB * yDeltaA - xDeltaA * yDeltaB) < 0;
            const startAngle = angleC;
            const endAngle = angleA;

            ctx.arc(centerX, centerY, radius, startAngle, endAngle, clockwise);
          }
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.lineWidth = circleRadius * 2;
          ctx.strokeStyle = `rgba(255,255,255,${opacity})`;
          ctx.stroke();
          ctx.lineWidth = (circleRadius - CIRCLE_BORDER_WIDTH) * 2;
          ctx.strokeStyle = `rgba(${comboColours[circle.comboNumber]},${opacity})`;
          ctx.stroke();
        }

        ctx.lineWidth = CIRCLE_BORDER_WIDTH;
        ctx.strokeStyle = `rgba(255,255,255,${opacity})`;
        ctx.fillStyle = `rgba(${comboColours[circle.comboNumber]},${opacity})`;

        let scale = 1;

        if (time > circle.time && !(circle.type & 2)) {
          const t = (time - circle.time) / CIRCLE_HIT_DURATION;
          scale = 1 - t + t * CIRCLE_HIT_FACTOR;
        }

        if (time <= circle.time || !(circle.type & 2)) {
          const circleSize = (circleRadius - CIRCLE_BORDER_WIDTH / 2) * scale;
          ctx.beginPath();
          ctx.arc(x, y, circleSize, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.font = 'bold 36px sans-serif';
          ctx.textBaseline = 'middle';
          ctx.textAlign = 'center';
          ctx.fillStyle = `rgba(255,255,255,${opacity})`;
          ctx.fillText(circle.comboCount, x, y);
        }
        if (time <= circle.time) {
          ctx.lineWidth = APPROACH_CIRCLE_WIDTH;
          ctx.strokeStyle = `rgba(${comboColours[circle.comboNumber]},${opacity})`;
          ctx.beginPath();
          ctx.arc(x, y, circleRadius + size * APPROACH_CIRCLE_SIZE, 0, Math.PI * 2);
          ctx.stroke();
        }

        if (time >= circle.time && (circle.type & 2) && time <= circle.endTime) {
          const { x: px, y: py } = circle.pathFn(time);
          const outerSize = (circleRadius - CIRCLE_BORDER_WIDTH / 2) * scale;
          ctx.strokeStyle = `rgba(255,255,255,${opacity})`;
          ctx.lineWidth = CIRCLE_BORDER_WIDTH;
          ctx.beginPath();
          ctx.arc(px, py, outerSize, 0, Math.PI * 2);
          ctx.stroke();
          ctx.lineWidth = FOLLOW_CIRCLE_WIDTH;
          ctx.beginPath();
          ctx.arc(px, py, outerSize * FOLLOW_CIRCLE_FACTOR, 0, Math.PI * 2);
          ctx.stroke();
        }
      });
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
};

function displayError(error) {
  errorElement.innerText = error.message;
  containerElement.classList.toggle('error', true);
  containerElement.classList.toggle('preloading', false);
}

function onReady([, cover]) {
  // Display content since we're done loading all the stuff.
  containerElement.classList.toggle('preloading', false);

  // Set header background
  if (cover) {
    headerElement.style.backgroundImage = `url('${cover.src}')`;
  }

  // Set header text
  titleElement.innerText = cleanBeatmap.title;
  artistElement.innerText = cleanBeatmap.artist;
  difficultyNameElement.innerText = cleanBeatmap.version;
  playPreview();

  const audio = new Audio();
  audio.volume = 0.45;
  audio.src = `https://b.ppy.sh/preview/${pageInfo.beatmapSetId}.mp3`;
  audio.play();
}


const fetchBeatmapById = id =>
  fetch(`https://osu.ppy.sh/osu/${id}`, { credentials: 'include' })
    .then(res => res.text());

const getPageInfo = (url, tabId) => new Promise((resolve, reject) => {
  const info = {
    isOldSite: null,
    beatmapSetId: null,
    beatmapId: null,
  };

  const match = url.match(BEATMAP_URL_REGEX);
  info.isOldSite = match[2] !== 'beatmapsets';

  if (!info.isOldSite) {
    const beatmapId = match[4];

    if (!beatmapId) {
      throw new Error(UNSUPPORTED_GAMEMODE);
    }

    info.beatmapSetId = match[3];
    info.beatmapId = beatmapId.substr(5);

    resolve(info);
  } else {
    // Fetch data from the content script so we don't need to fetch the page
    // second time.
    chrome.tabs.sendMessage(tabId, { action: 'GET_BEATMAP_INFO' }, (response) => {
      if (response.status === 'ERROR') {
        reject(response.error);
      } else {
        const { beatmapId, beatmapSetId } = response;
        info.beatmapSetId = beatmapSetId;
        info.beatmapId = beatmapId;

        resolve(info);
      }
    });
  }
});

const attemptToFetchBeatmap = (id, attempts) => fetchBeatmapById(id)
  .catch((error) => {
    // Retry fetching until no attempts are left.
    if (attempts) return attemptToFetchBeatmap(id, attempts - 1);

    throw error;
  });

const processBeatmap = (rawBeatmap) => {
  const { map } = new ojsama.parser().feed(rawBeatmap);

  cleanBeatmap = map;

  previewTime = Number(rawBeatmap.split('PreviewTime:')[1].split('\n')[0]);

  chrome.extension.getBackgroundPage().console.log(cleanBeatmap);

  // Support old beatmaps
  cleanBeatmap.mode = Number(cleanBeatmap.mode || 0);

  if (cleanBeatmap.mode !== 0) {
    throw Error(UNSUPPORTED_GAMEMODE);
  }
};

const fetchBeatmapBackground = beatmapSetId =>
  new Promise((resolve) => {
    // Preload beatmap cover
    const cover = new Image();
    cover.src = `https://assets.ppy.sh/beatmaps/${beatmapSetId}/covers/cover@2x.jpg`;
    cover.onload = () => resolve(cover);
    cover.onerror = () => resolve();
    cover.onabort = () => resolve();
  });

if (__FIREFOX__) {
  containerElement.classList.toggle('firefox', true);
  document.documentElement.classList.toggle('firefox', true);
}

// Init the extension.
chrome.tabs.query({
  active: true, // Select active tabs
  lastFocusedWindow: true, // In the current window
}, ([tab]) => {
  const { url, id } = tab;
  getPageInfo(url, id).then((info) => {
    pageInfo = info;

    return Promise.all([
      attemptToFetchBeatmap(pageInfo.beatmapId, FETCH_ATTEMPTS)
        .then(processBeatmap),
      fetchBeatmapBackground(pageInfo.beatmapSetId),
    ]);
  })
    .then(onReady)
    .catch(displayError);
});
