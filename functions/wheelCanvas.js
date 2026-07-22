const Canvas = require("canvas");
const GIFEncoder = require("gif-encoder-2");

const SIZE = 620;
const CENTER = SIZE / 2;
const RADIUS = 250;

const generateWheelAnimation = (rewards, selectedIndex) => {
    const encoder = new GIFEncoder(SIZE, SIZE, "neuquant", true, 20);
    encoder.start();
    // Une seule rotation : le GIF reste ensuite sur l'image gagnante.
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
    const canvas = Canvas.createCanvas(SIZE, SIZE), ctx = canvas.getContext("2d");
    const background = ctx.createRadialGradient(CENTER, CENTER, 50, CENTER, CENTER, 430);
    background.addColorStop(0, "#2c1745"); background.addColorStop(1, "#09070f");
    ctx.fillStyle = background; ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.save(); ctx.translate(CENTER, CENTER); ctx.rotate(rotation);
    geometry.forEach((segment, index) => {
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, RADIUS, segment.start, segment.end); ctx.closePath();
        ctx.fillStyle = rewards[index].color; ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.72)"; ctx.lineWidth = 3; ctx.stroke();
        const middle = (segment.start + segment.end) / 2;
        ctx.save(); ctx.rotate(middle); ctx.translate(RADIUS * 0.62, 0);
        if(Math.cos(middle) < 0) ctx.rotate(Math.PI);
        ctx.fillStyle = "#ffffff"; ctx.font = "700 19px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.shadowColor = "rgba(0,0,0,.8)"; ctx.shadowBlur = 4;
        ctx.fillText(rewards[index].display, 0, 0, Math.max(74, RADIUS * (segment.end - segment.start) * 0.78));
        ctx.restore();
    });
    ctx.restore();

    ctx.beginPath(); ctx.arc(CENTER, CENTER, 65, 0, Math.PI * 2);
    ctx.fillStyle = finished ? rewards[selectedIndex].color : "#17121f"; ctx.fill();
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 8; ctx.stroke();
    ctx.fillStyle = "#ffffff"; ctx.font = "800 22px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(finished ? "GAGNÉ !" : "NEWGEN", CENTER, CENTER);

    ctx.beginPath(); ctx.moveTo(CENTER, 22); ctx.lineTo(CENTER - 28, 82); ctx.lineTo(CENTER + 28, 82); ctx.closePath();
    ctx.fillStyle = "#ffffff"; ctx.fill(); ctx.strokeStyle = "#ffb14c"; ctx.lineWidth = 5; ctx.stroke();
    return canvas;
};

const getGeometry = rewards => {
    const total = rewards.reduce((sum, item) => sum + item.weight, 0);
    let angle = 0;
    return rewards.map(item => {
        const start = angle;
        angle += Math.PI * 2 * item.weight / total;
        return { start, end: angle };
    });
};

module.exports = { generateWheelAnimation, drawWheelFrame, getGeometry };
