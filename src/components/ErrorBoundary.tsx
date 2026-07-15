import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={s.wrapper}>
          <Text style={s.title}>Bir şeyler yanlış gitti</Text>
          <Text style={s.subtitle}>{this.state.error?.message || 'Beklenmeyen bir hata oluştu'}</Text>
          <TouchableOpacity style={s.btn} onPress={this.handleReset}>
            <Text style={s.btnText}>Tekrar Dene</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const s = StyleSheet.create({
  wrapper: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: '#111827' },
  title: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { color: '#9CA3AF', fontSize: 14, textAlign: 'center', marginBottom: 24 },
  btn: { paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#3B82F6', borderRadius: 8 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
