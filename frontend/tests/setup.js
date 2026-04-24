import '@testing-library/jest-dom/vitest';

function buildAnimatedLength(value) {
  return {
    baseVal: { value },
    animVal: { value }
  };
}

if (typeof SVGElement !== 'undefined') {
  if (!Object.getOwnPropertyDescriptor(SVGElement.prototype, 'width')) {
    Object.defineProperty(SVGElement.prototype, 'width', {
      configurable: true,
      get() {
        return buildAnimatedLength(1280);
      }
    });
  }

  if (!Object.getOwnPropertyDescriptor(SVGElement.prototype, 'height')) {
    Object.defineProperty(SVGElement.prototype, 'height', {
      configurable: true,
      get() {
        return buildAnimatedLength(720);
      }
    });
  }

  if (!SVGElement.prototype.getBBox) {
    SVGElement.prototype.getBBox = () => ({
      x: 0,
      y: 0,
      width: 1280,
      height: 720
    });
  }
}

if (typeof SVGSVGElement !== 'undefined' && !SVGSVGElement.prototype.createSVGPoint) {
  SVGSVGElement.prototype.createSVGPoint = () => ({
    x: 0,
    y: 0,
    matrixTransform() {
      return { x: this.x, y: this.y };
    }
  });
}
