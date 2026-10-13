import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export interface ExportPdfOptions {
  filename: string;
  paperSize?: 'letter' | 'folio' | 'a4';
}

const PAPER_DIMENSIONS: Record<
  'letter' | 'folio' | 'a4',
  { width: number; height: number; format: string | [number, number] }
> = {
  letter: { width: 612, height: 792, format: 'letter' },
  folio: { width: 612, height: 936, format: [612, 936] },
  a4: { width: 595.28, height: 841.89, format: 'a4' },
};

let sharedCanvas: HTMLCanvasElement | null = null;
let sharedCtx: CanvasRenderingContext2D | null = null;

const COLOR_NAME_FALLBACKS: Record<string, string> = {
  slate900: '#0f172a',
  slate800: '#1e293b',
  slate700: '#334155',
  slate600: '#475569',
  slate500: '#64748b',
  slate400: '#94a3b8',
  slate300: '#cbd5e1',
  slate200: '#e2e8f0',
  slate100: '#f1f5f9',
  slate50: '#f8fafc',
  emerald700: '#047857',
  amber700: '#b45309',
  rose700: '#be123c',
  brand: '#0052b7',
};

/**
 * Converts modern CSS colors (oklch, lab, color-mix, etc.) to standard RGB/hex
 * using a shared 2D Canvas context or heuristic fallbacks so html2canvas never crashes.
 */
export function toStandardRgb(colorStr: string): string {
  if (!colorStr || typeof colorStr !== 'string') return '#000000';
  let trimmed = colorStr.trim();
  if (
    !trimmed ||
    trimmed === 'transparent' ||
    trimmed === 'inherit' ||
    trimmed === 'initial' ||
    trimmed === 'currentColor'
  ) {
    return trimmed;
  }

  // If already standard rgb/rgba/hex, return directly
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(trimmed)) return trimmed;
  if (/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+/i.test(trimmed)) return trimmed;

  // Resolve var(...) inside modern color expressions if present
  if (trimmed.includes('var(')) {
    trimmed = trimmed
      .replace(/var\([^,]+,\s*([^)]+)\)/g, '$1')
      .replace(/var\([^)]+\)/g, '1');
  }

  // Attempt browser 2D canvas translation via rasterized pixel buffer
  try {
    if (!sharedCanvas && typeof document !== 'undefined') {
      sharedCanvas = document.createElement('canvas');
      sharedCanvas.width = 1;
      sharedCanvas.height = 1;
      sharedCtx = sharedCanvas.getContext('2d', { willReadFrequently: true });
    }
    if (sharedCtx) {
      sharedCtx.clearRect(0, 0, 1, 1);
      sharedCtx.fillStyle = '#000000';
      sharedCtx.fillStyle = trimmed;
      sharedCtx.fillRect(0, 0, 1, 1);
      const pixel = sharedCtx.getImageData(0, 0, 1, 1).data;
      const r = pixel[0];
      const g = pixel[1];
      const b = pixel[2];
      const a = pixel[3] / 255;

      if (a === 1) {
        return `rgb(${r}, ${g}, ${b})`;
      } else if (a > 0) {
        return `rgba(${r}, ${g}, ${b}, ${Number(a.toFixed(3))})`;
      } else if (trimmed === 'transparent') {
        return 'transparent';
      }
    }
  } catch {
    // Fallback below
  }

  // Heuristic fallbacks for Tailwind v4 palette
  const lower = trimmed.toLowerCase();
  if (lower.includes('900')) return COLOR_NAME_FALLBACKS.slate900;
  if (lower.includes('800')) return COLOR_NAME_FALLBACKS.slate800;
  if (lower.includes('700')) {
    if (lower.includes('emerald') || lower.includes('green')) return COLOR_NAME_FALLBACKS.emerald700;
    if (lower.includes('amber') || lower.includes('yellow')) return COLOR_NAME_FALLBACKS.amber700;
    if (lower.includes('rose') || lower.includes('red')) return COLOR_NAME_FALLBACKS.rose700;
    return COLOR_NAME_FALLBACKS.slate700;
  }
  if (lower.includes('600')) return COLOR_NAME_FALLBACKS.slate600;
  if (lower.includes('500')) return COLOR_NAME_FALLBACKS.slate500;
  if (lower.includes('400')) return COLOR_NAME_FALLBACKS.slate400;
  if (lower.includes('300')) return COLOR_NAME_FALLBACKS.slate300;
  if (lower.includes('200')) return COLOR_NAME_FALLBACKS.slate200;
  if (lower.includes('50') || lower.includes('100')) return COLOR_NAME_FALLBACKS.slate50;

  return '#0f172a';
}

