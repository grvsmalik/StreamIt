// WebTorrent ships no types; torrent.ts uses a small structural surface via a
// dynamic import, so this just silences the implicit-any on the module itself.
declare module 'webtorrent' {
  const WebTorrent: new (opts?: object) => unknown
  export default WebTorrent
}
