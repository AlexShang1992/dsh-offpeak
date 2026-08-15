/**
 * dsh-offpeak styles: a self-contained, dependency-free design system.
 *
 * Everything is scoped under `.dsh_offpeak_*` and reads the harness theme
 * tokens (`--dsw-alias-*`) with graceful fallbacks, so the surface follows
 * the active light/dark theme without a single literal color in components.
 * `adoptStyles` injects one `<style>` element, idempotently.
 */

const CSS = `
/*
 * The token root. Every component root element carries dsh_offpeak_theme:
 * these locals are the only place the harness tokens (and their fallbacks)
 * are read, so nothing below an unthemed root resolves a color at all.
 */
.dsh_offpeak_theme {
  /*
   * Local semantic tokens over the harness alias scale, with fallbacks for a
   * deployment that does not ship it. The names must match the harness scale
   * exactly — an alias that does not exist silently takes the fallback, which
   * looks correct in the light theme and inverts in the dark one.
   */
  --dsh-offpeak-bg: var(--dsw-alias-bg-layer-1, #ffffff);
  --dsh-offpeak-bg-raised: var(--dsw-alias-bg-module-platform, #f4f5f7);
  --dsh-offpeak-text: var(--dsw-alias-label-primary, #1f2329);
  /* -secondary/-tertiary carry readable contrast; -dimmed is the ghost end. */
  --dsh-offpeak-text-dim: var(--dsw-alias-label-secondary, #646a73);
  --dsh-offpeak-text-caption: var(--dsw-alias-label-tertiary, #8a919c);
  --dsh-offpeak-border: var(--dsw-alias-border-l2, rgba(31, 35, 41, 0.12));
  --dsh-offpeak-accent: var(--dsw-alias-button-info-fill, #4d6bfe);
  --dsh-offpeak-shadow: 0 8px 32px rgba(15, 23, 42, 0.14);
}

/* ------------------------------ Status pill ------------------------------ */

.dsh_offpeak_pill {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  color: var(--dsh-offpeak-text);
  background: var(--dsh-offpeak-bg);
  border: 1px solid var(--dsh-offpeak-border);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
  cursor: default;
  user-select: none;
  transition: box-shadow 0.2s ease, transform 0.2s ease, border-color 0.2s ease;
  isolation: isolate;
}

.dsh_offpeak_pill::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(120deg,
    rgba(74, 222, 128, 0.55), rgba(45, 212, 191, 0.5), rgba(96, 165, 250, 0.55),
    rgba(74, 222, 128, 0.55));
  background-size: 220% 220%;
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask-composite: exclude;
  opacity: 0;
  animation: dsh-offpeak-border-slide 6s linear infinite;
  transition: opacity 0.3s ease;
  pointer-events: none;
  z-index: -1;
}

.dsh_offpeak_pill[data-window='peak']::before {
  background: linear-gradient(120deg,
    rgba(251, 191, 36, 0.7), rgba(249, 115, 22, 0.65), rgba(236, 72, 153, 0.5),
    rgba(251, 191, 36, 0.7));
}

.dsh_offpeak_pill:hover,
.dsh_offpeak_pill:focus-within {
  transform: translateY(-1px);
  box-shadow: var(--dsh-offpeak-shadow);
}

.dsh_offpeak_pill:hover::before,
.dsh_offpeak_pill:focus-within::before {
  opacity: 1;
}

@keyframes dsh-offpeak-border-slide {
  from { background-position: 0% 50%; }
  to { background-position: 220% 50%; }
}

.dsh_offpeak_pillIcon {
  width: 14px;
  height: 14px;
  flex: none;
  color: #4ade80;
  filter: drop-shadow(0 0 4px rgba(74, 222, 128, 0.55));
  transition: color 0.3s ease, filter 0.3s ease;
}

.dsh_offpeak_pill[data-window='peak'] .dsh_offpeak_pillIcon {
  color: #fbbf24;
  filter: drop-shadow(0 0 4px rgba(251, 191, 36, 0.6));
}

.dsh_offpeak_pillLabel {
  font-weight: 600;
  letter-spacing: 0.02em;
}

.dsh_offpeak_pillMultiplier {
  padding: 2px 6px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  color: #052e16;
  background: rgba(74, 222, 128, 0.18);
  border: 1px solid rgba(74, 222, 128, 0.35);
  font-variant-numeric: tabular-nums;
}

.dsh_offpeak_pill[data-window='peak'] .dsh_offpeak_pillMultiplier {
  color: #451a03;
  background: rgba(251, 191, 36, 0.2);
  border-color: rgba(251, 191, 36, 0.45);
}

.dsh_offpeak_pillCountdown {
  font-variant-numeric: tabular-nums;
  color: var(--dsh-offpeak-text-dim);
}

/* Live pulse dot. */

.dsh_offpeak_pulse {
  position: relative;
  display: inline-flex;
  width: 7px;
  height: 7px;
}

.dsh_offpeak_pulseCore {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: #4ade80;
}

.dsh_offpeak_pill[data-window='peak'] .dsh_offpeak_pulseCore {
  background: #fbbf24;
}

.dsh_offpeak_pulseRing {
  position: absolute;
  inset: -3px;
  border-radius: 50%;
  border: 1px solid currentColor;
  opacity: 0.5;
  animation: dsh-offpeak-pulse 2.2s ease-out infinite;
}

.dsh_offpeak_pulse {
  color: #4ade80;
}

.dsh_offpeak_pill[data-window='peak'] .dsh_offpeak_pulse {
  color: #fbbf24;
}

@keyframes dsh-offpeak-pulse {
  0% { transform: scale(0.5); opacity: 0.6; }
  70% { transform: scale(1.6); opacity: 0; }
  100% { transform: scale(1.6); opacity: 0; }
}

/* -------------------------------- Tooltip -------------------------------- */

.dsh_offpeak_tooltip {
  position: absolute;
  bottom: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%) translateY(4px);
  width: max-content;
  max-width: 320px;
  min-width: 240px;
  padding: 12px 14px;
  border-radius: 14px;
  /*
   * Nearly opaque on purpose: the blur below is a progressive enhancement
   * that a browser may report as supported and still not composite (and that
   * a reduced-transparency setting drops), so the panel has to stay readable
   * over conversation text on its background colour alone.
   */
  background: color-mix(in srgb, var(--dsh-offpeak-bg) 97%, transparent);
  -webkit-backdrop-filter: blur(16px) saturate(1.4);
  backdrop-filter: blur(16px) saturate(1.4);
  border: 1px solid var(--dsh-offpeak-border);
  box-shadow: var(--dsh-offpeak-shadow);
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.18s ease, transform 0.18s ease, visibility 0.18s;
  z-index: 40;
  pointer-events: none;
}

.dsh_offpeak_pill:hover .dsh_offpeak_tooltip,
.dsh_offpeak_pill:focus-within .dsh_offpeak_tooltip {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(0);
  pointer-events: auto;
}

.dsh_offpeak_tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: var(--dsh-offpeak-border);
}

.dsh_offpeak_tooltipTitle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 700;
}

.dsh_offpeak_tooltipSwitch {
  font-size: 11px;
  font-weight: 500;
  color: var(--dsh-offpeak-text-dim);
}

.dsh_offpeak_tooltipRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 3px 0;
  font-size: 11.5px;
}

.dsh_offpeak_tooltipRow + .dsh_offpeak_tooltipRow {
  border-top: 1px dashed var(--dsh-offpeak-border);
  margin-top: 3px;
  padding-top: 5px;
}

.dsh_offpeak_tooltipLabel {
  color: var(--dsh-offpeak-text-dim);
}

.dsh_offpeak_tooltipValue {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.dsh_offpeak_tooltipZone {
  margin-left: 5px;
  font-weight: 500;
  color: var(--dsh-offpeak-text-caption);
}

.dsh_offpeak_tooltipDivider {
  height: 1px;
  margin: 8px 0;
  background: var(--dsh-offpeak-border);
}

/* ----------------------------- Settings section --------------------------- */

.dsh_offpeak_section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  color: var(--dsh-offpeak-text);
  /* The section sits on the settings dialog's own surface, not on a layer. */
  --dsh-offpeak-bg: var(--dsw-alias-bg-base, #ffffff);
}

.dsh_offpeak_sectionTitle {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}

.dsh_offpeak_sectionSubtitle {
  margin: 4px 0 0;
  font-size: 12.5px;
  color: var(--dsh-offpeak-text-dim);
}

.dsh_offpeak_card {
  padding: 16px;
  border-radius: 14px;
  background: var(--dsh-offpeak-bg);
  border: 1px solid var(--dsh-offpeak-border);
}

.dsh_offpeak_cardTitle {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin: 0 0 4px;
  font-size: 13.5px;
  font-weight: 700;
}

.dsh_offpeak_cardDesc {
  margin: 0 0 12px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--dsh-offpeak-text-dim);
}

/* Toggle switch. */

.dsh_offpeak_toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--dsh-offpeak-bg-raised);
  border: 1px solid var(--dsh-offpeak-border);
  cursor: pointer;
}

.dsh_offpeak_toggle + .dsh_offpeak_toggle {
  margin-top: 8px;
}

.dsh_offpeak_toggleText {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dsh_offpeak_toggleLabel {
  font-size: 12.5px;
  font-weight: 600;
}

.dsh_offpeak_toggleDesc {
  font-size: 11.5px;
  color: var(--dsh-offpeak-text-dim);
}

.dsh_offpeak_switch {
  position: relative;
  flex: none;
  width: 34px;
  height: 20px;
  border-radius: 999px;
  background: var(--dsh-offpeak-text-caption);
  opacity: 0.55;
  transition: background 0.2s ease, opacity 0.2s ease;
}

.dsh_offpeak_switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  transition: transform 0.2s ease;
}

.dsh_offpeak_toggle input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.dsh_offpeak_toggle input:checked + .dsh_offpeak_switch {
  background: var(--dsh-offpeak-accent, #4d6bfe);
  opacity: 1;
}

.dsh_offpeak_toggle input:checked + .dsh_offpeak_switch::after {
  transform: translateX(14px);
}

.dsh_offpeak_toggle input:focus-visible + .dsh_offpeak_switch {
  outline: 2px solid var(--dsh-offpeak-accent, #4d6bfe);
  outline-offset: 2px;
}

/* Form grid. */

.dsh_offpeak_form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
}

.dsh_offpeak_field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.dsh_offpeak_fieldLabel {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--dsh-offpeak-text-dim);
}

.dsh_offpeak_fieldHint {
  font-size: 10.5px;
  color: var(--dsh-offpeak-text-caption);
}

.dsh_offpeak_input,
.dsh_offpeak_select {
  width: 100%;
  height: 30px;
  padding: 0 9px;
  border-radius: 8px;
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
  color: var(--dsh-offpeak-text);
  background: var(--dsh-offpeak-bg-raised);
  border: 1px solid var(--dsh-offpeak-border);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.dsh_offpeak_input:focus,
.dsh_offpeak_select:focus {
  outline: none;
  border-color: var(--dsh-offpeak-accent, #4d6bfe);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsh-offpeak-accent, #4d6bfe) 18%, transparent);
}

/* Save indicator. */

.dsh_offpeak_saveState {
  font-size: 11px;
  color: var(--dsh-offpeak-text-caption);
  font-variant-numeric: tabular-nums;
}

/* Reduced motion. */

@media (prefers-reduced-motion: reduce) {
  .dsh_offpeak_pill::before,
  .dsh_offpeak_pulseRing {
    animation: none;
  }
  .dsh_offpeak_pill,
  .dsh_offpeak_tooltip,
  .dsh_offpeak_switch,
  .dsh_offpeak_switch::after {
    transition: none;
  }
}
`

/** The id of the single injected `<style>` element. */
export const OFFPEAK_STYLE_ID = 'dsh-offpeak-styles'

/** The plugin stylesheet source (exposed so tests can assert its contract). */
export function offpeakStyles(): string {
  return CSS
}

/** Inject the plugin stylesheet exactly once. */
export function adoptStyles(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(OFFPEAK_STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = OFFPEAK_STYLE_ID
  style.textContent = CSS
  document.head.appendChild(style)
}
