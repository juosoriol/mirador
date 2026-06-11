import { test, expect } from '@playwright/test';
import { registerCoreFlows } from '../shared/core-flows.js';

registerCoreFlows(test, expect, { isMobile: false });
