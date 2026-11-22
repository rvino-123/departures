export const TUBE_COLORS: Record<string, string> = {
  bakerloo: '#B36305',
  central: '#E32017',
  circle: '#FFD300',
  district: '#00782A',
  'hammersmith-city': '#F3A9BB',
  jubilee: '#A0A5A9',
  metropolitan: '#9B0056',
  northern: '#000000',
  piccadilly: '#003688',
  victoria: '#0098D4',
  'waterloo-city': '#95CDBA',
  dlr: '#00A4A7',
};

/** Colours keyed by National Rail operator code. */
export const OPERATOR_COLORS: Record<string, string> = {
  XR: '#6950A1', // Elizabeth line
  LO: '#EE7C0E', // London Overground
  GW: '#0A493E', // GWR
  HX: '#532E63', // Heathrow Express
  TL: '#E9438D', // Thameslink
  GN: '#5C2D91', // Great Northern
  SN: '#8CC63E', // Southern
  SW: '#24398C', // South Western Railway
  SE: '#00AFE8', // Southeastern
  LE: '#D70428', // Greater Anglia
  C2: '#B7007C', // c2c
  CH: '#00BFFF', // Chiltern
  VT: '#004354', // Avanti
  LM: '#FF8300', // West Midlands
  GR: '#CE0E2D', // LNER
  EM: '#4F0F3B', // EMR
  XC: '#660F21', // CrossCountry
  TP: '#09A4EC', // TransPennine
  NT: '#262E5C', // Northern
};

export const DEFAULT_COLOR = '#5B6770';

/** Text colour that stays readable on a given tag background. */
export function textOn(bg: string): string {
  const hex = bg.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? '#111' : '#fff';
}
