async def scen(pg):
    await pg.evaluate("__game.ff(20)")
    print(await pg.evaluate("""(()=>{const R=__game.renderer;R.info.autoReset=false;R.info.reset();__game.ff(1);const o={calls:R.info.render.calls,tris:R.info.render.triangles,q:__game.QUALITY.level};R.info.autoReset=true;return o})()"""))
    await pg.wait_for_timeout(200);await pg.screenshot(path='/home/claude/m1.png')
    await pg.evaluate("(()=>{const g=__game;const c=g.cars.filter(c=>c.type==='sport'&&!c.driver).sort((a,b)=>a.pos.distanceTo(g.player.pos)-b.pos.distanceTo(g.player.pos))[0];g.player.pos.set(c.pos.x-2.4,0,c.pos.z);g.ff(2);g.toggleCar();})()")
    await pg.keyboard.down('KeyW');await pg.evaluate("__game.ff(40)");await pg.keyboard.up('KeyW');await pg.wait_for_timeout(200);await pg.screenshot(path='/home/claude/m2.png')
