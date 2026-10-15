import siteConfig from '../../site.config.json' with { type: 'json' };
import { resolveAmznHref, AFFILIATE_REL } from './affiliate.mjs';

function walk(node, fn) {
  fn(node);
  if (node.children) for (const child of node.children) walk(child, fn);
}

/**
 * Turns `[text](amzn:Product+Name)` / `[text](amzn:B0XXXXXXXX)` into tagged
 * Amazon links with rel="sponsored", and marks other outbound links noopener.
 */
export function remarkAffiliateLinks() {
  return (tree) => {
    walk(tree, (node) => {
      if (node.type !== 'link' || typeof node.url !== 'string') return;
      if (node.url.startsWith('amzn:')) {
        node.url = resolveAmznHref(node.url);
        node.data = node.data || {};
        node.data.hProperties = { rel: AFFILIATE_REL, target: '_blank', class: 'aff-link' };
      } else if (/^https?:\/\//.test(node.url) && !node.url.includes(siteConfig.domain)) {
        node.data = node.data || {};
        node.data.hProperties = { rel: 'noopener', target: '_blank' };
      }
    });
  };
}
