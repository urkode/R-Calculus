(() => {
  const urlBase64ToBytes = value => {
    const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    return Uint8Array.from(binary, character => character.charCodeAt(0));
  };

  const api = (path, options = {}) => fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  }).then(async response => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Kunne ikke oppdatere varsler.');
    return payload;
  });

  async function status() {
    return api('/api/push/status');
  }

  async function subscribe(info) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      throw new Error('Denne enheten støtter ikke app-varsler.');
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Du må tillate varsler på iPhone for å bruke dette.');
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBytes(info.publicKey)
      });
    }
    await api('/api/push/subscribe', { method: 'POST', body: JSON.stringify(subscription) });
  }

  async function unsubscribe() {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await api('/api/push/subscribe', { method: 'DELETE', body: JSON.stringify({ endpoint: subscription.endpoint }) });
      await subscription.unsubscribe();
    }
  }

  async function updateButton(button) {
    const info = await status();
    if (!info.allowed) { button.remove(); return; }
    if (!info.configured) {
      button.hidden = false;
      button.disabled = true;
      button.textContent = 'Varsler utilgjengelig';
      return;
    }
    const registration = await navigator.serviceWorker.ready;
    const browserSubscription = await registration.pushManager.getSubscription();
    if (browserSubscription && !info.subscribed) {
      await api('/api/push/subscribe', { method: 'POST', body: JSON.stringify(browserSubscription) });
      info.subscribed = true;
    }
    const subscribed = Boolean(browserSubscription && info.subscribed);
    button.hidden = false;
    button.disabled = false;
    button.classList.toggle('is-enabled', subscribed);
    button.textContent = subscribed ? 'Varsler på' : 'Slå på varsler';
    button.onclick = async () => {
      button.disabled = true;
      try {
        if (subscribed && !confirm('Vil du slå av varsler på denne enheten?')) return;
        if (subscribed) {
          await unsubscribe();
          globalThis.CloudData?.toast('Varsler er slått av.');
        } else {
          await subscribe(info);
          globalThis.CloudData?.toast('Varsler er slått på.');
        }
      } catch (error) {
        globalThis.CloudData?.toast(error.message || 'Kunne ikke sette opp varsler.', true);
      } finally {
        updateButton(button).catch(() => { button.disabled = false; });
      }
    };
  }

  function addButton() {
    const home = document.querySelector('.start-view');
    if (!home || home.querySelector('.push-toggle')) return;
    const button = document.createElement('button');
    button.className = 'push-toggle';
    button.type = 'button';
    button.hidden = true;
    button.textContent = 'Slå på varsler';
    home.append(button);
    updateButton(button).catch(() => button.remove());
  }

  new MutationObserver(addButton).observe(document.querySelector('#app'), { childList: true, subtree: true });
  addButton();
})();
