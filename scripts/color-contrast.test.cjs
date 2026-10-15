const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Load the actual theme without starting a React Native application.
const source = fs.readFileSync(path.join(__dirname, '../src/constants/theme.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const themeExports = {};
vm.runInNewContext(compiled, {
  exports: themeExports,
  require: (name) => {
    assert.equal(name, 'react-native');
    return { Platform: { OS: 'android', Version: 36 } };
  },
});
const { Colors, CategoryColors, SurfaceColors, ControlOpacity } = themeExports;

function rgb(color) {
  const hex = color.slice(1);
  return hex.slice(0, 6).match(/../g).map((part) => parseInt(part, 16) / 255);
}
function luminance(channels) {
  const [r, g, b] = channels.map((c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(foreground, background) {
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
function composite(foreground, background, opacity) {
  return foreground.map((value, index) => value * opacity + background[index] * (1 - opacity));
}
let checks = 0;
function check(name, foreground, background, minimum, opacity = 1) {
  const actual = ratio(composite(rgb(foreground), rgb(background), opacity), rgb(background));
  assert.ok(actual >= minimum, `${name}: ${actual.toFixed(3)} < ${minimum}`);
  checks++;
  return actual;
}
const surfaces = [Colors.bgCard, Colors.bg, Colors.appBackground, Colors.accentLight,
  Colors.accentSoft, Colors.accentGlow, Colors.dangerLight, '#FEF3C7', '#FFF4D6', '#FFF7E6'];
for (const token of ['textMuted', 'placeholder', 'textSecondary', 'accentText', 'successText', 'warningText', 'dangerText']) {
  for (const surface of (token === 'textSecondary' ? surfaces.slice(0, 5) : surfaces)) {
    check(token, Colors[token], surface, 4.5);
    check(`${token} pressed`, Colors[token], surface, 4.5, ControlOpacity.pressed);
  }
}
for (const token of ['iconMuted', 'accentIcon', 'successIcon', 'warningIcon', 'dangerIcon']) {
  for (const surface of surfaces) check(token, Colors[token], surface, 3, ControlOpacity.pressed);
}
check('composer placeholder', Colors.composerPlaceholder, SurfaceColors.control, 4.5);
check('focused input', SurfaceColors.focusBorder, SurfaceColors.control, 3);
check('invalid input', SurfaceColors.errorBorder, SurfaceColors.control, 3);
for (const token of ['actionBackground', 'dangerActionBackground', 'warningActionBackground']) {
  for (const surface of surfaces) {
    // Whole-control opacity fades the filled background; white labels stay white
    // over white surroundings, the conservative case for these buttons.
    const background = composite(rgb(Colors[token]), rgb(surface), ControlOpacity.pressed);
    const foreground = composite(rgb(Colors.onAction), rgb(surface), ControlOpacity.pressed);
    assert.ok(ratio(foreground, background) >= 4.5, `${token} pressed on ${surface}`);
    check(token, Colors.onAction, Colors[token], 4.5);
  }
}
for (const category of Object.values(CategoryColors)) {
  if (category.text) check('category label', category.text, category.bg, 4.5, ControlOpacity.pressed);
  const alpha = parseInt(category.tint.slice(7, 9), 16) / 255;
  const background = composite(rgb(category.tint), rgb(Colors.bgCard), alpha);
  assert.ok(ratio(rgb(category.icon), background) >= 3, `category icon ${category.icon}`);
  checks++;
}
// Intentionally excluded: decorative foregrounds and non-interactive disabled
// states. Preserve their existing palette, along with all approved surfaces.
assert.equal(Colors.accent, '#00A878');
assert.equal(Colors.success, '#00A878');
assert.equal(Colors.warning, '#F59E0B');
assert.equal(Colors.danger, '#E05555');
assert.equal(Colors.accentDisabled, '#A9D9CA');
assert.equal(Colors.textDisabled, '#AAAAAA');
assert.equal(Colors.bg, '#F3FFF9');
assert.equal(Colors.appBackground, '#F8FCFA');
assert.equal(Colors.bgCard, '#FFFFFF');
console.log(`${checks} contrast checks passed (unrounded WCAG thresholds).`);
for (const [name, old, next, bg] of [
  ['muted / white', '#AAAAAA', Colors.textMuted, Colors.bgCard],
  ['composer placeholder / white', '#818C9C', Colors.composerPlaceholder, Colors.bgCard],
  ['green text / mint', Colors.accent, Colors.accentText, Colors.accentLight],
  ['white / green action', Colors.accent, Colors.actionBackground, Colors.onAction],
  ['warning / white', Colors.warning, Colors.warningText, Colors.bgCard],
  ['danger / white', Colors.danger, Colors.dangerText, Colors.bgCard],
]) console.log(`${name}: ${ratio(rgb(old), rgb(bg)).toFixed(2)} -> ${ratio(rgb(next), rgb(bg)).toFixed(2)}`);
