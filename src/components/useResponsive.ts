import { useWindowDimensions } from 'react-native';

export function useResponsive() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  return {
    isDesktop,
    isTablet: width >= 480 && width < 768,
    isMobile: width < 480,
    width,
    contentMaxWidth: isDesktop ? 800 : width,
    scrollPadding: isDesktop ? 20 : 0,
  };
}