/**
 * Replaces any oklch(...), oklab(...), lab(...), lch(...) in a CSS string
 * with standard RGB equivalents. Handles single-level nested parentheses.
 */
export function replaceModernColorsInString(str: string): string {
  if (!str || typeof str !== 'string') return str;
  if (!/(?:oklch|oklab|lab|lch|color\()/i.test(str)) return str;

  return str.replace(
    /(?:oklch|oklab|lab|lch|color)\([^)]*(?:\([^)]*\)[^)]*)*\)/gi,
    (match) => toStandardRgb(match)
  );
}

/**
 * Creates a safe style proxy around a real CSSStyleDeclaration instance.
 * Avoids Web IDL brand check failures (like "TypeError: Illegal invocation")
 * by reading directly from target[prop] and binding functions.
 */
function createSafeStyleProxy(realStyle: CSSStyleDeclaration): CSSStyleDeclaration {
  return new Proxy(realStyle, {
    get(target, prop) {
      if (prop === 'getPropertyValue') {
        return (propName: string) => {
          const raw = target.getPropertyValue(propName);
          if (typeof raw === 'string' && /(?:oklch|oklab|lab|lch|color\()/i.test(raw)) {
            return replaceModernColorsInString(raw);
          }
          return raw;
        };
      }
      const val = (target as any)[prop];
      if (typeof val === 'function') {
        return val.bind(target);
      }
      if (typeof val === 'string' && /(?:oklch|oklab|lab|lch|color\()/i.test(val)) {
        return replaceModernColorsInString(val);
      }
      return val;
    },
  });
}

/**
 * Captures an HTML element matching the visual preview and exports/downloads it as a true PDF file.
 */
export const downloadElementAsPdf = async (
  element: HTMLElement,
  options: ExportPdfOptions
): Promise<void> => {
  const paperKey = options.paperSize || 'a4';
  const dim = PAPER_DIMENSIONS[paperKey] || PAPER_DIMENSIONS.a4;

  const originalHostGetComputedStyle = window.getComputedStyle;

  try {
    // 1. Temporarily patch host window.getComputedStyle during capture
    window.getComputedStyle = function (elt: Element, pseudoElt?: string | null) {
      const real = originalHostGetComputedStyle.call(window, elt, pseudoElt);
      return createSafeStyleProxy(real);
    };

    const targetWidth = Math.max(element.scrollWidth, element.offsetWidth, 820);

    const canvas = await html2canvas(element, {
      scale: 3, // 3x yields ~288 DPI crystal-clear print resolution
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: targetWidth,
      onclone: (clonedDoc, clonedEl) => {
        // 2. Patch cloned iframe's window.getComputedStyle as well
        const win = clonedDoc.defaultView || window;
        if (win) {
          const origIframeGetComputedStyle = win.getComputedStyle.bind(win);
          win.getComputedStyle = function (elt: Element, pseudoElt?: string | null) {
            const real = origIframeGetComputedStyle(elt, pseudoElt);
            return createSafeStyleProxy(real);
          };
        }

        // 3. Sanitize any modern oklch/lab colors inside all <style> tags and inline style attributes in clonedDoc
        try {
          const styleTags = clonedDoc.querySelectorAll('style');
          styleTags.forEach((styleEl) => {
            if (styleEl.textContent && /(?:oklch|oklab|lab|lch|color\()/i.test(styleEl.textContent)) {
              styleEl.textContent = replaceModernColorsInString(styleEl.textContent);
            }
          });

          const allEls = clonedDoc.querySelectorAll('*');
          allEls.forEach((el) => {
            const styleAttr = el.getAttribute('style');
            if (styleAttr && /(?:oklch|oklab|lab|lch|color\()/i.test(styleAttr)) {
              el.setAttribute('style', replaceModernColorsInString(styleAttr));
            }
          });
        } catch (e) {
          console.warn('Style sanitization warning:', e);
        }

        // 3b. Fix html2canvas text baseline drift caused by Tailwind preflight (img { display:block }).
        // html2canvas measures font baselines using an inline <img>; when it is block-level, every
        // text run is painted a few pixels lower than in the browser, so borders appear to cut through text.
        try {
          const fixStyle = clonedDoc.createElement('style');
          fixStyle.textContent = 'img { display: inline-block !important; }';
          clonedDoc.head.appendChild(fixStyle);
        } catch {
          // ignore
        }

        // 4. Locate target element and ensure clean print presentation
        const target = clonedEl || (clonedDoc.querySelector('[data-print-container]') as HTMLElement | null);

        if (target) {
          // Unconstrain all parent containers up to body so modal overflow/scroll does not clip the document
          let parent = target.parentElement;
          while (parent && parent !== clonedDoc.body) {
            parent.style.overflow = 'visible';
            parent.style.maxHeight = 'none';
            parent.style.height = 'auto';
            parent.style.transform = 'none';
            parent = parent.parentElement;
          }
          if (clonedDoc.body) {
            clonedDoc.body.style.overflow = 'visible';
            clonedDoc.body.style.maxHeight = 'none';
            clonedDoc.body.style.height = 'auto';
            clonedDoc.body.style.backgroundColor = '#ffffff';
            (clonedDoc.body.style as any).webkitFontSmoothing = 'antialiased';
          }
          if (clonedDoc.documentElement) {
            clonedDoc.documentElement.style.backgroundColor = '#ffffff';
          }

          target.style.boxShadow = 'none';
          target.style.transform = 'none';
          target.style.margin = '0 auto';
        }
      },
    });

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: dim.format,
    });

    // Compute aspect ratio & page height in canvas pixel terms
    const pageRatio = dim.width / dim.height;
    const pageCanvasHeight = Math.floor(canvas.width / pageRatio);

    // If fits nicely within a single page
    if (canvas.height <= pageCanvasHeight * 1.05) {
      // Use PNG for 100% lossless, razor-sharp typography without JPEG artifacts
      const imgData = canvas.toDataURL('image/png');
      // Preserve the preview's exact aspect ratio (never stretch/squash lines)
      let drawW = dim.width;
      let drawH = (canvas.height / canvas.width) * dim.width;
      if (drawH > dim.height) {
        drawH = dim.height;
        drawW = (canvas.width / canvas.height) * dim.height;
      }
      const offsetX = (dim.width - drawW) / 2;
      pdf.addImage(imgData, 'PNG', offsetX, 0, drawW, drawH, undefined, 'SLOW');
    } else {
      // Multi-page clean canvas slicing
      const numPages = Math.ceil(canvas.height / pageCanvasHeight);
      for (let i = 0; i < numPages; i++) {
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = pageCanvasHeight;

        const sliceCtx = sliceCanvas.getContext('2d');
        if (sliceCtx) {
          sliceCtx.fillStyle = '#ffffff';
          sliceCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);

          sliceCtx.drawImage(
            canvas,
            0,
            i * pageCanvasHeight,
            canvas.width,
            pageCanvasHeight,
            0,
            0,
            canvas.width,
            pageCanvasHeight
          );

          const sliceData = sliceCanvas.toDataURL('image/png');
          if (i > 0) {
            pdf.addPage(dim.format, 'portrait');
          }
          pdf.addImage(sliceData, 'PNG', 0, 0, dim.width, dim.height, undefined, 'SLOW');
        }
      }
    }

    // Automatically download the PDF file to the user's computer
    pdf.save(options.filename);
  } finally {
    // Always restore the host window's original getComputedStyle
    window.getComputedStyle = originalHostGetComputedStyle;
  }
};
