declare module "opentype.js" {
  export interface Path {
    toPathData(decimalPlaces?: number): string;
  }

  export interface Glyph {
    advanceWidth: number;
    getPath(x: number, y: number, fontSize: number): Path;
  }

  export interface Font {
    unitsPerEm: number;
    charToGlyph(text: string): Glyph;
    getPath(text: string, x: number, y: number, fontSize: number, options?: { kerning?: boolean }): Path;
  }

  export function parse(buffer: ArrayBuffer): Font;
}
