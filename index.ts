import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';

const originalWarn = console.warn;
console.warn = (...args: any[]) => {
  const msg = args[0] || '';
  if (
    typeof msg === 'string' &&
    (msg.includes('pointerEvents is deprecated') ||
     msg.includes('"shadow*" style props are deprecated') ||
     msg.includes('Blocked aria-hidden'))
  ) {
    return;
  }
  originalWarn.apply(console, args);
};

import App from './App';

registerRootComponent(App);
