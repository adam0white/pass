import { createLab } from '@adam0white/lab-client';
import { telemetryNotice } from '@adam0white/lab-kit';

export const lab = createLab({ game: 'pass' });

let mounted = false;
/** Keep the actual SDK node outside page replacements so its central receipt stays effective. */
export function mountNotice(): void {
  if (mounted) return;
  mounted = true;
  const notice = telemetryNotice();
  if (!notice) return;
  const footer = document.createElement('footer');
  footer.id = 'recording-footer';
  notice.querySelector('button')?.remove();
  Object.assign(notice.style, {
    background: 'transparent',
    color: 'inherit',
    border: '0',
    padding: '0',
    font: 'inherit',
  });
  footer.append(notice);
  document.body.append(footer);
  const resize = new ResizeObserver(() => {
    document.documentElement.style.setProperty(
      '--notice-height',
      `${footer.getBoundingClientRect().height}px`,
    );
  });
  resize.observe(footer);
}
