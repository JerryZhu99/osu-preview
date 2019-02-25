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

const playPreview = () => {
  const ctx = canvasElement.getContext('2d');

  const hitObjects = cleanBeatmap.objects;

  const { ar: AR, cs: CS } = cleanBeatmap;

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

    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    for (let i = 0; i < hitObjects.length; i += 1) {
      const object = hitObjects[i];
      comboCount += 1;
      if (object.type & 0b100) { // New combo bit
        comboCount = 1;
        comboNumber = (comboNumber + 1) % comboColours.length;
      }
      object.comboCount = comboCount;
      object.comboNumber = comboNumber;
    }

    hitObjects
      .filter(e => (time >= e.time - preempt && time <= e.time + CIRCLE_HIT_DURATION))
      .reverse()
      .forEach((circle) => {
        const size = Math.max(0, circle.time - time) / preempt;

        let opacity = Math.max(0, time - (circle.time - preempt)) / fadeIn;

        if (time > circle.time) {
          opacity = 1 - (time - circle.time) / CIRCLE_HIT_DURATION;
        }

        const [circleX, circleY] = circle.data.pos;
        const x = circleX + 64;
        const y = circleY + 48;


        ctx.lineWidth = CIRCLE_BORDER_WIDTH;
        ctx.strokeStyle = `rgba(255,255,255,${opacity})`;
        ctx.fillStyle = `rgba(${comboColours[circle.comboNumber]},${opacity})`;

        let scale = 1;

        if (time > circle.time) {
          const t = (time - circle.time) / CIRCLE_HIT_DURATION;
          scale = 1 - t + t * CIRCLE_HIT_FACTOR;
        }

        const innerSize = (circleRadius - CIRCLE_BORDER_WIDTH) * scale;
        const outerSize = (circleRadius - CIRCLE_BORDER_WIDTH / 2) * scale;
        ctx.beginPath();
        ctx.arc(x, y, innerSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, outerSize, 0, Math.PI * 2);
        ctx.stroke();

        if (time <= circle.time) {
          ctx.lineWidth = APPROACH_CIRCLE_WIDTH;
          ctx.strokeStyle = `rgba(${comboColours[circle.comboNumber]},${opacity})`;
          ctx.beginPath();
          ctx.arc(x, y, circleRadius + size * APPROACH_CIRCLE_SIZE, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.font = 'bold 36px sans-serif';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillStyle = `rgba(255,255,255,${opacity})`;
        ctx.fillText(circle.comboCount, x, y);
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
