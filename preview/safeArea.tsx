// Web-preview stand-in for react-native-safe-area-context (o navegador não tem notch/insets nativos).
import React from 'react';
import { View, type ViewProps } from 'react-native';

export const SafeAreaProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const SafeAreaView = ({ edges: _edges, ...props }: ViewProps & { edges?: string[] }) => <View {...props} />;
