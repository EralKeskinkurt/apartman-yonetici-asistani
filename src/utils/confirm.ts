import { Alert, Platform } from 'react-native';

export function showConfirm(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
  } else {
    Alert.alert(title, message, [
      { text: 'İptal', style: 'cancel' },
      { text: 'Onayla', style: 'destructive', onPress: onConfirm },
    ]);
  }
}
