/** True inside the Capacitor iOS wrap, which serves the bundled build from
 *  capacitor://localhost. The protocol check covers the moment before the
 *  Capacitor bridge has attached `window.Capacitor`. */
export const isNativeShell = () =>
  typeof window !== 'undefined' &&
  (window.Capacitor?.isNativePlatform?.() === true || /^capacitor:/.test(window.location.protocol))
