const statusBadge = document.getElementById('status-badge')!;
const titleEl = document.getElementById('title')!;
const msgEl = document.getElementById('message')!;
const grantBtn = document.getElementById('grant-btn') as HTMLButtonElement;
const errorBox = document.getElementById('error-box')!;

async function requestMic() {
  errorBox.style.display = 'none';
  grantBtn.disabled = true;
  grantBtn.textContent = 'Requesting access...';

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());

    statusBadge.textContent = 'Ready';
    titleEl.textContent = 'Microphone Enabled!';
    msgEl.textContent = 'Voice commands and Live Conversation are now ready inside your Recare Side Panel. Returning automatically...';
    grantBtn.style.display = 'none';

    try {
      await chrome.runtime?.sendMessage({ type: 'MIC_PERMISSION_GRANTED' });
    } catch {}

    setTimeout(() => {
      window.close();
    }, 1200);
  } catch (err: any) {
    grantBtn.disabled = false;
    grantBtn.textContent = 'Try Allow Microphone Again';
    errorBox.style.display = 'block';
    errorBox.textContent =
      `Permission was not granted (${err?.name || 'Blocked'}). Please click the site tune/lock icon at the left of the address bar above, allow Microphone, then click Try Again.`;
  }
}

grantBtn.addEventListener('click', requestMic);
requestMic();
