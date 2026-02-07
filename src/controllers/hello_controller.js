import { Controller } from "@hotwired/stimulus";

window.stimulus.register("hello", class extends Controller {
  connect() {
    console.log("Hello controller connected");
  }
});
