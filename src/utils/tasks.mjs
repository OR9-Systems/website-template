import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

// Minimal Astrowind-like integration that exposes `astrowind:config`
// by reading `src/config.yaml` and injecting a virtual module.

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Load YAML config from the given relative path
 */
function loadYamlConfig(relativePath) {
  const absolutePath = path.resolve(__dirname, '../../', relativePath);
  const file = fs.readFileSync(absolutePath, 'utf8');
  const data = yaml.load(file) || {};
  return data;
}

export default function astrowindIntegration({ config: configPath = 'src/config.yaml' } = {}) {
  return {
    name: 'astrowind-integration',
    hooks: {
      'astro:config:setup': async ({ config, updateConfig, addWatchFile, logger }) => {
        const log = logger.fork('astrowind');

        // Load raw YAML
        const raw = loadYamlConfig(configPath);

        // Map to expected structures
        const SITE = {
          site: raw?.site?.site ?? config.site ?? 'https://example.com',
          base: raw?.site?.base ?? '/',
          trailingSlash: Boolean(raw?.site?.trailingSlash ?? false),
          name: raw?.site?.name ?? 'Site',
          googleSiteVerificationId: raw?.site?.googleSiteVerificationId ?? null,
        };

        const I18N = {
          language: raw?.i18n?.language ?? 'en',
          textDirection: raw?.i18n?.textDirection ?? 'ltr',
        };

        const METADATA = raw?.metadata ?? {};
        const APP_BLOG = raw?.apps?.blog ?? { isEnabled: false };
        const UI = raw?.ui ?? { theme: 'system' };
        const ANALYTICS = raw?.analytics ?? { vendors: { googleAnalytics: { id: null } } };

        const virtualModuleId = 'astrowind:config';
        const resolvedVirtualModuleId = '\0' + virtualModuleId;

        updateConfig({
          site: SITE.site,
          base: SITE.base,
          trailingSlash: SITE.trailingSlash ? 'always' : 'never',
          vite: {
            plugins: [
              {
                name: 'vite-plugin-astrowind-config',
                resolveId(id) {
                  if (id === virtualModuleId) return resolvedVirtualModuleId;
                },
                load(id) {
                  if (id === resolvedVirtualModuleId) {
                    return `export const SITE = ${JSON.stringify(SITE)};
export const I18N = ${JSON.stringify(I18N)};
export const METADATA = ${JSON.stringify(METADATA)};
export const APP_BLOG = ${JSON.stringify(APP_BLOG)};
export const UI = ${JSON.stringify(UI)};
export const ANALYTICS = ${JSON.stringify(ANALYTICS)};`;
                  }
                },
              },
            ],
          },
        });

        // Watch the YAML file for changes
        addWatchFile(new URL(configPath, config.root));
        log.info(`Astrowind \`${configPath}\` has been loaded.`);
      },
    },
  };
}


