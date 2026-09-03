import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    // Every test shares one Supabase project, and the app syncs live: rows
    // written by one test are pushed into the other tests' browsers, which
    // re-renders their item list and makes them fail for reasons that have
    // nothing to do with what they assert. Running one at a time is what
    // keeps a test's own edits the only thing it observes.
    fullyParallel: false,
    workers: 1,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI ? 'github' : 'html',
    use: {
        baseURL: 'http://localhost:5173',
        trace: 'retain-on-failure',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
});
