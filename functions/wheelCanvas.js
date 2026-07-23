const Canvas = require("canvas");
const GIFEncoder = require("gif-encoder-2");

const SIZE = 700;
const CENTER = SIZE / 2;
const RADIUS = 270;
const OUTER_RADIUS = 322;
const INNER_RADIUS = 78;

const generateWheelAnimation = (rewards, selectedIndex) => {
    const encoder = new GIFEncoder(SIZE, SIZE, "neuquant", true, 20);
    encoder.start();
    encoder.setRepeat(-1);
    encoder.setQuality(12);

    const geometry = getGeometry(rewards);
    const selected = geometry[selectedIndex];
    const targetRotation = Math.PI * 2 * 5 - Math.PI / 2 - (selected.start + selected.end) / 2;
    const frameCount = 38;
    for(let frame = 0; frame < frameCount; frame++){
        const progress = frame / (frameCount - 1);
        const eased = 1 - Math.pow(1 - progress, 4);
        const rotation = targetRotation * eased;
        const canvas = drawWheelFrame(rewards, geometry, rotation, selectedIndex, progress === 1);
        encoder.setDelay(frame < 25 ? 55 : 55 + (frame - 24) * 18);
        encoder.addFrame(canvas.getContext("2d"));
    }
    encoder.finish();
    return encoder.out.getData();
};

const drawWheelFrame = (rewards, geometry, rotation, selectedIndex, finished) => {
    const canvas = Canvas.createCanvas(SIZE, SIZE);
    const ctx = canvas.getContext("2d");
    const background = ctx.createRadialGradient(CENTER, CENTER, 40, CENTER, CENTER, 500);
    background.addColorStop(0, "#251234");
    background.addColorStop(0.7, "#100817");
    background.addColorStop(1, "#050307");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, SIZE, SIZE);

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.9)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 14;
    ctx.beginPath();
    ctx.arc(CENTER, CENTER, OUTER_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = "#4b1d08";
    ctx.fill();
    ctx.restore();

    drawGoldenRim(ctx);

    ctx.save();
    ctx.translate(CENTER, CENTER);
    ctx.rotate(rotation);
    geometry.forEach((segment, index) => {
        const middle = (segment.start + segment.end) / 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, RADIUS, segment.start, segment.end);
        ctx.closePath();
        const highlightX = Math.cos(middle) * RADIUS * 0.55;
        const highlightY = Math.sin(middle) * RADIUS * 0.55;
        const fill = ctx.createRadialGradient(highlightX - 28, highlightY - 35, 8, highlightX, highlightY, RADIUS * 0.92);
        fill.addColorStop(0, lighten(rewards[index].color, 44));
        fill.addColorStop(0.38, rewards[index].color);
        fill.addColorStop(1, darken(rewards[index].color, 45));
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = "#f6c45f";
        ctx.lineWidth = 5;
        ctx.stroke();

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, RADIUS - 9, segment.start + 0.015, segment.end - 0.015);
        ctx.closePath();
        ctx.clip();
        const shine = ctx.createLinearGradient(-RADIUS, -RADIUS, RADIUS, RADIUS);
        shine.addColorStop(0, "rgba(255,255,255,.24)");
        shine.addColorStop(0.4, "rgba(255,255,255,0)");
        shine.addColorStop(0.72, "rgba(0,0,0,0)");
        shine.addColorStop(1, "rgba(0,0,0,.24)");
        ctx.fillStyle = shine;
        ctx.fillRect(-RADIUS, -RADIUS, RADIUS * 2, RADIUS * 2);
        ctx.restore();

        ctx.save();
        ctx.rotate(middle);
        ctx.translate(RADIUS * 0.70, 0);
        if(Math.cos(middle) < 0) ctx.rotate(Math.PI);
        ctx.fillStyle = "#ffe778";
        ctx.font = "900 27px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "rgba(45,15,0,.95)";
        ctx.lineWidth = 8;
        ctx.shadowColor = "rgba(0,0,0,.85)";
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 4;
        const maxWidth = RADIUS * 0.62;
        ctx.strokeText(rewards[index].display, 0, 0, maxWidth);
        ctx.fillText(rewards[index].display, 0, 0, maxWidth);
        ctx.restore();
    });
    ctx.restore();

    drawCenterHub(ctx, finished);
    drawPointer(ctx);
    return canvas;
};

