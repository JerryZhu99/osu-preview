const CIRCLE_BORDER_WIDTH = 5;
const CIRCLE_HIT_FACTOR = 1.33;
const CIRCLE_HIT_DURATION = 150;
const APPROACH_CIRCLE_WIDTH = 3;
const APPROACH_CIRCLE_SIZE = 100;
const FOLLOW_CIRCLE_FACTOR = 2;
const FOLLOW_CIRCLE_WIDTH = 3;
const COMBO_COLOURS = ['0,202,0', '18,124,255', '242,24,57', '255,192,0'];


const processTimingPoints = (timingPoints) => {
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
};

const calculatePreempt = AR => (
  AR <= 5 ?
    1200 + 600 * (5 - AR) / 5 :
    1200 - 750 * (AR - 5) / 5);

const calculateFadeIn = AR => (
  AR <= 5 ?
    800 + 400 * (5 - AR) / 5 :
    800 - 500 * (AR - 5) / 5);

const processHitObjects = (hitObjects, timingPoints, SV) => {
  let comboNumber = 0;
  let comboCount = 1;
  for (let i = 0; i < hitObjects.length; i += 1) {
    const object = hitObjects[i];
    comboCount += 1;
    if (object.type & 0b100) { // New combo bit
      comboCount = 1;
      comboNumber = (comboNumber + 1) % COMBO_COLOURS.length;
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
          const [cx, cy] = object.data.points[0];
          const dx = cx - x;
          const dy = cy - y;
          const length = Math.sqrt(dx * dx + dy * dy);
          const x2 = x + dx * object.data.distance / length;
          const y2 = y + dy * object.data.distance / length;
          const t = (mapTime - object.time) / object.duration;
          x = x * (1 - t) + x2 * t;
          y = y * (1 - t) + y2 * t;
        }
        return { x, y };
      };
    }
  }
};

const sliderStroke = (ctx, circleRadius, colour, opacity) => {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = circleRadius * 2;
  ctx.strokeStyle = `rgba(255,255,255,${opacity})`;
  ctx.stroke();
  ctx.lineWidth = (circleRadius - CIRCLE_BORDER_WIDTH) * 2;
  ctx.strokeStyle = `rgba(${colour},${opacity})`;
  ctx.stroke();
};

const drawLinearSlider = (ctx, circle) => {
  const [x, y] = circle.data.pos;
  const [cx, cy] = circle.data.points[0];
  const dx = cx - x;
  const dy = cy - y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const px = x + dx * circle.data.distance / length;
  const py = y + dy * circle.data.distance / length;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(px, py);
};

const drawBezierSlider = (ctx, circle) => {
  const [x, y] = circle.data.pos;
  ctx.beginPath();
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
};

const drawPerfectSlider = (ctx, circle) => {
  const [x, y] = circle.data.pos;
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

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, startAngle, endAngle, clockwise);
};

const playPreview = (canvasElement, beatmap, previewTime) => {
  const ctx = canvasElement.getContext('2d');
  ctx.translate(64, 48);
  const timingPoints = beatmap.timing_points;
  processTimingPoints(timingPoints);

  const hitObjects = beatmap.objects;

  const { ar: AR, cs: CS, sv: SV } = beatmap;

  const circleRadius = 32 * (1 - 0.7 * (CS - 5) / 5);

  const preempt = calculatePreempt(AR);
  const fadeIn = calculateFadeIn(AR);

  processHitObjects(hitObjects, timingPoints, SV);

  const startTime = performance.now();

  const animate = (currentTime) => {
    const time = currentTime - startTime + previewTime;

    ctx.clearRect(-64, -48, canvasElement.width, canvasElement.height);

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

        if (circle.type & 2) {
          if (circle.data.type === 'L') {
            drawLinearSlider(ctx, circle);
          } else if (circle.data.type === 'B') {
            drawBezierSlider(ctx, circle);
          } else if (circle.data.type === 'P') {
            drawPerfectSlider(ctx, circle);
          }
          sliderStroke(ctx, circleRadius, COMBO_COLOURS[circle.comboNumber], opacity);
        }

        ctx.lineWidth = CIRCLE_BORDER_WIDTH;
        ctx.strokeStyle = `rgba(255,255,255,${opacity})`;
        ctx.fillStyle = `rgba(${COMBO_COLOURS[circle.comboNumber]},${opacity})`;

        let scale = 1;

        if (time > circle.time && !(circle.type & 2)) {
          const t = (time - circle.time) / CIRCLE_HIT_DURATION;
          scale = 1 - t + t * CIRCLE_HIT_FACTOR;
        }

        const [x, y] = circle.data.pos;

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
          ctx.strokeStyle = `rgba(${COMBO_COLOURS[circle.comboNumber]},${opacity})`;
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

export default {
  playPreview,
};
