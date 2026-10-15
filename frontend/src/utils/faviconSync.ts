/**
 * Synchronizes the browser favicon with the system logo and theme color.
 * The favicon is always the adjusted version of ARALert_Logo_LIGHT.png.
 * If --brand in theme.css is modified to a custom hue, the favicon dynamically
 * updates on the fly to match the new brand color.
 */
let cachedImg: HTMLImageElement | null = null;

export const syncFaviconWithTheme = (): void => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const brandColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--brand')
    .trim();

  // If default brand color #0052B7, ensure static high-res favicons are bound
  if (!brandColor || brandColor.toLowerCase() === '#0052b7') {
    const iconLinks = document.querySelectorAll<HTMLLinkElement>(
      'link[rel="icon"], link[rel="apple-touch-icon"]'
    );
    iconLinks.forEach((link) => {
      const sizes = link.getAttribute('sizes');
      if (sizes === '512x512' && !link.href.endsWith('/favicon.png')) {
        link.href = '/favicon.png';
      } else if (sizes === '180x180' && !link.href.endsWith('/favicon-180.png')) {
        link.href = '/favicon-180.png';
      } else if (sizes === '32x32' && !link.href.endsWith('/favicon-32.png')) {
        link.href = '/favicon-32.png';
      } else if (sizes === '16x16' && !link.href.endsWith('/favicon-16.png')) {
        link.href = '/favicon-16.png';
      }
    });
    return;
  }

  // Dynamic recolor when a non-default --brand is active
  const updateDynamicFavicon = (img: HTMLImageElement) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, 0, 0, 64, 64);
      const imgData = ctx.getImageData(0, 0, 64, 64);
      const data = imgData.data;

      // Parse brand hex to RGB
      let hex = brandColor.replace('#', '');
      if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
      const targetR = parseInt(hex.substring(0, 2), 16) || 0;
      const targetG = parseInt(hex.substring(2, 4), 16) || 82;
      const targetB = parseInt(hex.substring(4, 6), 16) || 183;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        // Recolor non-white, non-transparent pixels (the logo's letter A)
        if (a > 30 && (r < 220 || g < 220 || b < 220)) {
          const factor = (r + g + b) / 265;
          data[i] = Math.min(255, Math.round(targetR * Math.max(0.7, factor)));
          data[i + 1] = Math.min(255, Math.round(targetG * Math.max(0.7, factor)));
          data[i + 2] = Math.min(255, Math.round(targetB * Math.max(0.7, factor)));
        }
      }

      ctx.putImageData(imgData, 0, 0);
      const dataUrl = canvas.toDataURL('image/png');

      const iconLinks = document.querySelectorAll<HTMLLinkElement>(
        'link[rel="icon"], link[rel="apple-touch-icon"]'
      );
      iconLinks.forEach((link) => {
        link.href = dataUrl;
      });
    } catch (err) {
      console.warn('Could not recolor favicon:', err);
    }
  };

  if (cachedImg) {
    updateDynamicFavicon(cachedImg);
  } else {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      cachedImg = img;
      updateDynamicFavicon(img);
    };
    img.src = '/favicon.png';
  }
};
