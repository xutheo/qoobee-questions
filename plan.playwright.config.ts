import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir:'./tests',testMatch:'plan.browser.spec.ts',timeout:60000,workers:1,
 use:{baseURL:'http://127.0.0.1:3201',channel:'msedge',headless:true,viewport:{width:1500,height:1000},screenshot:'only-on-failure'},
 webServer:{command:'npx vite --host 127.0.0.1 --port 3201 --strictPort',url:'http://127.0.0.1:3201',reuseExistingServer:false,timeout:30000}
});
