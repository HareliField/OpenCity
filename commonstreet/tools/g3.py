import asyncio,sys,json,time
from playwright.async_api import async_playwright
async def main():
    mobile=len(sys.argv)>2 and sys.argv[2]=='m'
    q=sys.argv[3] if len(sys.argv)>3 else ''
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'])
        pg=await b.new_page(viewport={'width':390,'height':800} if mobile else {'width':1280,'height':720},is_mobile=mobile,has_touch=mobile)
        errs=[]
        pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e)))
        pg.on('console',lambda m:errs.append(m.type+': '+m.text) if m.type in('error','warning') and 'GPU stall' not in m.text else None)
        await pg.route('**/fonts.g*/**',lambda r:r.abort())
        t0=time.time()
        await pg.goto('http://localhost:8765/index.html'+q)
        try: await pg.wait_for_function("!document.getElementById('play').disabled",timeout=300000)
        except Exception as e: print('load timeout', await pg.evaluate("document.getElementById('load').textContent"))
        print('load s',round(time.time()-t0,1))
        await pg.screenshot(path='/home/claude/g0.png')
        if not any('PAGEERR' in e for e in errs):
            await pg.click('#play'); await pg.wait_for_timeout(500)
            exec(open('/home/claude/scen3.py').read(),globals())
            await scen(pg)
        print('\n'.join(dict.fromkeys(e[:400] for e in errs)));open('/home/claude/errs.txt','w').write('\n\n'.join(errs))
        await b.close()
asyncio.run(main())
