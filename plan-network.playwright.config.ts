import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests',testMatch:'plan-network.browser.spec.ts',timeout:45000,workers:1,use:{channel:'msedge',headless:true}});
