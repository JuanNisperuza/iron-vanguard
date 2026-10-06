// =====================================================================
//  IRON VANGUARD — arranque
// =====================================================================
window.addEventListener('load', () => {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    width: GW, height: GH,
    parent: 'game',
    backgroundColor: '#0a0410',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { gamepad: true },
    render: { antialias: true, roundPixels: false, powerPreference: 'high-performance' },
    fps: { target: 60, smoothStep: true },
    scene: [BootScene, TitleScene, GameScene, HudScene],
  });
  window.__game = game;
});
