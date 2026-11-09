import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests/browser',fullyParallel:false,workers:1,timeout:45000,use:{baseURL:'http://127.0.0.1:5173',headless:true,channel:'msedge',viewport:{width:1440,height:960},screenshot:'only-on-failure',trace:'retain-on-failure'},outputDir:'outputs/test-results'});
