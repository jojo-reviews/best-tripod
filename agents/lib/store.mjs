import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { BLOG_DIR, DATA_DIR, REPORT_DIR } from './config.mjs';

const QUEUE = path.join(DATA_DIR, 'keywords.json');
const STATE = path.join(DATA_DIR, 'state.json');

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

export const loadQueue = () => readJson(QUEUE, []);
export const saveQueue = (q) => writeJson(QUEUE, q);
export const loadState = () => readJson(STATE, { startDate: null, published: [] });
export const saveState = (s) => writeJson(STATE, s);
export const saveReport = (slug, report) => writeJson(path.join(REPORT_DIR, `${slug}.json`), report);

export function listPosts() {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const file = path.join(BLOG_DIR, f);
      const { data, content } = matter(fs.readFileSync(file, 'utf8'));
      return { slug: f.replace(/\.md$/, ''), file, data, content };
    });
}

export function postExists(slug) {
  return fs.existsSync(path.join(BLOG_DIR, `${slug}.md`));
}

/** Write a post. Removes undefined/empty optional keys so YAML stays clean. */
export function writePost(slug, data, content) {
  // JSON round-trip drops nested `undefined` values that YAML cannot serialize.
  const plain = JSON.parse(JSON.stringify(data));
  const clean = Object.fromEntries(
    Object.entries(plain).filter(([, v]) => v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0)),
  );
  const file = path.join(BLOG_DIR, `${slug}.md`);
  fs.writeFileSync(file, matter.stringify(`\n${content.trim()}\n`, clean));
  return file;
}
