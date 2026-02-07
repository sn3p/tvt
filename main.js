import "./src/stimulus.js";

window.process = { env: { NODE_ENV: "production" } };
const { default: tippy } = await import("tippy.js");
tippy("[data-tippy-content]");

import { initApp } from "./src/app.js";
initApp();

