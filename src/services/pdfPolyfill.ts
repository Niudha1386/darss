/**
 * Server-side polyfills for PDF processing in Node.js environments (Docker, Railway, etc.)
 *
 * Why this is needed:
 * `pdfjs-dist` (used internally by `pdf-parse`) relies on browser Web APIs
 * (DOMMatrix, ImageData, Path2D). In Node.js, it attempts to load `@napi-rs/canvas`.
 * When running in lightweight containers (like node:20-slim or Alpine), native bindings
 * fail to load, causing:
 *   "ReferenceError: DOMMatrix is not defined"
 * at module initialization time (`const SCALE_MATRIX = new DOMMatrix()`).
 *
 * Importing this polyfill before any `pdf-parse` or `pdfjs-dist` calls guarantees
 * that these globals exist and prevents the crash.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

class DOMMatrixPolyfill {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;

  m11 = 1;
  m12 = 0;
  m13 = 0;
  m14 = 0;
  m21 = 0;
  m22 = 1;
  m23 = 0;
  m24 = 0;
  m31 = 0;
  m32 = 0;
  m33 = 1;
  m34 = 0;
  m41 = 0;
  m42 = 0;
  m43 = 0;
  m44 = 1;

  is2D = true;
  isIdentity = true;

  constructor(init?: string | number[]) {
    if (Array.isArray(init)) {
      if (init.length === 6) {
        this.a = this.m11 = init[0];
        this.b = this.m12 = init[1];
        this.c = this.m21 = init[2];
        this.d = this.m22 = init[3];
        this.e = this.m41 = init[4];
        this.f = this.m42 = init[5];
      } else if (init.length === 16) {
        this.m11 = this.a = init[0];
        this.m12 = this.b = init[1];
        this.m13 = init[2];
        this.m14 = init[3];
        this.m21 = this.c = init[4];
        this.m22 = this.d = init[5];
        this.m23 = init[6];
        this.m24 = init[7];
        this.m31 = init[8];
        this.m32 = init[9];
        this.m33 = init[10];
        this.m34 = init[11];
        this.m41 = this.e = init[12];
        this.m42 = this.f = init[13];
        this.m43 = init[14];
        this.m44 = init[15];
        this.is2D = false;
      }
    }
  }

  multiply(_other?: any): this {
    return this;
  }
  preMultiplySelf(_other?: any): this {
    return this;
  }
  translate(_tx = 0, _ty = 0, _tz = 0): this {
    return this;
  }
  translateSelf(_tx = 0, _ty = 0, _tz = 0): this {
    return this;
  }
  scale(_scaleX = 1, _scaleY = _scaleX, _scaleZ = 1): this {
    return this;
  }
  scaleSelf(_scaleX = 1, _scaleY = _scaleX, _scaleZ = 1): this {
    return this;
  }
  scale3d(_scale = 1, _ox = 0, _oy = 0, _oz = 0): this {
    return this;
  }
  scale3dSelf(_scale = 1, _ox = 0, _oy = 0, _oz = 0): this {
    return this;
  }
  rotate(_rotX = 0, _rotY = 0, _rotZ = 0): this {
    return this;
  }
  rotateSelf(_rotX = 0, _rotY = 0, _rotZ = 0): this {
    return this;
  }
  rotateAxisAngle(_x = 0, _y = 0, _z = 0, _angle = 0): this {
    return this;
  }
  rotateAxisAngleSelf(_x = 0, _y = 0, _z = 0, _angle = 0): this {
    return this;
  }
  skewX(_sx = 0): this {
    return this;
  }
  skewXSelf(_sx = 0): this {
    return this;
  }
  skewY(_sy = 0): this {
    return this;
  }
  skewYSelf(_sy = 0): this {
    return this;
  }
  flipX(): this {
    return this;
  }
  flipY(): this {
    return this;
  }
  inverse(): this {
    return this;
  }
  invertSelf(): this {
    return this;
  }
  transformPoint(point?: any): any {
    return point || { x: 0, y: 0, z: 0, w: 1 };
  }
  toFloat32Array(): Float32Array {
    return new Float32Array([
      this.m11, this.m12, this.m13, this.m14,
      this.m21, this.m22, this.m23, this.m24,
      this.m31, this.m32, this.m33, this.m34,
      this.m41, this.m42, this.m43, this.m44,
    ]);
  }
  toFloat64Array(): Float64Array {
    return new Float64Array([
      this.m11, this.m12, this.m13, this.m14,
      this.m21, this.m22, this.m23, this.m24,
      this.m31, this.m32, this.m33, this.m34,
      this.m41, this.m42, this.m43, this.m44,
    ]);
  }
  toString(): string {
    return `matrix(${this.a}, ${this.b}, ${this.c}, ${this.d}, ${this.e}, ${this.f})`;
  }
}

class ImageDataPolyfill {
  width: number;
  height: number;
  data: Uint8ClampedArray;
  colorSpace: string = 'srgb';

  constructor(width: number, height: number);
  constructor(data: Uint8ClampedArray, width: number, height?: number);
  constructor(arg1: any, arg2?: any, arg3?: any) {
    if (typeof arg1 === 'number') {
      this.width = arg1;
      this.height = arg2 || 0;
      this.data = new Uint8ClampedArray(this.width * this.height * 4);
    } else {
      this.data = arg1;
      this.width = arg2;
      this.height = arg3 || (arg1 && arg2 ? Math.floor(arg1.length / (4 * arg2)) : 0);
    }
  }
}

class Path2DPolyfill {
  constructor(_path?: any) {}
  addPath(_path: any, _transform?: any) {}
  closePath() {}
  moveTo(_x: number, _y: number) {}
  lineTo(_x: number, _y: number) {}
  bezierCurveTo(_cp1x: number, _cp1y: number, _cp2x: number, _cp2y: number, _x: number, _y: number) {}
  quadraticCurveTo(_cpx: number, _cpy: number, _x: number, _y: number) {}
  arc(_x: number, _y: number, _radius: number, _startAngle: number, _endAngle: number, _counterclockwise?: boolean) {}
  arcTo(_x1: number, _y1: number, _x2: number, _y2: number, _radius: number) {}
  ellipse(_x: number, _y: number, _radiusX: number, _radiusY: number, _rotation: number, _startAngle: number, _endAngle: number, _counterclockwise?: boolean) {}
  rect(_x: number, _y: number, _w: number, _h: number) {}
}

const g = globalThis as any;

if (!g.DOMMatrix) {
  g.DOMMatrix = DOMMatrixPolyfill;
}
if (!g.DOMMatrixReadOnly) {
  g.DOMMatrixReadOnly = DOMMatrixPolyfill;
}
if (!g.ImageData) {
  g.ImageData = ImageDataPolyfill;
}
if (!g.Path2D) {
  g.Path2D = Path2DPolyfill;
}
if (!g.navigator) {
  g.navigator = {
    userAgent: 'Node.js',
    language: 'en-US',
    languages: ['en-US', 'en'],
    platform: process.platform || '',
  };
}

export { DOMMatrixPolyfill, ImageDataPolyfill, Path2DPolyfill };
