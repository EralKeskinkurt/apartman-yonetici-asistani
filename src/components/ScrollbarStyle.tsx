import React from 'react';
import { Platform } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

export default function ScrollbarStyle() {
  const { theme } = useTheme();
  const c = theme.colors;

  if (Platform.OS !== 'web') return null;

  const css = `
    ::-webkit-scrollbar {
      width: 5px;
      height: 5px;
    }
    ::-webkit-scrollbar-track {
      background: transparent;
    }
    ::-webkit-scrollbar-thumb {
      background: ${c.textMuted};
      border-radius: 10px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: ${c.textSecondary};
    }
    * {
      scrollbar-width: thin;
      scrollbar-color: ${c.textMuted} transparent;
    }
  `;

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
