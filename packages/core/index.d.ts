// Type definitions for anytars.

export type StyleKey = 'chibi' | 'cel' | 'flat' | 'anime' | 'sticker';
export type Expression =
  | 'neutral' | 'happy' | 'laughing' | 'sincere' | 'sad' | 'crying' | 'surprised' | 'angry'
  | 'lol' | 'rofl' | 'smileTear' | 'wink' | 'upsideDown' | 'shrug' | 'heartEyes' | 'starStruck' | 'kiss' | 'sleepy';
export type Transform = 'zombie' | 'festive';
export type Variant = { expression?: Expression; transform?: Transform };
export type Hex = `#${string}`;

/** A person. Every field maps to a part of the drawing; see ENUMS for the allowed values. */
export interface Traits {
  skin: Hex;
  face: string;
  hair: { top: string; back: string; color: Hex; accent?: Hex };
  eyes: {
    shape: string; left: Hex; right: Hex; lashes?: 'none' | 'natural' | 'long';
    render?: 'auto' | 'detailed' | 'bean' | 'flatIris' | 'dot' | 'beanLid' | 'button';
    spacing?: number; y?: number; size?: number; tilt?: number;
  };
  brows: { type: string; color?: Hex; spacing?: number; y?: number; tilt?: number };
  nose: { type: string; y?: number; size?: number };
  mouth: { width: 'small' | 'medium' | 'wide'; lips: 'thin' | 'medium' | 'full'; y?: number; size?: number };
  facialHair?: string;
  facialHairColor?: Hex;
  beard?: { thickness?: number; length?: number };
  details?: Array<'freckles' | 'wrinkles' | 'mole' | 'vitiligo'>;
  glasses?: { type: string; frame?: Hex; lens?: Hex; lensAlpha?: number; y?: number };
  headwear?: { type: string; color?: Hex; accent?: Hex };
  cheeks?: { amount?: 'none' | 'light' | 'medium' | 'strong'; color?: Hex };
  shirt: Hex;
  bg: Hex;
}

export interface RenderOptions {
  /** 'avatar' (the avatar's bg colour), a hex colour, or 'none' (transparent). */
  background?: 'avatar' | 'none' | Hex;
  /** 'style' uses the style's default shape. */
  backgroundShape?: 'style' | 'circle' | 'rounded' | 'full' | 'none';
  /** Override the eye drawing for this render. */
  eyeMode?: 'detailed' | 'bean' | 'flatIris' | 'dot' | 'beanLid' | 'button';
}

/** Render a person as an SVG string (viewBox 0 0 200 200). */
export function render(traits: Traits, variant?: Variant, style?: StyleKey, options?: RenderOptions): string;
/** Encode a person as a short, URL-safe avatar code ("v1.…"). See CODE-FORMAT.md. */
export function encode(traits: Traits): string;
/** Decode an avatar code back into traits. */
export function decode(code: string): Traits;
export function variantLabel(variant: Variant): string;
export function getK(obj: object, path: string): unknown;
export function setK(obj: object, path: string, value: unknown): void;

/** Defaults applied to every render() call unless overridden by options. */
export const ANYTARS_CONFIG: Required<Pick<RenderOptions, 'background' | 'backgroundShape'>>;
export const STYLES: Record<StyleKey, { key: StyleKey; label: string; blurb: string; [k: string]: unknown }>;
export const ENUMS: {
  face: string[]; hairTop: string[]; hairBack: string[]; eyeShape: string[]; lashes: string[]; brows: string[];
  nose: string[]; mouthWidth: string[]; lips: string[]; facialHair: string[]; glasses: string[]; headwear: string[];
};
export const TUNE: Array<{ group: string; key: string; label: string; min: number; max: number; unit: number; late?: boolean }>;
export const EXPRESSIONS: Expression[];
export const VARIANTS: Variant[];
export const EXPR: Record<string, { label: string; [k: string]: unknown }>;
export const EYE_RENDER: string[];
export const EYE_RENDER_LABEL: Record<string, string>;
export const CHEEKS: string[];
export const BG_SHAPES: string[];
export const FACES: Record<string, unknown>;
export const HAIR_TOP: Record<string, unknown>;
export const HAIR_BACK: Record<string, unknown>;
export const EYES: Record<string, unknown>;
export const BROWS: Record<string, unknown>;
export const NOSES: Record<string, unknown>;
export const HEADWEAR: Record<string, unknown>;
