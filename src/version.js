import pkg from "../package.json";

/** Semver from package.json — bump with npm version / manual edit when shipping. */
export const APP_VERSION = pkg.version;

export const APP_NAME = pkg.name;
