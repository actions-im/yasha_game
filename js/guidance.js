/** Project a world target to a padded screen edge, including targets behind the camera. */
export function bossIndicator(pos, m, width, height) {
  const x = m[0]*pos.x + m[4]*pos.y + m[8]*pos.z + m[12];
  const y = m[1]*pos.x + m[5]*pos.y + m[9]*pos.z + m[13];
  const w = m[3]*pos.x + m[7]*pos.y + m[11]*pos.z + m[15];
  if (w > 0 && Math.abs(x/w) < 0.85 && Math.abs(y/w) < 0.75) return null;
  let dx = x * width / 2, dy = -y * height / 2;
  if (Math.abs(dx) + Math.abs(dy) < 0.001) dx = 1;
  const edgeX = Math.max(1, width/2 - 64);
  const edgeY = Math.max(1, height/2 - 140);
  const scale = 1 / Math.max(Math.abs(dx)/edgeX, Math.abs(dy)/edgeY);
  return { x: width/2 + dx*scale, y: height/2 + dy*scale,
    angle: Math.atan2(dy, dx), behind: w <= 0 };
}
