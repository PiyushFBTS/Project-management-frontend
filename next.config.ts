import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Pin the Turbopack workspace root to this app's directory. Without
  // this, Turbopack discovers a stray `C:\Users\piyus\package-lock.json`
  // and treats the home folder as the root, which breaks module
  // resolution and produces the generic "unexpected Turbopack error"
  // overlay on first compile.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
