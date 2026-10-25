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
  // Pass has a 17px root. Keep the full disclosure on one line at normal phone size,
  // while allowing it to grow and wrap when the reader enlarges the root text.
  notice.style.fontSize = 'max(14px, 0.82rem)';
  notice.style.paddingInline = '0.45rem';
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
