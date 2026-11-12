export type PeerCtor = typeof import('peerjs').Peer;

export const loadPeer = async (): Promise<PeerCtor> => (await import('peerjs')).Peer;
