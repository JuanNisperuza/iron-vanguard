window.addEventListener('load', () => {
  new Phaser.Game({
    type: Phaser.AUTO,
    width: GW,
    height: GH,
    parent: 'game',
    backgroundColor: '#0a0410',
    banner: false,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { gamepad: true },
    render: { antialias: true, powerPreference: 'high-performance' },
    fps: { target: 60, smoothStep: true },
    scene: [BootScene, TitleScene, GameScene, HudScene],
  });
});
