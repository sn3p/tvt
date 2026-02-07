import { Application } from "@hotwired/stimulus";
window.stimulus = Application.start();

// Load controllers
await import("./controllers/hello_controller.js");
