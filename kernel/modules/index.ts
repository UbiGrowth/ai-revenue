/**
 * Kernel Module Registry
 * Registers all available modules with the OS kernel
 */

import { registerModule } from '../core';
import cmoManifest from '../../registry/modules/cmo.manifest.json';
import croManifest from '../../registry/modules/cro.manifest.json';
import cfoManifest from '../../registry/modules/cfo.manifest.json';
import cooManifest from '../../registry/modules/coo.manifest.json';

// Register all exec modules
registerModule(cmoManifest);
registerModule(croManifest);
registerModule(cfoManifest);
registerModule(cooManifest);

// Re-export manifests for direct access
export { cmoManifest, croManifest, cfoManifest, cooManifest };

// Re-export core functionality
export * from '../core';

// Re-export test utilities
export * from '../test/tenant-test';

// Re-export launch toggles
export * from '../launch/module-toggle';
