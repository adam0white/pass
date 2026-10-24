import { createLab } from '@adam0white/lab-client';
import { telemetryNotice } from '@adam0white/lab-kit';

export const lab = createLab({ game: 'pass' });

// Keep the SDK's once-per-origin receipt, but render its notice in the title footer.
let notice = telemetryNotice();
export function noticeFooter(): string {
  if (!notice) return '';
  notice = null;
  return '<p class="recording-notice">Recording links play across games on this device. You can turn it off in the menu.</p>';
}
