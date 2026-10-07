export function systemBarIconStyle(hex: string): 'light' | 'dark' {
  const channels = hex.replace('#', '').match(/.{2}/g)!.map(channel => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  const darkContrast = (luminance + 0.05) / 0.05;
  const lightContrast = 1.05 / (luminance + 0.05);
  return darkContrast >= lightContrast ? 'dark' : 'light';
}

type Surfaces = { bg: string; appBackground: string; bottomSurface: string; accent: string };
export function getSystemBarSurfaces(pathname: string, colors: Surfaces) {
  if (pathname === '/') return { top: colors.accent, bottom: colors.accent };
  const introduction = /^\/(welcome|auth|login|register|onboarding(?:-.*)?|celebration)(\/|$)/.test(pathname);
  const tabs = /^\/(chat|tarefas|calendario|financeiro|apps)(\/|$)/.test(pathname);
  return { top: introduction ? colors.bg : colors.appBackground,
    bottom: tabs ? colors.bottomSurface : introduction ? colors.bg : colors.appBackground };
}
