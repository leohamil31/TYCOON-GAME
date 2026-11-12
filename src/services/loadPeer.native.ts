import type { PeerCtor } from './loadPeer';

export const loadPeer = async (): Promise<PeerCtor> => (await import('react-native-peer')).Peer;
