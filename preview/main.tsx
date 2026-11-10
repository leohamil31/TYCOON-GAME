import React from 'react';
import { AppRegistry } from 'react-native';
import App from '../App';

(globalThis as any).__DEV__ = true;
AppRegistry.registerComponent('App', () => App);
AppRegistry.runApplication('App', { rootTag: document.getElementById('root') });
