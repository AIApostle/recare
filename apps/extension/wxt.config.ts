import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Recare — AI Browser Agent & Accessibility Assistant',
    description: 'AI-powered browser assistant to understand, navigate, and operate web applications.',
    version: '0.1.0',
    permissions: [
      'sidePanel',
      'storage',
      'activeTab',
      'scripting',
      'tabs',
      'audioCapture',
    ],
    action: {
      default_title: 'Open Recare Assistant',
      default_icon: {
        '16': 'icon-16.png',
        '32': 'icon-32.png',
        '48': 'icon-48.png',
        '128': 'icon-128.png',
      },
    },
    icons: {
      '16': 'icon-16.png',
      '32': 'icon-32.png',
      '48': 'icon-48.png',
      '128': 'icon-128.png',
    },
    side_panel: {
      default_path: 'sidepanel.html',
    },
    commands: {
      _execute_action: {
        suggested_key: {
          default: 'Ctrl+Shift+U',
          mac: 'Command+Shift+U',
        },
        description: 'Open Recare Assistant',
      },
    },
  },
});