const getGeometry = rewards => {
    // Le tirage reste pondéré dans questCore. Des cases régulières gardent tous
    // les lots lisibles sans modifier leurs probabilités réelles.
    const slice = Math.PI * 2 / rewards.length;
    return rewards.map((item, index) => ({ start: index * slice, end: (index + 1) * slice }));
};

const drawGoldenRim = ctx => {
    const rim = ctx.createRadialGradient(CENTER - 45, CENTER - 55, RADIUS, CENTER, CENTER, OUTER_RADIUS);
    rim.addColorStop(0, "#fff2a1");
    rim.addColorStop(0.18, "#c76d16");
    rim.addColorStop(0.48, "#ffe47a");
    rim.addColorStop(0.72, "#8d3c0b");
    rim.addColorStop(1, "#2b1005");
    ctx.beginPath();
    ctx.arc(CENTER, CENTER, OUTER_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = rim;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(CENTER, CENTER, RADIUS + 7, 0, Math.PI * 2);
    ctx.fillStyle = "#2b1107";
    ctx.fill();

    const bulbRadius = 300;
    for(let index = 0; index < 28; index++){
        const angle = Math.PI * 2 * index / 28;
        const x = CENTER + Math.cos(angle) * bulbRadius;
        const y = CENTER + Math.sin(angle) * bulbRadius;
        ctx.save();
        ctx.shadowColor = "#ffd45d";
        ctx.shadowBlur = 13;
        const bulb = ctx.createRadialGradient(x - 2, y - 3, 1, x, y, 9);
        bulb.addColorStop(0, "#ffffff");
        bulb.addColorStop(0.28, "#fffbd0");
        bulb.addColorStop(0.68, "#ffc331");
        bulb.addColorStop(1, "#9a4807");
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fillStyle = bulb;
        ctx.fill();
        ctx.restore();
    }
};

const drawCenterHub = (ctx, finished) => {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.9)";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(CENTER, CENTER, INNER_RADIUS + 18, 0, Math.PI * 2);
    const redRing = ctx.createRadialGradient(CENTER - 20, CENTER - 25, 5, CENTER, CENTER, INNER_RADIUS + 18);
    redRing.addColorStop(0, "#ff6157");
    redRing.addColorStop(0.5, "#b30d18");
    redRing.addColorStop(1, "#43040a");
    ctx.fillStyle = redRing;
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#f4b73f";
    ctx.stroke();
    ctx.restore();

    const hub = ctx.createRadialGradient(CENTER - 24, CENTER - 28, 4, CENTER, CENTER, INNER_RADIUS);
    hub.addColorStop(0, "#fffbd0");
    hub.addColorStop(0.18, "#ffd64b");
    hub.addColorStop(0.52, "#d78a09");
    hub.addColorStop(1, "#653007");
    ctx.beginPath();
    ctx.arc(CENTER, CENTER, INNER_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = hub;
    ctx.fill();
    ctx.strokeStyle = "#ffe477";
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = "#3a1604";
    ctx.font = "900 19px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(255,255,255,.6)";
    ctx.shadowBlur = 2;
    if(finished) ctx.fillText("GAGNÉ !", CENTER, CENTER);
};

const drawPointer = ctx => {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.9)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 5;
    ctx.beginPath();
    ctx.moveTo(CENTER, 92);
    ctx.lineTo(CENTER - 30, 17);
    ctx.lineTo(CENTER + 30, 17);
    ctx.closePath();
    const pointer = ctx.createLinearGradient(CENTER - 30, 17, CENTER + 30, 72);
    pointer.addColorStop(0, "#fff4a3");
    pointer.addColorStop(0.45, "#ffb726");
    pointer.addColorStop(1, "#9a3d08");
    ctx.fillStyle = pointer;
    ctx.fill();
    ctx.strokeStyle = "#5c2106";
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.restore();
};

const shiftColor = (hex, amount) => {
    const value = parseInt(hex.replace("#", ""), 16);
    const channel = shift => Math.max(0, Math.min(255, ((value >> shift) & 255) + amount));
    return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
};
const lighten = (hex, amount) => shiftColor(hex, amount);
const darken = (hex, amount) => shiftColor(hex, -amount);

module.exports = { generateWheelAnimation, drawWheelFrame, getGeometry };
