import { isHold } from './utils'

const LANE_WIDTH = 30;
const NOTE_HEIGHT = 15;

const JUDGE_LINE_HEIGHT = 5;

const NOTE_SPEED = 0.75;
const HIT_POSITION = 384 - 50;

const X_CENTER = 512 / 2;

const LANE_SPACING = 1;

const COLOUR_1 = '#ffffff';
const COLOUR_2 = '#dc8dba';
const COLOUR_S = '#d5bc00';

const LANE_COLOURS = [
  [],
  [COLOUR_S],
  [COLOUR_1, COLOUR_1],
  [COLOUR_1, COLOUR_S, COLOUR_1],
  [COLOUR_1, COLOUR_2, COLOUR_2, COLOUR_1],
  [COLOUR_1, COLOUR_2, COLOUR_S, COLOUR_2, COLOUR_1],
  [COLOUR_1, COLOUR_2, COLOUR_1, COLOUR_1, COLOUR_2, COLOUR_1],
  [COLOUR_1, COLOUR_2, COLOUR_1, COLOUR_S, COLOUR_1, COLOUR_2, COLOUR_1],
  [COLOUR_S, COLOUR_1, COLOUR_2, COLOUR_1, COLOUR_S, COLOUR_1, COLOUR_2, COLOUR_1],
  [COLOUR_1, COLOUR_2, COLOUR_1, COLOUR_2, COLOUR_S, COLOUR_2, COLOUR_1, COLOUR_2, COLOUR_1],
  // Co-op
  [COLOUR_1, COLOUR_2, COLOUR_S, COLOUR_2, COLOUR_1, 
   COLOUR_1, COLOUR_2, COLOUR_S, COLOUR_2, COLOUR_1],
  [],
  [COLOUR_1, COLOUR_2, COLOUR_1, COLOUR_1, COLOUR_2, COLOUR_1, 
   COLOUR_1, COLOUR_2, COLOUR_1, COLOUR_1, COLOUR_2, COLOUR_1],
  [],
  [COLOUR_1, COLOUR_2, COLOUR_1, COLOUR_S, COLOUR_1, COLOUR_2, COLOUR_1,
   COLOUR_1, COLOUR_2, COLOUR_1, COLOUR_S, COLOUR_1, COLOUR_2, COLOUR_1],
  [],
  [COLOUR_S, COLOUR_1, COLOUR_2, COLOUR_1, COLOUR_S, COLOUR_1, COLOUR_2, COLOUR_1,
   COLOUR_1, COLOUR_2, COLOUR_1, COLOUR_S, COLOUR_1, COLOUR_2, COLOUR_1, COLOUR_S],
  [],
  [COLOUR_1, COLOUR_2, COLOUR_1, COLOUR_2, COLOUR_S, COLOUR_2, COLOUR_1, COLOUR_2, COLOUR_1,
   COLOUR_1, COLOUR_2, COLOUR_1, COLOUR_2, COLOUR_S, COLOUR_2, COLOUR_1, COLOUR_2, COLOUR_1],
]


const getMainBPM = (timingPoints, hitObjects) => {
    let bpms = new Map();
    timingPoints.filter(point => point.ms_per_beat > 0)
      .forEach((point, i, arr) => {
        let endTime = Infinity;
        if (i + 1 >= arr.length) {
          endTime = hitObjects.pop().time;
        } else {
          endTime = arr[i + 1].offset;
        }
        let duration = endTime - point.offset;
        if (!bpms.has(point.msPerBeat)) {
          bpms.set(point.msPerBeat, 0);
        }
        bpms.set(point.msPerBeat, bpms.get(point.msPerBeat) + duration);
      });
    let mainBpm = 60000 / [...bpms.entries()]
      .reduce(([mainMsPerBeat, maxCount], [msPerBeat, count]) => {
        return count > maxCount ? [msPerBeat, count] : [mainMsPerBeat, maxCount];
      }, [0, 0])[0];
    return mainBpm;
}


const getLane = (object, keyCount) => {
    const [x] = object.data.pos;
    return Math.floor(Number(x) * keyCount / 512);
}

const drawHoldNote = (ctx, object, keyCount, time) => {
    const lane = getLane(object, keyCount);
    
    const xOffset = (lane - keyCount / 2) * LANE_WIDTH + X_CENTER;
    const yOffset = HIT_POSITION - NOTE_SPEED * Math.max(0, (object.time - time)); 
    const height = NOTE_SPEED * (object.endTime - Math.max(time, object.time));

    if (yOffset < -NOTE_HEIGHT - 64) return;

    const colour = LANE_COLOURS[keyCount][lane] || COLOUR_1;
    ctx.fillStyle = `${colour}7f`
    ctx.fillRect(xOffset + LANE_SPACING, yOffset, LANE_WIDTH - 2 * LANE_SPACING, -height);
    ctx.fillStyle = colour;
    ctx.fillRect(xOffset + LANE_SPACING, yOffset, LANE_WIDTH - 2 * LANE_SPACING, -NOTE_HEIGHT);

}

const drawNote = (ctx, object, keyCount, time) => {
    
    const lane = getLane(object, keyCount);
    
    const xOffset = (lane - keyCount / 2) * LANE_WIDTH + X_CENTER;
    const yOffset = HIT_POSITION - NOTE_SPEED * (object.time - time); 

    if (yOffset < -NOTE_HEIGHT - 64) return;

    ctx.fillStyle = LANE_COLOURS[keyCount][lane] || COLOUR_1;
    ctx.fillRect(xOffset + LANE_SPACING, yOffset, LANE_WIDTH - 2 * LANE_SPACING, -NOTE_HEIGHT);
}

export default class ManiaRenderer {
    constructor(ctx, beatmap) {
        this.ctx = ctx;
        this.timingPoints = beatmap.timing_points;
        this.hitObjects = beatmap.objects;

        this.mainBPM = getMainBPM(this.timingPoints, this.hitObjects)
      
        const { cs: CS } = beatmap;
        this.keyCount = Number(CS);
    }

    render(time) {
        const { ctx, keyCount } = this;

        this.hitObjects
            .filter((object) => object.endTime > time)
            .forEach((object) => {
                if (isHold(object)) {
                    drawHoldNote(ctx, object, keyCount, time);
                } else {
                    drawNote(ctx, object, keyCount, time);
                }
            });

        const xOffset = X_CENTER - LANE_WIDTH * keyCount / 2;
        const yOffset = HIT_POSITION;
        ctx.fillStyle = 'white';
        ctx.fillRect(xOffset, yOffset, LANE_WIDTH * keyCount, JUDGE_LINE_HEIGHT);
    }
}