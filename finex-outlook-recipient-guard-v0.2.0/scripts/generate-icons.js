const fs = require("fs");
const zlib = require("zlib");

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const size = Buffer.alloc(4); size.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([size, name, data, crc]);
}

function writeIcon(size, output) {
  const stride = size * 4 + 1;
  const pixels = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y += 1) {
    pixels[y * stride] = 0;
    for (let x = 0; x < size; x += 1) {
      const offset = y * stride + 1 + x * 4;
      const border = x < size * 0.15 || x > size * 0.85 || y < size * 0.2 || y > size * 0.8;
      const check = x > size * 0.52 && y > size * 0.5 && Math.abs((y - size * 0.72) - (x - size * 0.62) * 0.75) < size * 0.06;
      const color = check ? [255, 255, 255] : border ? [15, 108, 189] : [255, 255, 255];
      pixels.set([...color, 255], offset);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const png = Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(pixels)), chunk("IEND", Buffer.alloc(0))]);
  fs.writeFileSync(output, png);
}

writeIcon(64, "assets/icon-64.png");
writeIcon(128, "assets/icon-128.png");
